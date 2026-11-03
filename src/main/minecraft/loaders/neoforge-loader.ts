import path from 'node:path';
import type { LoaderVersionEntry } from '../../../shared/types/versions';
import { fetchJson } from '../../core/http';
import { downloadFile } from '../../downloads/download-manager';
import { compareNumericVersions, isAtLeast, isReleaseVersionId } from '../game-version-order';
import { ForgeInstallerProfile } from './forge-installer-profile';
import type { LoaderInstallContext, LoaderInstaller } from './loader-types';

const NEOFORGE_MAVEN = 'https://maven.neoforged.net/releases/net/neoforged/neoforge';
const NEOFORGE_VERSIONS_API = 'https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge';

function versionPrefixes(gameVersion: string): string[] {
  const parts = gameVersion.split('.');
  if (parts[0] === '1') return [`${parts[1]}.${parts[2] ?? '0'}.`];
  if (parts.length === 2) return [`${gameVersion}.0.`, `${gameVersion}.`];
  return [`${gameVersion}.`];
}

export class NeoForgeLoader implements LoaderInstaller {
  readonly type = 'neoforge' as const;

  async listVersions(gameVersion: string): Promise<LoaderVersionEntry[]> {
    if (!isReleaseVersionId(gameVersion) || (gameVersion.startsWith('1.') && !isAtLeast(gameVersion, '1.20.2'))) return [];
    const response = await fetchJson<{ versions: string[] }>(NEOFORGE_VERSIONS_API);
    for (const prefix of versionPrefixes(gameVersion)) {
      const matching = response.versions.filter((version) => version.startsWith(prefix));
      if (matching.length === 0) continue;
      return matching
        .sort((a, b) => compareNumericVersions(b, a))
        .map((version) => ({ version, stable: !/beta|alpha/i.test(version) }));
    }
    return [];
  }

  async install(context: LoaderInstallContext): Promise<string> {
    const version = context.loaderVersion;
    const installer = path.join(context.paths.cache, 'installers', `neoforge-${version}-installer.jar`);
    await downloadFile({ url: `${NEOFORGE_MAVEN}/${version}/neoforge-${version}-installer.jar`, destination: installer }, { ...context.download, verification: 'size' });
    return new ForgeInstallerProfile(installer).install(context);
  }
}
