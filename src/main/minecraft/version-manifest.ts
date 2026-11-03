import path from 'node:path';
import { LauncherError } from '../../shared/errors';
import type { MinecraftVersionType } from '../../shared/types/versions';
import { readJsonFile, writeJsonFile } from '../core/file-system';
import type { GamePaths } from '../core/game-paths';
import { fetchJson } from '../core/http';

const MANIFEST_URL = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';
const CACHE_TTL_MS = 10 * 60 * 1000;

export interface ManifestEntry {
  id: string;
  type: MinecraftVersionType;
  url: string;
  time: string;
  releaseTime: string;
  sha1: string;
}

interface ManifestFile {
  latest: { release: string; snapshot: string };
  versions: ManifestEntry[];
}

export class VersionManifestService {
  private manifest: ManifestFile | null = null;
  private loadedAt = 0;

  constructor(private readonly paths: () => GamePaths) {}

  async entries(refresh = false): Promise<ManifestEntry[]> {
    return (await this.load(refresh)).versions;
  }

  async latestRelease(): Promise<string> {
    return (await this.load(false)).latest.release;
  }

  async find(versionId: string): Promise<ManifestEntry | null> {
    const manifest = await this.load(false).catch(() => null);
    return manifest?.versions.find((entry) => entry.id === versionId) ?? null;
  }

  private async load(refresh: boolean): Promise<ManifestFile> {
    if (this.manifest && !refresh && Date.now() - this.loadedAt < CACHE_TTL_MS) return this.manifest;
    const cacheFile = path.join(this.paths().cache, 'version_manifest_v2.json');
    try {
      const manifest = await fetchJson<ManifestFile>(MANIFEST_URL, { timeoutMs: 20000 });
      await writeJsonFile(cacheFile, manifest);
      this.remember(manifest);
      return manifest;
    } catch (error) {
      if (this.manifest) return this.manifest;
      const cached = await readJsonFile<ManifestFile | null>(cacheFile, null);
      if (cached) {
        this.remember(cached);
        return cached;
      }
      throw LauncherError.from(error);
    }
  }

  private remember(manifest: ManifestFile): void {
    this.manifest = manifest;
    this.loadedAt = Date.now();
  }
}
