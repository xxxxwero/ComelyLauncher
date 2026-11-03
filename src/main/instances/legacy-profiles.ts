import fs from 'node:fs/promises';
import path from 'node:path';
import { listDirectory, pathExists } from '../core/file-system';
import type { GamePaths } from '../core/game-paths';
import { createLogger } from '../core/logger';
import { uniqueFolderName } from './instance-folder-name';
import { isFilesBusyError, moveTreeByFiles, removeEmptyTree, renameWithRetries, restoreMovedFiles, type MovedPath } from './tree-move';

const LEGACY_FOLDER = 'instances';

const log = createLogger('instances');

export function legacyProfilesFolder(paths: GamePaths): string {
  return path.join(paths.root, LEGACY_FOLDER);
}

export function legacyProfileRelativePath(folder: string): string {
  return path.join('..', LEGACY_FOLDER, folder);
}

async function moveFolder(source: string, target: string, moved: MovedPath[]): Promise<void> {
  try {
    await renameWithRetries(source, target);
    moved.push({ from: source, to: target });
  } catch (error) {
    if (!isFilesBusyError(error)) throw error;
    await moveTreeByFiles(source, target, { moved });
  }
}

export async function migrateLegacyProfiles(paths: GamePaths): Promise<void> {
  const legacy = legacyProfilesFolder(paths);
  if ((await listDirectory(legacy)).length === 0) {
    await fs.rmdir(legacy).catch(() => undefined);
    return;
  }
  const moved: MovedPath[] = [];
  const hadProfiles = await pathExists(paths.profiles);
  try {
    if (hadProfiles) {
      const taken = new Set((await listDirectory(paths.profiles)).map((name) => name.toLowerCase()));
      for (const folder of await listDirectory(legacy)) {
        await moveFolder(path.join(legacy, folder), paths.instanceDir(uniqueFolderName(folder, taken)), moved);
      }
    } else {
      await moveFolder(legacy, paths.profiles, moved);
    }
  } catch (error) {
    const failed = await restoreMovedFiles(moved);
    if (failed.length > 0) log.error(`Could not return ${failed.length} files to ${legacy}`);
    if (!hadProfiles) await removeEmptyTree(paths.profiles);
    throw error;
  }
  await fs.rmdir(legacy).catch(() => undefined);
}
