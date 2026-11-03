import { shell } from 'electron';
import fs from 'node:fs/promises';
import type { MinecraftVersionEntry } from '../../shared/types/versions';
import { listDirectory, pathExists } from '../core/file-system';
import type { SettingsService } from '../settings/settings-service';
import type { VersionManifestService } from './version-manifest';

export class VersionCatalog {
  constructor(
    private readonly settings: SettingsService,
    private readonly manifest: VersionManifestService
  ) {}

  async list(refresh: boolean): Promise<MinecraftVersionEntry[]> {
    const paths = this.settings.gamePaths();
    const installed = new Set<string>();
    for (const id of await listDirectory(paths.versions)) {
      if ((await pathExists(paths.versionJson(id))) && (await pathExists(paths.versionJar(id)))) installed.add(id);
    }
    const entries = await this.manifest.entries(refresh);
    return entries.map((entry) => ({ id: entry.id, type: entry.type, releaseTime: entry.releaseTime, installed: installed.has(entry.id) }));
  }

  async openFolder(versionId: string): Promise<void> {
    const dir = this.settings.gamePaths().versionDir(versionId);
    await fs.mkdir(dir, { recursive: true });
    await shell.openPath(dir);
  }
}
