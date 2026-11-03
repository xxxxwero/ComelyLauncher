import path from 'node:path';
import type { LoaderVersionEntry } from '../../../shared/types/versions';
import { fetchJson, fetchText } from '../../core/http';
import { downloadFile } from '../../downloads/download-manager';
import { compareNumericVersions, isAtLeast } from '../game-version-order';
import { ForgeInstallerProfile } from './forge-installer-profile';
import type { LoaderInstallContext, LoaderInstaller } from './loader-types';

const FORGE_MAVEN = 'https://maven.minecraftforge.net/net/minecraftforge/forge';
const PROMOTIONS_URL = 'https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json';

export class ForgeLoader implements LoaderInstaller {
  readonly type = 'forge' as const;

  async listVersions(gameVersion: string): Promise<LoaderVersionEntry[]> {
    if (!isAtLeast(gameVersion, '1.7.10')) return [];
    const metadata = await fetchText(`${FORGE_MAVEN}/maven-metadata.xml`);
    const prefix = `${gameVersion}-`;
    const versions = [...metadata.matchAll(/<version>([^<]+)<\/version>/g)]
      .map((match) => match[1])
      .filter((version) => version.startsWith(prefix));
    const promotions = await fetchJson<{ promos: Record<string, string> }>(PROMOTIONS_URL).catch(() => ({ promos: {} as Record<string, string> }));
    const preferred = promotions.promos[`${gameVersion}-recommended`] ?? promotions.promos[`${gameVersion}-latest`];
    return versions
      .sort((a, b) => compareNumericVersions(b.slice(prefix.length), a.slice(prefix.length)))
      .map((version) => ({ version, stable: preferred ? version.slice(prefix.length).startsWith(preferred) : false }));
  }

  async install(context: LoaderInstallContext): Promise<string> {
    const version = context.loaderVersion;
    const installer = path.join(context.paths.cache, 'installers', `forge-${version}-installer.jar`);
    await downloadFile({ url: `${FORGE_MAVEN}/${version}/forge-${version}-installer.jar`, destination: installer }, { ...context.download, verification: 'size' });
    return new ForgeInstallerProfile(installer).install(context);
  }
}
