import fs from 'node:fs/promises';
import path from 'node:path';
import type { Instance } from '../../shared/types/instances';
import { listDirectory, writeJsonFile } from '../core/file-system';
import type { GamePaths } from '../core/game-paths';
import { legacyProfileRelativePath, legacyProfilesFolder } from './legacy-profiles';

export const INSTANCE_META_DIR = '.comely';
const INSTANCE_FILE = 'instance.json';
const READ_ATTEMPTS = 4;
const READ_RETRY_MS = 60;

export type StoredInstance = Omit<Instance, 'contentCount'>;

export interface StoredInstanceEntry {
  folder: string;
  instance: StoredInstance;
}

function instanceMetaFile(instanceDir: string): string {
  return path.join(instanceDir, INSTANCE_META_DIR, INSTANCE_FILE);
}

async function readInstanceFile(file: string): Promise<StoredInstance | null> {
  for (let attempt = 1; ; attempt++) {
    try {
      return JSON.parse(await fs.readFile(file, 'utf8')) as StoredInstance;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT' || attempt >= READ_ATTEMPTS) return null;
      await new Promise((resolve) => setTimeout(resolve, READ_RETRY_MS));
    }
  }
}

export async function readStoredInstances(paths: GamePaths): Promise<StoredInstanceEntry[]> {
  const result: StoredInstanceEntry[] = [];
  const seenIds = new Set<string>();
  const legacy = (await listDirectory(legacyProfilesFolder(paths))).map(legacyProfileRelativePath);
  for (const folder of [...(await listDirectory(paths.profiles)), ...legacy]) {
    const instance = await readInstanceFile(instanceMetaFile(paths.instanceDir(folder)));
    if (!instance?.id || seenIds.has(instance.id)) continue;
    seenIds.add(instance.id);
    result.push({ folder, instance });
  }
  return result;
}

export async function writeStoredInstance(instanceDir: string, instance: StoredInstance): Promise<void> {
  await writeJsonFile(instanceMetaFile(instanceDir), instance);
}

export async function countInstanceContent(instanceDir: string): Promise<number> {
  let count = 0;
  for (const folder of ['mods', 'resourcepacks', 'shaderpacks']) {
    const entries = await listDirectory(path.join(instanceDir, folder));
    count += entries.filter((entry) => /\.(jar|zip|disabled)$/i.test(entry)).length;
  }
  return count;
}

export async function ensureInstanceLayout(instanceDir: string): Promise<void> {
  await fs.mkdir(path.join(instanceDir, INSTANCE_META_DIR), { recursive: true });
}
