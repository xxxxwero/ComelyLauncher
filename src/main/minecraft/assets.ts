import fs from 'node:fs/promises';
import path from 'node:path';
import { ensureDir, fileSize, pathExists, readJsonFile } from '../core/file-system';
import type { GamePaths } from '../core/game-paths';
import { allFilesPresent, downloadFile, downloadFiles } from '../downloads/download-manager';
import type { DownloadOptions, DownloadRequest } from '../downloads/download-types';
import type { AssetIndexReference } from './version-json';

const RESOURCES_URL = 'https://resources.download.minecraft.net';

interface AssetIndexFile {
  objects: Record<string, { hash: string; size: number }>;
  virtual?: boolean;
  map_to_resources?: boolean;
}

export async function installAssetIndex(paths: GamePaths, reference: AssetIndexReference, signal?: AbortSignal): Promise<void> {
  await downloadFile({ url: reference.url, destination: paths.assetIndex(reference.id), sha1: reference.sha1, size: reference.size }, { signal });
}

async function readIndex(paths: GamePaths, indexId: string): Promise<AssetIndexFile> {
  return readJsonFile<AssetIndexFile>(paths.assetIndex(indexId), { objects: {} });
}

function objectRequests(paths: GamePaths, index: AssetIndexFile): DownloadRequest[] {
  return Object.values(index.objects).map((object) => ({
    url: `${RESOURCES_URL}/${object.hash.slice(0, 2)}/${object.hash}`,
    destination: paths.assetObject(object.hash),
    sha1: object.hash,
    size: object.size
  }));
}

export async function installAssetObjects(paths: GamePaths, indexId: string, options: DownloadOptions): Promise<void> {
  const index = await readIndex(paths, indexId);
  await downloadFiles(objectRequests(paths, index), { ...options, verification: 'size', concurrency: 16 });
}

export async function areAssetsPresent(paths: GamePaths, reference: AssetIndexReference): Promise<boolean> {
  if (!(await pathExists(paths.assetIndex(reference.id)))) return false;
  return allFilesPresent(objectRequests(paths, await readIndex(paths, reference.id)));
}

async function copyIfMissing(source: string, target: string, size: number): Promise<void> {
  if ((await fileSize(target)) === size) return;
  await ensureDir(path.dirname(target));
  await fs.copyFile(source, target);
}

export interface LegacyAssetsLayout {
  gameAssetsDir: string;
}

export async function prepareLegacyAssets(paths: GamePaths, indexId: string, instanceDir: string): Promise<LegacyAssetsLayout> {
  const index = await readIndex(paths, indexId);
  if (!index.virtual && !index.map_to_resources) return { gameAssetsDir: paths.assets };
  const virtualDir = paths.virtualAssets(indexId);
  for (const [name, object] of Object.entries(index.objects)) {
    const source = paths.assetObject(object.hash);
    if (index.virtual) await copyIfMissing(source, path.join(virtualDir, ...name.split('/')), object.size);
    if (index.map_to_resources) await copyIfMissing(source, path.join(instanceDir, 'resources', ...name.split('/')), object.size);
  }
  return { gameAssetsDir: index.virtual ? virtualDir : paths.assets };
}
