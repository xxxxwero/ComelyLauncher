import fs from 'node:fs/promises';
import path from 'node:path';
import { LauncherError } from '../../../shared/errors';
import type { Instance, InstanceLoader } from '../../../shared/types/instances';
import { writeArchive, type ArchiveEntry } from '../../core/archive-writer';
import { fileSize, hashFile } from '../../core/file-system';
import { createLogger } from '../../core/logger';
import type { InstanceService } from '../../instances/instance-service';
import { INSTANCE_META_DIR } from '../../instances/instance-store';
import type { SettingsService } from '../../settings/settings-service';
import type { TaskHandle, TaskManager } from '../../tasks/task-manager';
import { MRPACK_INDEX_FILE } from '../import/mrpack-package';
import type { ModrinthClient, ModrinthVersion } from '../modrinth-client';

const CONTENT_FOLDERS = new Set(['mods', 'resourcepacks', 'shaderpacks']);
const HOSTED_FILE = /\.(jar|zip)$/i;
const EXCLUDED_ROOT_ENTRIES = new Set([
  INSTANCE_META_DIR,
  'saves',
  'backups',
  'logs',
  'crash-reports',
  'screenshots',
  'natives',
  'downloads',
  'server-resource-packs',
  'debug',
  '.fabric',
  '.quilt',
  '.mixin.out',
  'usercache.json',
  'usernamecache.json',
  'command_history.txt',
  'realms_persistence.json'
]);
const HASH_BATCH_SIZE = 200;
const OVERRIDES_FOLDER = 'overrides';

const log = createLogger('export');

interface ExportFile {
  relative: string;
  absolute: string;
}

interface MrpackFileEntry {
  path: string;
  hashes: { sha1: string; sha512: string };
  downloads: string[];
  fileSize: number;
}

function loaderDependency(loader: InstanceLoader, gameVersion: string): Record<string, string> {
  if (loader.type === 'vanilla') return {};
  if (!loader.version) throw new LauncherError('export-needs-install', `${loader.type} version is unknown`);
  switch (loader.type) {
    case 'fabric':
      return { 'fabric-loader': loader.version };
    case 'quilt':
      return { 'quilt-loader': loader.version };
    case 'neoforge':
      return { neoforge: loader.version };
    case 'forge':
      return { forge: loader.version.startsWith(`${gameVersion}-`) ? loader.version.slice(gameVersion.length + 1) : loader.version };
  }
}

async function collectFiles(instanceDir: string): Promise<ExportFile[]> {
  const entries = await fs.readdir(instanceDir, { recursive: true, withFileTypes: true });
  const files: ExportFile[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const absolute = path.join(entry.parentPath, entry.name);
    const relative = path.relative(instanceDir, absolute).split(path.sep).join('/');
    if (!EXCLUDED_ROOT_ENTRIES.has(relative.split('/')[0])) files.push({ relative, absolute });
  }
  return files;
}

function isHostedCandidate(file: ExportFile): boolean {
  const parts = file.relative.split('/');
  return parts.length === 2 && CONTENT_FOLDERS.has(parts[0]) && HOSTED_FILE.test(parts[1]);
}

export class MrpackExporter {
  constructor(
    private readonly settings: SettingsService,
    private readonly instances: InstanceService,
    private readonly modrinth: ModrinthClient,
    private readonly tasks: TaskManager
  ) {}

  async start(instanceId: string, target: string, onFinished?: () => void): Promise<string> {
    const instance = await this.instances.get(instanceId);
    const dependencies = { minecraft: instance.gameVersion, ...loaderDependency(instance.loader, instance.gameVersion) };
    const task = this.tasks.create({
      kind: 'instance-export',
      title: { key: 'tasks.exportInstance', params: { name: instance.name } },
      instanceId,
      steps: [
        { id: 'hash', label: { key: 'tasks.step.exportLookup' }, weight: 1 },
        { id: 'archive', label: { key: 'tasks.step.exportArchive' }, weight: 3 }
      ]
    });
    return this.tasks.runInBackground(task, async (handle) => {
      await this.export(instance, dependencies, target, handle);
      onFinished?.();
    });
  }

  private async export(instance: Instance, dependencies: Record<string, string>, target: string, task: TaskHandle): Promise<void> {
    const files = await collectFiles(this.instances.dir(instance.id));
    task.startStep('hash');
    const hosted = await this.findHostedFiles(files.filter(isHostedCandidate), task);
    task.throwIfCancelled();
    const workDir = path.join(this.settings.gamePaths().cache, 'exports', task.id);
    await fs.mkdir(workDir, { recursive: true });
    try {
      const indexFile = path.join(workDir, MRPACK_INDEX_FILE);
      await fs.writeFile(indexFile, JSON.stringify({
        formatVersion: 1,
        game: 'minecraft',
        versionId: '1.0.0',
        name: instance.name,
        files: [...hosted.values()],
        dependencies
      }, null, 2));
      const entries: ArchiveEntry[] = [{ name: MRPACK_INDEX_FILE, source: indexFile }];
      for (const file of files) {
        if (!hosted.has(file.relative)) entries.push({ name: `${OVERRIDES_FOLDER}/${file.relative}`, source: file.absolute });
      }
      task.startStep('archive');
      await writeArchive(entries, target, { signal: task.signal, onProgress: (fraction) => task.setStepProgress('archive', fraction) });
    } finally {
      await fs.rm(workDir, { recursive: true, force: true });
    }
  }

  private async findHostedFiles(candidates: ExportFile[], task: TaskHandle): Promise<Map<string, MrpackFileEntry>> {
    const hashes = new Map<string, ExportFile>();
    for (const [position, file] of candidates.entries()) {
      task.throwIfCancelled();
      hashes.set(await hashFile(file.absolute, 'sha1'), file);
      task.setStepProgress('hash', ((position + 1) / Math.max(1, candidates.length)) * 0.8);
    }
    const hosted = new Map<string, MrpackFileEntry>();
    const allHashes = [...hashes.keys()];
    for (let start = 0; start < allHashes.length; start += HASH_BATCH_SIZE) {
      const versions = await this.lookUp(allHashes.slice(start, start + HASH_BATCH_SIZE));
      for (const [sha1, version] of Object.entries(versions)) {
        const file = hashes.get(sha1);
        const remote = version.files.find((entry) => entry.hashes.sha1 === sha1);
        if (!file || !remote) continue;
        hosted.set(file.relative, {
          path: file.relative,
          hashes: { sha1, sha512: remote.hashes.sha512 ?? (await hashFile(file.absolute, 'sha512')) },
          downloads: [remote.url],
          fileSize: (await fileSize(file.absolute)) ?? remote.size
        });
      }
    }
    return hosted;
  }

  private async lookUp(hashes: string[]): Promise<Record<string, ModrinthVersion>> {
    try {
      return await this.modrinth.versionsByHashes(hashes);
    } catch (error) {
      log.warn('Modrinth lookup failed, files go to overrides', error);
      return {};
    }
  }
}
