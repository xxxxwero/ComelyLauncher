import fs from 'node:fs/promises';
import path from 'node:path';
import { LauncherError } from '../../shared/errors';
import type { GameDirectoryEstimate } from '../../shared/types/system';
import { userDataPath } from '../core/app-paths';
import { copyTree, ensureDir, isInside, listDirectory, pathExists, readJsonFile, writeJsonFile } from '../core/file-system';
import { GamePaths } from '../core/game-paths';
import { createLogger } from '../core/logger';
import { normalizeGameDirectory } from '../settings/game-directory';
import type { SettingsService } from '../settings/settings-service';
import type { TaskHandle, TaskManager } from '../tasks/task-manager';
import { uniqueFolderName } from './instance-folder-name';
import { legacyProfilesFolder, migrateLegacyProfiles } from './legacy-profiles';
import { isFilesBusyError, moveTreeByFiles, removeEmptyTree, renameWithRetries, restoreMovedFiles, toMoveError, type MovedPath } from './tree-move';

const SHARED_FOLDERS = ['versions', 'libraries', 'assets', 'runtime', 'cache'];
const PROFILES_FOLDER = 'profiles';
const FREE_SPACE_RESERVE_BYTES = 200 * 1024 * 1024;
const GIGABYTE = 1024 * 1024 * 1024;

const LEFTOVER_CLEANUP_DELAYS_MS = [5000, 30000, 120000];

const log = createLogger('game-directory');

interface FolderMove {
  source: string;
  target: string;
  keepExisting: boolean;
  fileCount: number;
}

interface MoveJournal {
  renamed: MovedPath[];
  movedFiles: MovedPath[];
  createdFiles: string[];
  createdFolders: string[];
  copiedSources: string[];
}

async function measureFolder(folder: string): Promise<{ fileCount: number; totalBytes: number }> {
  const entries = await fs.readdir(folder, { recursive: true, withFileTypes: true }).catch(() => []);
  let fileCount = 0;
  let totalBytes = 0;
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const stat = await fs.stat(path.join(entry.parentPath, entry.name)).catch(() => null);
    if (!stat) continue;
    fileCount++;
    totalBytes += stat.size;
  }
  return { fileCount, totalBytes };
}

async function freeSpaceFor(directory: string): Promise<number | null> {
  try {
    const stat = await fs.statfs(path.parse(path.resolve(directory)).root);
    return Number(stat.bavail) * Number(stat.bsize);
  } catch {
    return null;
  }
}

function isSameDrive(left: string, right: string): boolean {
  return path.parse(path.resolve(left)).root.toLowerCase() === path.parse(path.resolve(right)).root.toLowerCase();
}

type RenameOutcome = 'renamed' | 'other-drive' | 'folder-held';

async function renameFolder(source: string, target: string): Promise<RenameOutcome> {
  try {
    await renameWithRetries(source, target);
    return 'renamed';
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EXDEV') return 'other-drive';
    if (isFilesBusyError(error)) return 'folder-held';
    throw error;
  }
}

function formatGigabytes(bytes: number): string {
  return `${(bytes / GIGABYTE).toFixed(1)} GB`;
}

export class GameDirectoryMover {
  private readonly leftoversFile = userDataPath('moved-folder-leftovers.json');

  constructor(
    private readonly settings: SettingsService,
    private readonly tasks: TaskManager
  ) {}

  async estimate(gameDirectory: string): Promise<GameDirectoryEstimate> {
    const target = normalizeGameDirectory(gameDirectory);
    const source = this.settings.gamePaths().root;
    let fileCount = 0;
    let totalBytes = 0;
    if (path.resolve(source).toLowerCase() !== path.resolve(target).toLowerCase()) {
      for (const folder of [...SHARED_FOLDERS, PROFILES_FOLDER]) {
        const measured = await measureFolder(path.join(source, folder));
        fileCount += measured.fileCount;
        totalBytes += measured.totalBytes;
      }
    }
    return { fileCount, totalBytes, freeBytes: await freeSpaceFor(target), sameDrive: isSameDrive(source, target) };
  }

  async migrateLayout(): Promise<void> {
    await this.removeLeftovers();
    const current = this.settings.gamePaths();
    const dedicated = normalizeGameDirectory(current.root);
    const needsMove = path.resolve(current.root).toLowerCase() !== path.resolve(dedicated).toLowerCase();
    const hasLegacy = (await listDirectory(legacyProfilesFolder(current))).length > 0;
    const owned = [...SHARED_FOLDERS, PROFILES_FOLDER].map((folder) => pathExists(path.join(current.root, folder)));
    const hasData = hasLegacy || (await Promise.all(owned)).some(Boolean);
    if (!hasData) {
      if (needsMove) await this.settings.update({ launcher: { gameDirectory: dedicated } });
      return;
    }
    if (!needsMove && !hasLegacy) return;
    const task = this.tasks.create({
      kind: 'instance-move',
      title: { key: 'tasks.moveInstances' },
      steps: [{ id: 'move', label: { key: 'tasks.step.moveInstances' } }]
    });
    await this.tasks
      .run(task, async (handle) => {
        await migrateLegacyProfiles(current).catch((error: unknown) => {
          throw toMoveError(error);
        });
        if (needsMove) await this.move(dedicated, handle);
      })
      .catch((error: unknown) => log.error('Could not move game folders to the dedicated folder', error));
  }

  start(gameDirectory: string): string {
    const target = normalizeGameDirectory(gameDirectory);
    const task = this.tasks.create({
      kind: 'instance-move',
      title: { key: 'tasks.moveInstances' },
      steps: [{ id: 'move', label: { key: 'tasks.step.moveInstances' } }]
    });
    return this.tasks.runInBackground(task, (handle) => this.move(target, handle));
  }

  private async move(targetDirectory: string, task: TaskHandle): Promise<void> {
    const source = this.settings.gamePaths();
    const target = new GamePaths(path.resolve(targetDirectory));
    task.startStep('move');
    if (path.resolve(source.root).toLowerCase() === target.root.toLowerCase()) return;
    if ([...SHARED_FOLDERS, PROFILES_FOLDER].some((folder) => isInside(path.join(source.root, folder), target.root))) {
      throw new LauncherError('invalid-input', 'The new game folder cannot be inside the folders being moved');
    }
    await this.ensureSpace(source, target);
    await ensureDir(target.root);
    const moves = await this.planMoves(source, target);
    const totalFiles = Math.max(1, moves.reduce((sum, move) => sum + move.fileCount, 0));
    const journal: MoveJournal = { renamed: [], movedFiles: [], createdFiles: [], createdFolders: [], copiedSources: [] };
    let doneFiles = 0;
    try {
      for (const move of moves) {
        task.throwIfCancelled();
        task.setCurrentFile(path.basename(move.source));
        const finished = doneFiles;
        await this.moveFolder(move, journal, task, (fraction) => task.setStepProgress('move', (finished + fraction * move.fileCount) / totalFiles));
        doneFiles += move.fileCount;
        task.setStepProgress('move', doneFiles / totalFiles);
      }
    } catch (error) {
      await this.rollback(journal, target);
      throw toMoveError(error);
    }
    await this.settings.update({ launcher: { gameDirectory: target.root } });
    await this.cleanUpSource(source, journal);
  }

  private async ensureSpace(source: GamePaths, target: GamePaths): Promise<void> {
    if (isSameDrive(source.root, target.root)) return;
    const estimate = await this.estimate(target.root);
    if (estimate.freeBytes !== null && estimate.freeBytes < estimate.totalBytes + FREE_SPACE_RESERVE_BYTES) {
      throw new LauncherError('not-enough-disk-space', 'Not enough disk space', { required: formatGigabytes(estimate.totalBytes), free: formatGigabytes(estimate.freeBytes) });
    }
  }

  private async planMoves(source: GamePaths, target: GamePaths): Promise<FolderMove[]> {
    const moves: FolderMove[] = [];
    for (const folder of SHARED_FOLDERS) {
      const from = path.join(source.root, folder);
      if (!(await pathExists(from))) continue;
      const to = path.join(target.root, folder);
      moves.push({ source: from, target: to, keepExisting: true, fileCount: (await measureFolder(from)).fileCount });
    }
    const taken = new Set((await listDirectory(target.profiles)).map((name) => name.toLowerCase()));
    for (const folder of await listDirectory(source.profiles)) {
      const from = source.instanceDir(folder);
      moves.push({ source: from, target: target.instanceDir(uniqueFolderName(folder, taken)), keepExisting: false, fileCount: (await measureFolder(from)).fileCount });
    }
    return moves;
  }

  private async moveFolder(move: FolderMove, journal: MoveJournal, task: TaskHandle, onProgress: (fraction: number) => void): Promise<void> {
    await ensureDir(path.dirname(move.target));
    const targetExists = await pathExists(move.target);
    const outcome = targetExists ? null : await renameFolder(move.source, move.target);
    if (outcome === 'renamed') {
      journal.renamed.push({ from: move.source, to: move.target });
      return;
    }
    if (!targetExists) journal.createdFolders.push(move.target);
    journal.copiedSources.push(move.source);
    if (outcome === 'folder-held' || (targetExists && isSameDrive(move.source, move.target))) {
      await moveTreeByFiles(move.source, move.target, { moved: journal.movedFiles, signal: task.signal, onProgress });
      return;
    }
    await copyTree(move.source, move.target, { keepExisting: move.keepExisting, createdFiles: journal.createdFiles, signal: task.signal, onProgress });
  }

  private async rollback(journal: MoveJournal, target: GamePaths): Promise<void> {
    const notReturned = await restoreMovedFiles(journal.movedFiles);
    if (notReturned.length > 0) log.error(`Could not return ${notReturned.length} moved files`);
    for (const { from, to } of journal.renamed) {
      await fs.rename(to, from).catch((error: unknown) => log.error(`Could not return ${to}`, error));
    }
    for (const folder of journal.createdFolders) await fs.rm(folder, { recursive: true, force: true }).catch(() => undefined);
    for (const file of journal.createdFiles) await fs.rm(file, { force: true }).catch(() => undefined);
    await fs.rmdir(target.profiles).catch(() => undefined);
    await fs.rmdir(target.root).catch(() => undefined);
  }

  private async cleanUpSource(source: GamePaths, journal: MoveJournal): Promise<void> {
    for (const folder of journal.copiedSources) {
      await fs.rm(folder, { recursive: true, force: true }).catch((error: unknown) => log.warn(`Could not remove ${folder}`, error));
    }
    await fs.rmdir(source.profiles).catch(() => undefined);
    await fs.rmdir(source.root).catch(() => undefined);
    await this.scheduleLeftovers(source);
  }

  private async scheduleLeftovers(source: GamePaths): Promise<void> {
    const candidates = [...SHARED_FOLDERS, PROFILES_FOLDER].map((folder) => path.join(source.root, folder));
    candidates.push(legacyProfilesFolder(source));
    const existing: string[] = [];
    for (const folder of candidates) {
      if (await pathExists(folder)) existing.push(folder);
    }
    if (existing.length === 0) return;
    await writeJsonFile(this.leftoversFile, existing);
    for (const delay of LEFTOVER_CLEANUP_DELAYS_MS) setTimeout(() => void this.removeLeftovers(), delay).unref();
  }

  private async removeLeftovers(): Promise<void> {
    const folders = await readJsonFile<string[]>(this.leftoversFile, []);
    if (folders.length === 0) return;
    const current = this.settings.gamePaths().root.toLowerCase();
    const remaining: string[] = [];
    for (const folder of folders) {
      if (path.dirname(path.resolve(folder)).toLowerCase() === current) continue;
      await removeEmptyTree(folder);
      if (await pathExists(folder)) remaining.push(folder);
    }
    if (remaining.length > 0) await writeJsonFile(this.leftoversFile, remaining);
    else await fs.rm(this.leftoversFile, { force: true });
  }
}
