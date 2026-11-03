import { LauncherError } from '../../../shared/errors';
import type { LoaderVersionEntry } from '../../../shared/types/versions';
import { writeJsonFile } from '../../core/file-system';
import { fetchJson } from '../../core/http';
import type { VersionJson } from '../version-json';
import type { LoaderInstallContext, LoaderInstaller, ModLoaderType } from './loader-types';

interface MetaLoaderEntry {
  loader: { version: string; stable?: boolean };
}

const UNSTABLE_PATTERN = /(alpha|beta|pre|rc|snapshot)/i;

export class MetaProfileLoader implements LoaderInstaller {
  constructor(
    readonly type: ModLoaderType,
    private readonly metaBase: string
  ) {}

  async listVersions(gameVersion: string): Promise<LoaderVersionEntry[]> {
    try {
      const entries = await fetchJson<MetaLoaderEntry[]>(`${this.metaBase}/versions/loader/${encodeURIComponent(gameVersion)}`);
      return entries.map((entry) => ({
        version: entry.loader.version,
        stable: entry.loader.stable ?? !UNSTABLE_PATTERN.test(entry.loader.version)
      }));
    } catch (error) {
      if (error instanceof LauncherError && error.params?.status === 400) return [];
      throw error;
    }
  }

  async install(context: LoaderInstallContext): Promise<string> {
    const url = `${this.metaBase}/versions/loader/${encodeURIComponent(context.gameVersion)}/${encodeURIComponent(context.loaderVersion)}/profile/json`;
    context.reportProgress(0.2, url);
    const profile = await fetchJson<VersionJson>(url, { signal: context.download.signal });
    if (!profile.id) throw new LauncherError('loader-unavailable', `Invalid ${this.type} profile`, { loader: this.type });
    await writeJsonFile(context.paths.versionJson(profile.id), profile);
    context.reportProgress(1, null);
    return profile.id;
  }
}
