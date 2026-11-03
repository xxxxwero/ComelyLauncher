import { shell } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { LauncherError } from '../../shared/errors';
import type { ContentKind, InstalledContent } from '../../shared/types/instances';
import { listDirectory, pathExists, sha1OfFile } from '../core/file-system';
import type { InstanceService } from '../instances/instance-service';
import { contentKey, readContentIndex, writeContentIndex, type ContentRecord } from './content-index';
import { CONTENT_EXTENSIONS, CONTENT_FOLDERS, CONTENT_KINDS, DISABLED_SUFFIX, modrinthLoaders } from './content-kinds';
import type { ModrinthClient, ModrinthVersion } from './modrinth-client';

interface ContentFile {
  kind: ContentKind;
  fileName: string;
  actualName: string;
  enabled: boolean;
  sizeBytes: number;
}

const PROJECT_PAGES: Record<string, string> = {
  mod: 'mod',
  resourcepack: 'resourcepack',
  shader: 'shader'
};

function displayTitle(fileName: string): string {
  return fileName.replace(/\.(jar|zip)$/i, '');
}

export class InstalledContentService {
  private readonly updates = new Map<string, Map<string, ModrinthVersion>>();

  constructor(
    private readonly instances: InstanceService,
    private readonly modrinth: ModrinthClient
  ) {}

  folder(instanceId: string, kind: ContentKind): string {
    return path.join(this.instances.dir(instanceId), CONTENT_FOLDERS[kind]);
  }

  async list(instanceId: string): Promise<InstalledContent[]> {
    const instanceDir = this.instances.dir(instanceId);
    const index = await readContentIndex(instanceDir);
    const pending = this.updates.get(instanceId) ?? new Map<string, ModrinthVersion>();
    const files = await this.scan(instanceId);
    return files.map((file) => {
      const key = contentKey(file.kind, file.fileName);
      const record = index[key];
      const update = pending.get(key) ?? null;
      return {
        fileName: file.fileName,
        kind: file.kind,
        enabled: file.enabled,
        sizeBytes: file.sizeBytes,
        title: record?.title ?? displayTitle(file.fileName),
        author: record?.author ?? null,
        projectId: record?.projectId ?? null,
        versionNumber: record?.versionNumber ?? null,
        iconUrl: record?.iconUrl ?? null,
        pageUrl: record?.slug ? `https://modrinth.com/${PROJECT_PAGES[record.projectType] ?? 'project'}/${record.slug}` : null,
        updateVersionId: update?.id ?? null,
        updateVersionNumber: update?.version_number ?? null
      };
    });
  }

  async installedProjectIds(instanceId: string): Promise<Set<string>> {
    const index = await readContentIndex(this.instances.dir(instanceId));
    const present = new Set((await this.scan(instanceId)).map((file) => contentKey(file.kind, file.fileName)));
    return new Set(Object.entries(index).filter(([key]) => present.has(key)).map(([, record]) => record.projectId));
  }

  async setEnabled(instanceId: string, kind: ContentKind, fileNames: string[], enabled: boolean): Promise<InstalledContent[]> {
    const folder = this.folder(instanceId, kind);
    for (const fileName of fileNames) {
      const enabledPath = path.join(folder, fileName);
      const disabledPath = enabledPath + DISABLED_SUFFIX;
      if (enabled && (await pathExists(disabledPath))) await fs.rename(disabledPath, enabledPath);
      if (!enabled && (await pathExists(enabledPath))) await fs.rename(enabledPath, disabledPath);
    }
    await this.instances.emitChanged();
    return this.list(instanceId);
  }

  async remove(instanceId: string, kind: ContentKind, fileNames: string[]): Promise<InstalledContent[]> {
    const instanceDir = this.instances.dir(instanceId);
    const index = await readContentIndex(instanceDir);
    for (const fileName of fileNames) {
      const file = await this.actualPath(instanceId, kind, fileName);
      if (file) await shell.trashItem(file).catch(() => fs.rm(file, { force: true }));
      delete index[contentKey(kind, fileName)];
      this.updates.get(instanceId)?.delete(contentKey(kind, fileName));
    }
    await writeContentIndex(instanceDir, index);
    await this.instances.emitChanged();
    return this.list(instanceId);
  }

  async reveal(instanceId: string, kind: ContentKind, fileName: string): Promise<void> {
    const file = await this.actualPath(instanceId, kind, fileName);
    if (!file) throw new LauncherError('invalid-input', `File ${fileName} not found`);
    shell.showItemInFolder(file);
  }

  async record(instanceId: string, kind: ContentKind, fileName: string, record: ContentRecord): Promise<void> {
    const instanceDir = this.instances.dir(instanceId);
    const index = await readContentIndex(instanceDir);
    index[contentKey(kind, fileName)] = record;
    await writeContentIndex(instanceDir, index);
  }

  private async hashContent(instanceId: string): Promise<Map<string, ContentFile>> {
    const hashes = new Map<string, ContentFile>();
    for (const file of await this.scan(instanceId)) hashes.set(await sha1OfFile(path.join(this.folder(instanceId, file.kind), file.actualName)), file);
    return hashes;
  }

  async identifyContent(instanceId: string): Promise<void> {
    await this.identify(this.instances.dir(instanceId), await this.hashContent(instanceId));
  }

  async checkUpdates(instanceId: string): Promise<InstalledContent[]> {
    const instance = await this.instances.get(instanceId);
    const hashes = await this.hashContent(instanceId);
    await this.identify(this.instances.dir(instanceId), hashes);

    const found = new Map<string, ModrinthVersion>();
    for (const kind of CONTENT_KINDS) {
      const kindHashes = [...hashes.entries()].filter(([, file]) => file.kind === kind).map(([hash]) => hash);
      const loaders = modrinthLoaders(kind, instance.loader.type) ?? [];
      if (kind === 'mod' && loaders.length === 0) continue;
      const latest = await this.modrinth.latestVersionsByHashes(kindHashes, loaders, [instance.gameVersion]);
      for (const [hash, version] of Object.entries(latest)) {
        const file = hashes.get(hash);
        if (file && !version.files.some((entry) => entry.hashes.sha1 === hash)) found.set(contentKey(file.kind, file.fileName), version);
      }
    }
    this.updates.set(instanceId, found);
    return this.list(instanceId);
  }

  pendingUpdate(instanceId: string, kind: ContentKind, fileName: string): ModrinthVersion | null {
    return this.updates.get(instanceId)?.get(contentKey(kind, fileName)) ?? null;
  }

  clearUpdate(instanceId: string, kind: ContentKind, fileName: string): void {
    this.updates.get(instanceId)?.delete(contentKey(kind, fileName));
  }

  async actualPath(instanceId: string, kind: ContentKind, fileName: string): Promise<string | null> {
    const enabledPath = path.join(this.folder(instanceId, kind), fileName);
    if (await pathExists(enabledPath)) return enabledPath;
    if (await pathExists(enabledPath + DISABLED_SUFFIX)) return enabledPath + DISABLED_SUFFIX;
    return null;
  }

  private async identify(instanceDir: string, hashes: Map<string, ContentFile>): Promise<void> {
    const index = await readContentIndex(instanceDir);
    const unknown = [...hashes.entries()].filter(([, file]) => !index[contentKey(file.kind, file.fileName)]);
    if (unknown.length === 0) return;
    const versions = await this.modrinth.versionsByHashes(unknown.map(([hash]) => hash));
    const projects = await this.modrinth.projects([...new Set(Object.values(versions).map((version) => version.project_id))]).catch(() => []);
    for (const [hash, file] of unknown) {
      const version = versions[hash];
      const project = version ? projects.find((entry) => entry.id === version.project_id) : undefined;
      if (!version || !project) continue;
      index[contentKey(file.kind, file.fileName)] = {
        projectId: project.id,
        versionId: version.id,
        versionNumber: version.version_number,
        title: project.title,
        author: null,
        slug: project.slug,
        projectType: project.project_type,
        iconUrl: project.icon_url
      };
    }
    await writeContentIndex(instanceDir, index);
  }

  private async scan(instanceId: string): Promise<ContentFile[]> {
    const result: ContentFile[] = [];
    for (const kind of CONTENT_KINDS) {
      const folder = this.folder(instanceId, kind);
      for (const name of await listDirectory(folder)) {
        const enabled = !name.endsWith(DISABLED_SUFFIX);
        const fileName = enabled ? name : name.slice(0, -DISABLED_SUFFIX.length);
        if (!CONTENT_EXTENSIONS[kind].some((extension) => fileName.toLowerCase().endsWith(extension))) continue;
        const stat = await fs.stat(path.join(folder, name)).catch(() => null);
        if (!stat?.isFile()) continue;
        result.push({ kind, fileName, actualName: name, enabled, sizeBytes: stat.size });
      }
    }
    return result.sort((a, b) => a.fileName.localeCompare(b.fileName));
  }
}
