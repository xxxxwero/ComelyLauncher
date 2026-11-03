import fs from 'node:fs/promises';
import path from 'node:path';
import { LauncherError } from '../../shared/errors';
import type { ContentProjectType, ContentSearchQuery, ContentSearchResult } from '../../shared/types/content';
import type { SettingsService } from '../settings/settings-service';
import { downloadFile } from '../downloads/download-manager';
import type { InstanceService } from '../instances/instance-service';
import type { StepDefinition, TaskManager } from '../tasks/task-manager';
import { kindForProjectType, modrinthLoaders } from './content-kinds';
import type { InstalledContentService } from './installed-content-service';
import { pickBestVersion, primaryFile, type ModrinthClient } from './modrinth-client';
import { ModpackImporter } from './import/modpack-importer';
import { listModrinthProfiles } from './import/modrinth-app-profiles';
import { ProjectInstaller } from './project-installer';

const PAGE_SIZE = 20;

const CONTENT_STEPS: StepDefinition[] = [
  { id: 'resolve', label: { key: 'tasks.step.resolve' }, weight: 1 },
  { id: 'download', label: { key: 'tasks.step.download' }, weight: 4 },
  { id: 'dependencies', label: { key: 'tasks.step.dependencies' }, weight: 2 }
];

const MODPACK_STEPS: StepDefinition[] = [
  { id: 'download', label: { key: 'tasks.step.download' }, weight: 2 },
  { id: 'read', label: { key: 'tasks.step.readModpack' }, weight: 1 },
  { id: 'files', label: { key: 'tasks.step.modpackFiles' }, weight: 6 },
  { id: 'overrides', label: { key: 'tasks.step.overrides' }, weight: 1 }
];

export class ContentService {
  private readonly importer: ModpackImporter;
  private readonly projects: ProjectInstaller;

  constructor(
    private readonly settings: SettingsService,
    private readonly instances: InstanceService,
    private readonly installed: InstalledContentService,
    private readonly modrinth: ModrinthClient,
    private readonly tasks: TaskManager
  ) {
    this.importer = new ModpackImporter(settings, instances, installed);
    this.projects = new ProjectInstaller(settings, installed, modrinth);
  }

  async search(query: ContentSearchQuery): Promise<ContentSearchResult> {
    const instance = query.instanceId ? await this.instances.get(query.instanceId).catch(() => null) : null;
    const facets: string[][] = [[`project_type:${query.type}`]];
    const kind = kindForProjectType(query.type);
    if (query.compatibleOnly && instance && kind) {
      facets.push([`versions:${instance.gameVersion}`]);
      const loaders = modrinthLoaders(kind, instance.loader.type);
      if (kind === 'mod' && loaders?.length === 0) return { hits: [], total: 0, offset: query.offset };
      if (kind === 'mod' && loaders) facets.push(loaders.map((loader) => `categories:${loader}`));
    }
    const response = await this.modrinth.search({
      query: query.text.trim(),
      facets,
      index: query.sort,
      offset: query.offset,
      limit: PAGE_SIZE
    });
    const installedIds = instance ? await this.installed.installedProjectIds(instance.id) : new Set<string>();
    return {
      total: response.total_hits,
      offset: response.offset,
      hits: response.hits.map((hit) => ({
        projectId: hit.project_id,
        slug: hit.slug,
        title: hit.title,
        author: hit.author,
        description: hit.description,
        iconUrl: hit.icon_url || null,
        downloads: hit.downloads,
        categories: hit.categories,
        gameVersions: hit.versions,
        projectType: query.type,
        installed: installedIds.has(hit.project_id)
      }))
    };
  }

  async install(instanceId: string, projectId: string, type: ContentProjectType): Promise<string> {
    if (type === 'modpack') return this.installModpack(projectId);
    const kind = kindForProjectType(type);
    if (!kind) throw new LauncherError('invalid-input', `Unsupported content type ${type}`);
    const instance = await this.instances.get(instanceId);
    const [project] = await this.modrinth.projects([projectId]);
    if (!project) throw new LauncherError('invalid-input', 'Project not found');
    const task = this.tasks.create({
      kind: 'content-install',
      title: { key: 'tasks.installContent', params: { name: project.title, instance: instance.name } },
      instanceId,
      steps: CONTENT_STEPS
    });
    return this.tasks.runInBackground(task, async (handle) => {
      await this.projects.install(instance, project, kind, handle);
      await this.instances.emitChanged();
    });
  }

  async update(instanceId: string, fileNames: string[]): Promise<string> {
    const instance = await this.instances.get(instanceId);
    const items = (await this.installed.list(instanceId)).filter((item) => fileNames.includes(item.fileName) && item.updateVersionId);
    const task = this.tasks.create({
      kind: 'content-update',
      title: { key: 'tasks.updateContent', params: { count: items.length, instance: instance.name } },
      instanceId,
      steps: [
        { id: 'download', label: { key: 'tasks.step.download' }, weight: 4 },
        { id: 'dependencies', label: { key: 'tasks.step.dependencies' }, weight: 1 }
      ]
    });
    return this.tasks.runInBackground(task, async (handle) => {
      handle.startStep('download');
      for (const [position, item] of items.entries()) {
        const version = this.installed.pendingUpdate(instanceId, item.kind, item.fileName);
        const file = version ? primaryFile(version) : null;
        if (!version || !file) continue;
        handle.setCurrentFile(file.filename);
        const oldPath = await this.installed.actualPath(instanceId, item.kind, item.fileName);
        const disabled = oldPath?.endsWith('.disabled') ?? false;
        const target = path.join(this.installed.folder(instanceId, item.kind), file.filename + (disabled ? '.disabled' : ''));
        await downloadFile({ url: file.url, destination: target, sha1: file.hashes.sha1, size: file.size }, { signal: handle.signal });
        if (oldPath && path.resolve(oldPath) !== path.resolve(target)) await fs.rm(oldPath, { force: true });
        await this.installed.record(instanceId, item.kind, file.filename, {
          projectId: version.project_id,
          versionId: version.id,
          versionNumber: version.version_number,
          title: item.title,
          author: item.author,
          slug: item.pageUrl?.split('/').pop() ?? null,
          projectType: item.kind === 'shaderpack' ? 'shader' : item.kind,
          iconUrl: item.iconUrl
        });
        this.installed.clearUpdate(instanceId, item.kind, item.fileName);
        handle.setStepProgress('download', (position + 1) / items.length);
      }
      handle.startStep('dependencies');
      await this.projects.installMissingDependencies(instance, handle);
      await this.instances.emitChanged();
    });
  }

  async installModpack(projectId: string): Promise<string> {
    const [project] = await this.modrinth.projects([projectId]);
    if (!project) throw new LauncherError('invalid-input', 'Modpack not found');
    const task = this.tasks.create({ kind: 'modpack-install', title: { key: 'tasks.installModpack', params: { name: project.title } }, steps: MODPACK_STEPS });
    return this.tasks.runInBackground(task, async (handle) => {
      handle.startStep('download');
      const version = pickBestVersion(await this.modrinth.projectVersions(projectId, null, null));
      const file = version ? primaryFile(version) : null;
      if (!file) throw new LauncherError('modpack-invalid', 'Modpack has no files');
      const target = path.join(this.settings.gamePaths().cache, 'modpacks', file.filename);
      await downloadFile({ url: file.url, destination: target, sha1: file.hashes.sha1, size: file.size }, { signal: handle.signal, onProgress: handle.downloadReporter('download') });
      const instance = await this.importer.importArchive(target, handle);
      await this.instances.select(instance.id);
    });
  }

  importModpackFile(file: string): string {
    const task = this.tasks.create({
      kind: 'modpack-install',
      title: { key: 'tasks.importModpack', params: { name: path.basename(file) } },
      steps: MODPACK_STEPS.filter((step) => step.id !== 'download')
    });
    return this.tasks.runInBackground(task, async (handle) => {
      const instance = await this.importer.importArchive(file, handle);
      await this.instances.select(instance.id);
    });
  }

  async importModrinthProfile(profileId: string): Promise<string> {
    const profile = (await listModrinthProfiles()).find((entry) => entry.id === profileId);
    if (!profile) throw new LauncherError('modpack-invalid', `Modrinth App profile ${profileId} not found`);
    const task = this.tasks.create({
      kind: 'modpack-install',
      title: { key: 'tasks.importModpack', params: { name: profile.name } },
      steps: MODPACK_STEPS.filter((step) => step.id !== 'download')
    });
    return this.tasks.runInBackground(task, async (handle) => {
      const instance = await this.importer.importModrinthProfile(profile, handle);
      await this.instances.select(instance.id);
    });
  }

  importInstanceFolder(folder: string): string {
    const task = this.tasks.create({
      kind: 'modpack-install',
      title: { key: 'tasks.importModpack', params: { name: path.basename(folder) } },
      steps: MODPACK_STEPS.filter((step) => step.id !== 'download')
    });
    return this.tasks.runInBackground(task, async (handle) => {
      const instance = await this.importer.importFolder(folder, handle);
      await this.instances.select(instance.id);
    });
  }
}
