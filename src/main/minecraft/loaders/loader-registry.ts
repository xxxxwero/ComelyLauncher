import path from 'node:path';
import { LauncherError } from '../../../shared/errors';
import type { LoaderType } from '../../../shared/types/instances';
import type { LoaderVersionEntry } from '../../../shared/types/versions';
import { pathExists, readJsonFile, writeJsonFile } from '../../core/file-system';
import type { GamePaths } from '../../core/game-paths';
import { ForgeLoader } from './forge-loader';
import type { LoaderInstaller, ModLoaderType } from './loader-types';
import { MetaProfileLoader } from './meta-profile-loader';
import { NeoForgeLoader } from './neoforge-loader';

type InstallRecords = Record<string, string>;

export class LoaderRegistry {
  private readonly installers = new Map<ModLoaderType, LoaderInstaller>();

  constructor() {
    this.register(new MetaProfileLoader('fabric', 'https://meta.fabricmc.net/v2'));
    this.register(new MetaProfileLoader('quilt', 'https://meta.quiltmc.org/v3'));
    this.register(new ForgeLoader());
    this.register(new NeoForgeLoader());
  }

  register(installer: LoaderInstaller): void {
    this.installers.set(installer.type, installer);
  }

  get(type: ModLoaderType): LoaderInstaller {
    const installer = this.installers.get(type);
    if (!installer) throw new LauncherError('loader-unavailable', `Loader ${type} is not supported`, { loader: type });
    return installer;
  }

  async listVersions(type: LoaderType, gameVersion: string): Promise<LoaderVersionEntry[]> {
    if (type === 'vanilla') return [];
    return this.get(type).listVersions(gameVersion);
  }

  async resolveVersion(type: ModLoaderType, gameVersion: string, preferred: string | null): Promise<string> {
    const versions = await this.listVersions(type, gameVersion);
    if (preferred && versions.some((entry) => entry.version === preferred)) return preferred;
    const chosen = versions.find((entry) => entry.stable) ?? versions[0];
    if (!chosen) throw new LauncherError('loader-unavailable', `${type} is not available for ${gameVersion}`, { loader: type, version: gameVersion });
    return chosen.version;
  }

  async installedVersionId(paths: GamePaths, type: ModLoaderType, gameVersion: string, loaderVersion: string): Promise<string | null> {
    const records = await readJsonFile<InstallRecords>(this.recordsFile(paths), {});
    const versionId = records[this.recordKey(type, gameVersion, loaderVersion)];
    if (!versionId || !(await pathExists(paths.versionJson(versionId)))) return null;
    return versionId;
  }

  async findInstalled(paths: GamePaths, type: ModLoaderType, gameVersion: string, preferred: string | null): Promise<{ versionId: string; loaderVersion: string } | null> {
    const records = await readJsonFile<InstallRecords>(this.recordsFile(paths), {});
    const prefix = this.recordKey(type, gameVersion, '');
    for (const [key, versionId] of Object.entries(records).reverse()) {
      if (!key.startsWith(prefix)) continue;
      const loaderVersion = key.slice(prefix.length);
      if (preferred && preferred !== loaderVersion) continue;
      if (await pathExists(paths.versionJson(versionId))) return { versionId, loaderVersion };
    }
    return null;
  }

  async rememberInstall(paths: GamePaths, type: ModLoaderType, gameVersion: string, loaderVersion: string, versionId: string): Promise<void> {
    const file = this.recordsFile(paths);
    const records = await readJsonFile<InstallRecords>(file, {});
    records[this.recordKey(type, gameVersion, loaderVersion)] = versionId;
    await writeJsonFile(file, records);
  }

  private recordsFile(paths: GamePaths): string {
    return path.join(paths.cache, 'loader-installs.json');
  }

  private recordKey(type: ModLoaderType, gameVersion: string, loaderVersion: string): string {
    return `${type}|${gameVersion}|${loaderVersion}`;
  }
}
