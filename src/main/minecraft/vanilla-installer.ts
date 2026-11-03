import fs from 'node:fs/promises';
import path from 'node:path';
import { LauncherError } from '../../shared/errors';
import { ensureDir, fileSize, isFileValid, pathExists } from '../core/file-system';
import type { GamePaths } from '../core/game-paths';
import { allFilesPresent, downloadFile, downloadFiles } from '../downloads/download-manager';
import type { DownloadOptions, DownloadRequest } from '../downloads/download-types';
import { areAssetsPresent, installAssetIndex, installAssetObjects } from './assets';
import { extractNatives, libraryDownloads, missingLocalLibraries, resolveLibraries } from './libraries';
import type { VersionManifestService } from './version-manifest';
import type { ResolvedVersion } from './version-json';

export class VanillaInstaller {
  constructor(private readonly manifest: VersionManifestService) {}

  async installVersionJson(paths: GamePaths, versionId: string, signal?: AbortSignal): Promise<void> {
    const target = paths.versionJson(versionId);
    const entry = await this.manifest.find(versionId);
    if (!entry) {
      if (await pathExists(target)) return;
      throw new LauncherError('install-failed', `Unknown Minecraft version ${versionId}`, { version: versionId });
    }
    if (await isFileValid(target, { sha1: entry.sha1 })) return;
    await downloadFile({ url: entry.url, destination: target, sha1: entry.sha1 }, { signal });
  }

  private clientRequests(paths: GamePaths, version: ResolvedVersion): DownloadRequest[] {
    const requests: DownloadRequest[] = [];
    if (version.clientDownload) {
      requests.push({
        url: version.clientDownload.url,
        destination: paths.versionJar(version.jarSourceId),
        sha1: version.clientDownload.sha1,
        size: version.clientDownload.size
      });
    }
    const logging = version.logging?.client;
    if (logging) {
      requests.push({ url: logging.file.url, destination: paths.logConfig(logging.file.id), sha1: logging.file.sha1, size: logging.file.size });
    }
    return requests;
  }

  async isInstalled(paths: GamePaths, version: ResolvedVersion): Promise<boolean> {
    if (!version.assetIndex && version.assets) return false;
    const libraries = resolveLibraries(version.libraries, paths);
    if (!(await pathExists(paths.versionJar(version.jarVersionId)))) return false;
    if (libraries.natives.length > 0 && !(await pathExists(paths.nativesDir(version.id)))) return false;
    if ((await missingLocalLibraries(libraries)).length > 0) return false;
    if (!(await allFilesPresent([...this.clientRequests(paths, version), ...libraryDownloads(libraries)]))) return false;
    return version.assetIndex ? areAssetsPresent(paths, version.assetIndex) : true;
  }

  async installClient(paths: GamePaths, version: ResolvedVersion, options: DownloadOptions): Promise<void> {
    await downloadFiles(this.clientRequests(paths, version), options);
    if (!(await pathExists(paths.versionJar(version.jarSourceId)))) {
      throw new LauncherError('install-failed', `Client jar for ${version.jarSourceId} is missing`, { version: version.jarSourceId });
    }
  }

  async installLibraries(paths: GamePaths, version: ResolvedVersion, options: DownloadOptions): Promise<void> {
    const resolved = resolveLibraries(version.libraries, paths);
    await downloadFiles(libraryDownloads(resolved), options);
    const missing = await missingLocalLibraries(resolved);
    if (missing.length > 0) {
      throw new LauncherError('install-failed', `Missing libraries: ${missing.slice(0, 3).join(', ')}`, { library: missing[0] });
    }
  }

  async linkClientJar(paths: GamePaths, version: ResolvedVersion): Promise<void> {
    if (version.jarVersionId === version.jarSourceId) return;
    const source = paths.versionJar(version.jarSourceId);
    const target = paths.versionJar(version.jarVersionId);
    const expected = await fileSize(source);
    if (expected === null) throw new LauncherError('install-failed', `Client jar ${version.jarSourceId} is missing`, { version: version.jarSourceId });
    if ((await fileSize(target)) === expected) return;
    await ensureDir(path.dirname(target));
    await fs.copyFile(source, target);
  }

  async installNatives(paths: GamePaths, version: ResolvedVersion): Promise<void> {
    const resolved = resolveLibraries(version.libraries, paths);
    await extractNatives(resolved.natives, paths.nativesDir(version.id));
  }

  async installAssets(paths: GamePaths, version: ResolvedVersion, options: DownloadOptions): Promise<void> {
    if (!version.assetIndex) return;
    await installAssetIndex(paths, version.assetIndex, options.signal);
    await installAssetObjects(paths, version.assetIndex.id, options);
  }
}
