import { randomBytes } from 'node:crypto';
import { shell } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { LauncherError } from '../../shared/errors';
import type { Instance, InstanceDraft, InstanceFolder, InstancePatch, LoaderType } from '../../shared/types/instances';
import { listDirectory, pathExists } from '../core/file-system';
import { createLogger } from '../core/logger';
import type { RendererEvents } from '../core/renderer-events';
import type { SettingsService } from '../settings/settings-service';
import {
  countInstanceContent,
  ensureInstanceLayout,
  readStoredInstances,
  writeStoredInstance,
  type StoredInstance
} from './instance-store';
import { uniqueFolderName } from './instance-folder-name';
import { migrateLegacyProfiles } from './legacy-profiles';

const LEGACY_FOLDER_NAME = /^inst-[a-z0-9]+$/;
const log = createLogger('instances');

export const INSTANCE_COVERS = ['s1', 's2', 's3', 's4', 's5', 's6', 'sakura', 'autumn', 'snow'];

const LOADER_TITLES: Record<LoaderType, string> = {
  vanilla: 'Vanilla',
  fabric: 'Fabric',
  quilt: 'Quilt',
  forge: 'Forge',
  neoforge: 'NeoForge'
};

export function createInstanceId(): string {
  return `inst-${Date.now().toString(36)}${randomBytes(3).toString('hex')}`;
}

function validateName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  if (trimmed.length === 0 || trimmed.length > 48) throw new LauncherError('invalid-input', 'Instance name must be 1-48 characters');
  return trimmed;
}

export class InstanceService {
  private folders = new Map<string, string>();
  private readonly reservedFolders = new Map<string, string>();

  constructor(
    private readonly settings: SettingsService,
    private readonly events: RendererEvents
  ) {
    settings.onChange((current, previous) => {
      if (current.launcher.gameDirectory === previous.launcher.gameDirectory) return;
      this.folders.clear();
      void this.load().then(() => this.emitChanged());
    });
  }

  async load(): Promise<void> {
    const paths = this.settings.gamePaths();
    await migrateLegacyProfiles(paths).catch((error: unknown) => log.warn('Could not rename the instances folder', error));
    const taken = new Set((await listDirectory(paths.profiles)).map((name) => name.toLowerCase()));
    for (const { folder, instance } of await readStoredInstances(paths)) {
      if (folder !== instance.id || !LEGACY_FOLDER_NAME.test(folder)) continue;
      const target = uniqueFolderName(instance.name, taken);
      await fs.rename(paths.instanceDir(folder), paths.instanceDir(target)).catch((error: unknown) => log.warn(`Could not rename instance folder ${folder}`, error));
    }
    await this.list();
  }

  dir(instanceId: string): string {
    return this.settings.gamePaths().instanceDir(this.folders.get(instanceId) ?? this.reservedFolders.get(instanceId) ?? instanceId);
  }

  async reserveFolder(instanceId: string, name: string): Promise<string> {
    const paths = this.settings.gamePaths();
    const taken = new Set([...(await listDirectory(paths.profiles)), ...this.reservedFolders.values()].map((entry) => entry.toLowerCase()));
    this.reservedFolders.set(instanceId, uniqueFolderName(name, taken));
    return this.dir(instanceId);
  }

  releaseFolder(instanceId: string): void {
    this.reservedFolders.delete(instanceId);
  }

  async list(): Promise<Instance[]> {
    const paths = this.settings.gamePaths();
    const stored = await readStoredInstances(paths);
    this.folders = new Map(stored.map(({ folder, instance }) => [instance.id, folder]));
    const instances = await Promise.all(
      stored.map(async ({ folder, instance }) => ({ ...instance, contentCount: await countInstanceContent(paths.instanceDir(folder)) }))
    );
    return instances.sort((a, b) => (b.lastPlayedAt ?? b.createdAt) - (a.lastPlayedAt ?? a.createdAt));
  }

  async get(instanceId: string): Promise<Instance> {
    const instance = (await this.list()).find((entry) => entry.id === instanceId);
    if (!instance) throw new LauncherError('no-instance', `Instance ${instanceId} not found`);
    return instance;
  }

  async create(draft: InstanceDraft, instanceId = createInstanceId()): Promise<Instance> {
    if (!draft.gameVersion) throw new LauncherError('invalid-input', 'Game version is required');
    const existing = await this.list();
    const stored: StoredInstance = {
      id: instanceId,
      name: validateName(draft.name),
      cover: INSTANCE_COVERS.includes(draft.cover) ? draft.cover : INSTANCE_COVERS[existing.length % INSTANCE_COVERS.length],
      gameVersion: draft.gameVersion,
      loader: { type: draft.loader.type, version: draft.loader.type === 'vanilla' ? null : draft.loader.version },
      createdAt: Date.now(),
      lastPlayedAt: null,
      totalPlayTimeMs: 0,
      lastServer: null,
      installedVersionId: null
    };
    const instanceDir = this.reservedFolders.has(instanceId) ? this.dir(instanceId) : await this.reserveFolder(instanceId, stored.name);
    await ensureInstanceLayout(instanceDir);
    await writeStoredInstance(instanceDir, stored);
    this.folders.set(instanceId, path.basename(instanceDir));
    this.releaseFolder(instanceId);
    if (!this.settings.get().selectedInstanceId || existing.length === 0) await this.select(stored.id);
    await this.emitChanged();
    return this.get(stored.id);
  }

  async update(instanceId: string, patch: InstancePatch): Promise<Instance> {
    const current = await this.get(instanceId);
    const next: StoredInstance = this.toStored(current);
    if (patch.name !== undefined) next.name = validateName(patch.name);
    if (patch.cover !== undefined && INSTANCE_COVERS.includes(patch.cover)) next.cover = patch.cover;
    const versionChanged = patch.gameVersion !== undefined && patch.gameVersion !== current.gameVersion;
    const loaderChanged = patch.loader !== undefined && (patch.loader.type !== current.loader.type || patch.loader.version !== current.loader.version);
    if (versionChanged) next.gameVersion = patch.gameVersion as string;
    if (loaderChanged && patch.loader) next.loader = { type: patch.loader.type, version: patch.loader.type === 'vanilla' ? null : patch.loader.version };
    if (versionChanged || loaderChanged) {
      next.installedVersionId = null;
      if (versionChanged && !loaderChanged && next.loader.type !== 'vanilla') next.loader = { ...next.loader, version: null };
    }
    await writeStoredInstance(this.dir(instanceId), next);
    await this.emitChanged();
    return this.get(instanceId);
  }

  async remove(instanceId: string): Promise<Instance[]> {
    const dir = this.dir(instanceId);
    if (await pathExists(dir)) {
      try {
        await shell.trashItem(dir);
      } catch {
        await fs.rm(dir, { recursive: true, force: true });
      }
    }
    const remaining = await this.list();
    if (this.settings.get().selectedInstanceId === instanceId) await this.select(remaining[0]?.id ?? null);
    await this.emitChanged();
    return remaining;
  }

  async ensureForVersion(gameVersion: string, loader: LoaderType): Promise<Instance> {
    const match = (await this.list()).find((instance) => instance.gameVersion === gameVersion && instance.loader.type === loader);
    if (match) {
      await this.select(match.id);
      return match;
    }
    const created = await this.create({
      name: loader === 'vanilla' ? gameVersion : `${gameVersion} ${LOADER_TITLES[loader]}`,
      cover: '',
      gameVersion,
      loader: { type: loader, version: null }
    });
    await this.select(created.id);
    return created;
  }

  async markInstalled(instanceId: string, versionId: string, loaderVersion: string | null): Promise<void> {
    const current = this.toStored(await this.get(instanceId));
    current.installedVersionId = versionId;
    if (current.loader.type !== 'vanilla' && loaderVersion) current.loader = { ...current.loader, version: loaderVersion };
    await writeStoredInstance(this.dir(instanceId), current);
    await this.emitChanged();
  }

  async recordSession(instanceId: string, startedAt: number, playedMs: number, server: string | null): Promise<void> {
    const current = this.toStored(await this.get(instanceId));
    current.lastPlayedAt = startedAt;
    current.totalPlayTimeMs += Math.max(0, playedMs);
    if (server) current.lastServer = server;
    await writeStoredInstance(this.dir(instanceId), current);
    await this.emitChanged();
  }

  async select(instanceId: string | null): Promise<void> {
    await this.settings.update({ selectedInstanceId: instanceId });
  }

  async openFolder(instanceId: string, folder: InstanceFolder): Promise<void> {
    const target = folder === 'root' ? this.dir(instanceId) : path.join(this.dir(instanceId), folder);
    await fs.mkdir(target, { recursive: true });
    await shell.openPath(target);
  }

  async emitChanged(): Promise<void> {
    this.events.emit('instances:changed', await this.list());
  }

  private toStored(instance: Instance): StoredInstance {
    const { contentCount: _contentCount, ...stored } = instance;
    return stored;
  }
}
