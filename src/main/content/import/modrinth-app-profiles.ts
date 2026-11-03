import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { ExternalProfile } from '../../../shared/types/imports';
import type { InstanceLoader, LoaderType } from '../../../shared/types/instances';
import { copyTree, listDirectory, pathExists } from '../../core/file-system';
import { createLogger } from '../../core/logger';
import { packageName, TRANSIENT_FOLDERS, type InstancePackage } from './instance-package';

const DATABASE_FILES = ['app.db', 'app.db-wal'];
const MODS_PATTERN = /\.jar(\.disabled)?$/i;
const LOADERS: Partial<Record<string, Exclude<LoaderType, 'vanilla'>>> = {
  fabric: 'fabric',
  quilt: 'quilt',
  forge: 'forge',
  neoforge: 'neoforge'
};

const CURRENT_SCHEMA_QUERY = `
  SELECT i.path AS path, i.name AS name, s.game_version AS gameVersion, s.loader AS loader, s.loader_version AS loaderVersion
  FROM instances i JOIN instance_content_sets s ON s.id = i.applied_content_set_id`;
const LEGACY_SCHEMA_QUERY = `
  SELECT path AS path, name AS name, game_version AS gameVersion, mod_loader AS loader, mod_loader_version AS loaderVersion
  FROM profiles`;

const log = createLogger('import');

interface ProfileRow {
  path: string;
  name: string;
  gameVersion: string;
  loader: string;
  loaderVersion: string | null;
}

interface ProfileDatabase {
  rows: ProfileRow[];
  customDirectory: string | null;
}

function hasTable(database: DatabaseSync, table: string): boolean {
  return Boolean(database.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));
}

function readCustomDirectory(database: DatabaseSync): string | null {
  if (!hasTable(database, 'settings')) return null;
  const hasColumn = database.prepare('PRAGMA table_info(settings)').all().some((column) => (column as { name: string }).name === 'custom_dir');
  if (!hasColumn) return null;
  return (database.prepare('SELECT custom_dir AS directory FROM settings LIMIT 1').get() as { directory: string | null } | undefined)?.directory ?? null;
}

async function readDatabase(appDirectory: string): Promise<ProfileDatabase> {
  const snapshot = await fs.mkdtemp(path.join(os.tmpdir(), 'comely-modrinth-'));
  try {
    for (const file of DATABASE_FILES) {
      await fs.copyFile(path.join(appDirectory, file), path.join(snapshot, file)).catch(() => undefined);
    }
    const database = new DatabaseSync(path.join(snapshot, 'app.db'));
    try {
      const query = hasTable(database, 'instance_content_sets') ? CURRENT_SCHEMA_QUERY : LEGACY_SCHEMA_QUERY;
      return { rows: database.prepare(query).all() as unknown as ProfileRow[], customDirectory: readCustomDirectory(database) };
    } finally {
      database.close();
    }
  } finally {
    await fs.rm(snapshot, { recursive: true, force: true });
  }
}

function toLoader(loader: string, version: string | null, gameVersion: string): InstanceLoader {
  const type = LOADERS[loader.toLowerCase()];
  if (!type) return { type: 'vanilla', version: null };
  if (type === 'forge' && version && !version.startsWith(`${gameVersion}-`)) return { type, version: `${gameVersion}-${version}` };
  return { type, version };
}

export function defaultModrinthAppDirectory(): string {
  return path.join(process.env.APPDATA ?? '', 'ModrinthApp');
}

export async function listModrinthProfiles(appDirectory = defaultModrinthAppDirectory()): Promise<ExternalProfile[]> {
  if (!(await pathExists(path.join(appDirectory, 'app.db')))) return [];
  let database: ProfileDatabase;
  try {
    database = await readDatabase(appDirectory);
  } catch (error) {
    log.warn('Could not read Modrinth App profiles', error);
    return [];
  }
  const profilesRoot = path.join(database.customDirectory || appDirectory, 'profiles');
  const profiles: ExternalProfile[] = [];
  for (const row of database.rows) {
    const folder = path.join(profilesRoot, row.path);
    if (!row.gameVersion || !(await pathExists(folder))) continue;
    profiles.push({
      id: row.path,
      name: packageName(row.name, row.path),
      folder,
      gameVersion: row.gameVersion,
      loader: toLoader(row.loader, row.loaderVersion, row.gameVersion),
      modCount: (await listDirectory(path.join(folder, 'mods'))).filter((name) => MODS_PATTERN.test(name)).length,
      worldCount: (await listDirectory(path.join(folder, 'saves'))).length
    });
  }
  return profiles;
}

export function createModrinthProfilePackage(profile: ExternalProfile): InstancePackage {
  return {
    name: profile.name,
    gameVersion: profile.gameVersion,
    loader: profile.loader,
    async install(instanceDir, task) {
      task.startStep('files');
      await copyTree(profile.folder, instanceDir, {
        exclude: new Set(TRANSIENT_FOLDERS),
        signal: task.signal,
        onProgress: (fraction) => task.setStepProgress('files', fraction)
      });
    }
  };
}
