import { randomBytes } from 'node:crypto';
import { shell } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { LauncherError } from '../../shared/errors';
import { mediaUrl } from '../../shared/media-url';
import type { WorldBackup, WorldInfo } from '../../shared/types/worlds';
import { writeArchive } from '../core/archive-writer';
import { isInside, listDirectory, pathExists } from '../core/file-system';
import { extractArchive } from '../content/import/archive-extractor';
import type { InstanceService } from '../instances/instance-service';
import { INSTANCE_META_DIR } from '../instances/instance-store';
import type { TaskHandle, TaskManager } from '../tasks/task-manager';
import { listFiles, readLevelSummary } from './world-reader';

const SAVES_FOLDER = 'saves';
const BACKUPS_FOLDER = 'backups';
const LOCK_FILE = 'session.lock';
const BACKUP_NAME = /^(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})_(.+)\.zip$/;

function two(value: number): string {
  return String(value).padStart(2, '0');
}

function backupFileName(folder: string, date: Date): string {
  const day = `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
  const time = `${two(date.getHours())}-${two(date.getMinutes())}-${two(date.getSeconds())}`;
  return `${day}_${time}_${folder}.zip`;
}

function parseBackupName(fileName: string): { worldFolder: string; createdAt: number } | null {
  const match = BACKUP_NAME.exec(fileName);
  if (!match) return null;
  const [year, month, day, hours, minutes, seconds] = match.slice(1, 7).map(Number);
  return { worldFolder: match[7], createdAt: new Date(year, month - 1, day, hours, minutes, seconds).getTime() };
}

function childPath(parent: string, name: string): string {
  const target = path.join(parent, name);
  if (path.basename(name) !== name || !isInside(parent, target)) throw new LauncherError('invalid-input', 'Invalid world path');
  return target;
}

export class WorldService {
  constructor(
    private readonly instances: InstanceService,
    private readonly tasks: TaskManager
  ) {}

  async list(instanceId: string): Promise<WorldInfo[]> {
    const saves = this.savesDir(instanceId);
    const backups = await this.listBackups(instanceId);
    const worlds: WorldInfo[] = [];
    for (const folder of await listDirectory(saves)) {
      const worldDir = path.join(saves, folder);
      const summary = await readLevelSummary(worldDir);
      if (!summary) continue;
      const files = await listFiles(worldDir);
      const icon = path.join(worldDir, 'icon.png');
      const iconStat = await fs.stat(icon).catch(() => null);
      worlds.push({
        folder,
        name: summary.name || folder,
        gameMode: summary.gameMode,
        gameVersion: summary.gameVersion,
        lastPlayedAt: summary.lastPlayedAt,
        sizeBytes: files.reduce((sum, file) => sum + file.size, 0),
        iconUrl: iconStat ? mediaUrl(icon, Math.round(iconStat.mtimeMs)) : null,
        backupCount: backups.filter((backup) => backup.worldFolder === folder).length
      });
    }
    return worlds.sort((left, right) => (right.lastPlayedAt ?? 0) - (left.lastPlayedAt ?? 0));
  }

  async listBackups(instanceId: string): Promise<WorldBackup[]> {
    const dir = this.backupsDir(instanceId);
    const backups: WorldBackup[] = [];
    for (const fileName of await listDirectory(dir)) {
      const parsed = parseBackupName(fileName);
      const stat = parsed ? await fs.stat(path.join(dir, fileName)).catch(() => null) : null;
      if (parsed && stat) backups.push({ fileName, ...parsed, sizeBytes: stat.size });
    }
    return backups.sort((left, right) => right.createdAt - left.createdAt);
  }

  startBackup(instanceId: string, folder: string): string {
    const task = this.tasks.create({
      kind: 'world-backup',
      title: { key: 'tasks.backupWorld', params: { name: folder } },
      instanceId,
      steps: [{ id: 'archive', label: { key: 'tasks.step.backupArchive' } }]
    });
    return this.tasks.runInBackground(task, async (handle) => {
      handle.startStep('archive');
      await this.writeBackup(instanceId, folder, handle);
    });
  }

  startRestore(instanceId: string, fileName: string): string {
    const parsed = parseBackupName(fileName);
    if (!parsed) throw new LauncherError('invalid-input', 'Invalid backup name');
    const task = this.tasks.create({
      kind: 'world-restore',
      title: { key: 'tasks.restoreWorld', params: { name: parsed.worldFolder } },
      instanceId,
      steps: [
        { id: 'archive', label: { key: 'tasks.step.backupArchive' }, weight: 2 },
        { id: 'extract', label: { key: 'tasks.step.restoreExtract' }, weight: 2 }
      ]
    });
    return this.tasks.runInBackground(task, (handle) => this.restore(instanceId, fileName, parsed.worldFolder, handle));
  }

  async removeWorld(instanceId: string, folder: string): Promise<WorldInfo[]> {
    const worldDir = childPath(this.savesDir(instanceId), folder);
    if (!(await readLevelSummary(worldDir))) throw new LauncherError('invalid-input', 'World not found');
    await shell.trashItem(worldDir).catch(() => fs.rm(worldDir, { recursive: true, force: true }));
    return this.list(instanceId);
  }

  async removeBackup(instanceId: string, fileName: string): Promise<WorldBackup[]> {
    if (!parseBackupName(fileName)) throw new LauncherError('invalid-input', 'Invalid backup name');
    await fs.rm(childPath(this.backupsDir(instanceId), fileName), { force: true });
    return this.listBackups(instanceId);
  }

  revealBackup(instanceId: string, fileName: string): void {
    if (!parseBackupName(fileName)) throw new LauncherError('invalid-input', 'Invalid backup name');
    shell.showItemInFolder(childPath(this.backupsDir(instanceId), fileName));
  }

  private savesDir(instanceId: string): string {
    return path.join(this.instances.dir(instanceId), SAVES_FOLDER);
  }

  private backupsDir(instanceId: string): string {
    return path.join(this.instances.dir(instanceId), BACKUPS_FOLDER);
  }

  private async writeBackup(instanceId: string, folder: string, task: TaskHandle): Promise<void> {
    const worldDir = childPath(this.savesDir(instanceId), folder);
    const files = (await listFiles(worldDir)).filter((file) => file.relative !== LOCK_FILE);
    const target = path.join(this.backupsDir(instanceId), backupFileName(folder, new Date()));
    const entries = files.map((file) => ({ name: `${folder}/${file.relative}`, source: file.absolute }));
    await writeArchive(entries, target, { signal: task.signal, onProgress: (fraction) => task.setStepProgress('archive', fraction) });
  }

  private async restore(instanceId: string, fileName: string, folder: string, task: TaskHandle): Promise<void> {
    const instanceDir = this.instances.dir(instanceId);
    const worldDir = childPath(this.savesDir(instanceId), folder);
    const backup = childPath(this.backupsDir(instanceId), fileName);
    const workDir = path.join(instanceDir, INSTANCE_META_DIR, `restore-${randomBytes(4).toString('hex')}`);
    const exists = await pathExists(worldDir);
    task.startStep('archive');
    if (exists) await this.writeBackup(instanceId, folder, task);
    task.startStep('extract');
    try {
      await extractArchive(backup, workDir, { signal: task.signal, onProgress: (fraction) => task.setStepProgress('extract', fraction) });
      const restored = path.join(workDir, folder);
      if (!(await readLevelSummary(restored))) throw new LauncherError('backup-invalid', `${fileName} has no world`);
      task.throwIfCancelled();
      await this.swapWorld(worldDir, restored, workDir, exists);
    } finally {
      await fs.rm(workDir, { recursive: true, force: true });
    }
  }

  private async swapWorld(worldDir: string, restored: string, workDir: string, exists: boolean): Promise<void> {
    const previous = path.join(workDir, '.previous');
    await fs.mkdir(path.dirname(worldDir), { recursive: true });
    if (exists) await fs.rename(worldDir, previous);
    try {
      await fs.rename(restored, worldDir);
    } catch (error) {
      if (exists) await fs.rename(previous, worldDir);
      throw error;
    }
  }
}
