import path from 'node:path';
import { LauncherError } from '../../../shared/errors';
import type { InstanceLoader } from '../../../shared/types/instances';
import { copyTree, isInside, pathExists, readJsonFile } from '../../core/file-system';
import { downloadFiles } from '../../downloads/download-manager';
import type { DownloadRequest } from '../../downloads/download-types';
import { packageName, type InstancePackage } from './instance-package';

export const MRPACK_INDEX_FILE = 'modrinth.index.json';

const OVERRIDE_FOLDERS = ['overrides', 'client-overrides'];

interface MrpackFile {
  path: string;
  hashes: { sha1: string };
  env?: { client?: 'required' | 'optional' | 'unsupported' };
  downloads: string[];
  fileSize?: number;
}

interface MrpackIndex {
  game?: string;
  name?: string;
  files?: MrpackFile[];
  dependencies?: Record<string, string>;
}

function loaderFromDependencies(dependencies: Record<string, string>, gameVersion: string): InstanceLoader {
  if (dependencies['fabric-loader']) return { type: 'fabric', version: dependencies['fabric-loader'] };
  if (dependencies['quilt-loader']) return { type: 'quilt', version: dependencies['quilt-loader'] };
  if (dependencies.neoforge) return { type: 'neoforge', version: dependencies.neoforge };
  if (dependencies.forge) return { type: 'forge', version: `${gameVersion}-${dependencies.forge}` };
  return { type: 'vanilla', version: null };
}

function fileRequests(files: MrpackFile[], instanceDir: string): DownloadRequest[] {
  const requests: DownloadRequest[] = [];
  for (const entry of files) {
    if (entry.env?.client === 'unsupported' || entry.downloads.length === 0) continue;
    const destination = path.join(instanceDir, ...entry.path.split('/'));
    if (!isInside(instanceDir, destination)) continue;
    requests.push({ url: entry.downloads[0], fallbackUrls: entry.downloads.slice(1), destination, sha1: entry.hashes.sha1, size: entry.fileSize });
  }
  return requests;
}

export async function readMrpackPackage(root: string, fallbackName: string): Promise<InstancePackage> {
  const index = await readJsonFile<MrpackIndex | null>(path.join(root, MRPACK_INDEX_FILE), null);
  const gameVersion = index?.dependencies?.minecraft;
  if (!index || index.game !== 'minecraft' || !index.dependencies || !gameVersion) {
    throw new LauncherError('modpack-invalid', `${MRPACK_INDEX_FILE} is not a Minecraft modpack`);
  }
  return {
    name: packageName(index.name, fallbackName),
    gameVersion,
    loader: loaderFromDependencies(index.dependencies, gameVersion),
    async install(instanceDir, task) {
      task.startStep('files');
      await downloadFiles(fileRequests(index.files ?? [], instanceDir), { signal: task.signal, onProgress: task.downloadReporter('files') });
      task.startStep('overrides');
      for (const folder of OVERRIDE_FOLDERS) {
        const source = path.join(root, folder);
        if (!(await pathExists(source))) continue;
        await copyTree(source, instanceDir, { signal: task.signal, onProgress: (fraction) => task.setStepProgress('overrides', fraction) });
      }
    }
  };
}
