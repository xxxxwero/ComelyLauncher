import fs from 'node:fs/promises';
import path from 'node:path';
import { LauncherError } from '../../shared/errors';
import type { ContentKind, Instance } from '../../shared/types/instances';
import { ensureDir, listDirectory } from '../core/file-system';
import { createLogger } from '../core/logger';
import { downloadFile } from '../downloads/download-manager';
import type { DownloadProgress } from '../downloads/download-types';
import type { SettingsService } from '../settings/settings-service';
import type { TaskHandle } from '../tasks/task-manager';
import { DISABLED_SUFFIX, modrinthLoaders } from './content-kinds';
import type { InstalledContentService } from './installed-content-service';
import { findModIdCandidates } from './mod-id-lookup';
import { readModMetadata } from './mod-metadata';
import { pickBestVersion, primaryFile, type ModrinthClient, type ModrinthProject, type ModrinthVersion } from './modrinth-client';

const MAX_DEPENDENCY_DEPTH = 6;
const MAX_METADATA_PASSES = 4;
const SHADER_LOADERS = new Set(['fabric', 'quilt', 'neoforge']);
const SHADER_MOD_SLUG = 'iris';

const log = createLogger('content');

interface InstallRun {
  instance: Instance;
  task: TaskHandle;
  attempted: Set<string>;
  failed: string[];
}

interface ModsFolderScan {
  provided: Set<string>;
  missing: string[];
}

function isCancellation(error: unknown): boolean {
  return error instanceof LauncherError && error.code === 'cancelled';
}

export class ProjectInstaller {
  constructor(
    private readonly settings: SettingsService,
    private readonly installed: InstalledContentService,
    private readonly modrinth: ModrinthClient
  ) {}

  async install(instance: Instance, project: ModrinthProject, kind: ContentKind, task: TaskHandle): Promise<void> {
    const run = this.createRun(instance, task);
    task.startStep('resolve');
    const version = await this.requireVersion(instance, project, kind);
    task.startStep('download');
    await this.installVersion(run, project, kind, version, task.downloadReporter('download'));
    task.startStep('dependencies');
    if (kind === 'shaderpack') await this.installShaderMod(run);
    if (kind === 'mod') await this.installDeclaredDependencies(run, version, 0);
    if (kind !== 'resourcepack') await this.installFromModMetadata(run);
    this.throwIfFailed(run);
  }

  async installMissingDependencies(instance: Instance, task: TaskHandle): Promise<void> {
    const run = this.createRun(instance, task);
    await this.installFromModMetadata(run);
    this.throwIfFailed(run);
  }

  private createRun(instance: Instance, task: TaskHandle): InstallRun {
    return { instance, task, attempted: new Set(), failed: [] };
  }

  private throwIfFailed(run: InstallRun): void {
    if (run.failed.length > 0) {
      throw new LauncherError('dependency-missing', `Missing dependencies: ${run.failed.join(', ')}`, { name: [...new Set(run.failed)].join(', ') });
    }
  }

  private modsFolder(instance: Instance): string {
    return this.installed.folder(instance.id, 'mod');
  }

  private async findVersion(instance: Instance, project: ModrinthProject, kind: ContentKind): Promise<ModrinthVersion | null> {
    const loaders = modrinthLoaders(kind, instance.loader.type);
    if (kind === 'mod' && loaders?.length === 0) return null;
    return pickBestVersion(await this.modrinth.projectVersions(project.id, loaders, [instance.gameVersion]));
  }

  private async requireVersion(instance: Instance, project: ModrinthProject, kind: ContentKind): Promise<ModrinthVersion> {
    const version = await this.findVersion(instance, project, kind);
    if (!version || !primaryFile(version)) {
      throw new LauncherError('content-incompatible', `${project.title} is not available for this instance`, { name: project.title });
    }
    return version;
  }

  private async installVersion(
    run: InstallRun,
    project: ModrinthProject,
    kind: ContentKind,
    version: ModrinthVersion,
    onProgress: (progress: DownloadProgress) => void
  ): Promise<void> {
    const file = primaryFile(version);
    if (!file) throw new LauncherError('content-incompatible', `${project.title} has no files`, { name: project.title });
    run.attempted.add(project.id);
    const folder = this.installed.folder(run.instance.id, kind);
    await downloadFile(
      { url: file.url, destination: path.join(folder, file.filename), sha1: file.hashes.sha1, size: file.size },
      { signal: run.task.signal, onProgress }
    );
    await this.replaceOtherVersions(run.instance, kind, project.id, file.filename);
    await this.recordVersion(run.instance, kind, file.filename, project, version);
  }

  private async recordVersion(instance: Instance, kind: ContentKind, fileName: string, project: ModrinthProject, version: ModrinthVersion): Promise<void> {
    await this.installed.record(instance.id, kind, fileName, {
      projectId: project.id,
      versionId: version.id,
      versionNumber: version.version_number,
      title: project.title,
      author: null,
      slug: project.slug,
      projectType: project.project_type,
      iconUrl: project.icon_url
    });
  }

  private async replaceOtherVersions(instance: Instance, kind: ContentKind, projectId: string, keepFile: string): Promise<void> {
    const existing = (await this.installed.list(instance.id)).filter((item) => item.kind === kind && item.projectId === projectId && item.fileName !== keepFile);
    if (existing.length > 0) await this.installed.remove(instance.id, kind, existing.map((item) => item.fileName));
  }

  private async installDeclaredDependencies(run: InstallRun, version: ModrinthVersion, depth: number): Promise<void> {
    if (depth >= MAX_DEPENDENCY_DEPTH) return;
    for (const dependency of version.dependencies) {
      if (dependency.dependency_type !== 'required') continue;
      run.task.throwIfCancelled();
      const pinned = dependency.version_id ? await this.modrinth.version(dependency.version_id).catch(() => null) : null;
      const projectId = dependency.project_id ?? pinned?.project_id;
      if (!projectId || run.attempted.has(projectId)) continue;
      const [project] = await this.modrinth.projects([projectId]);
      if (project) await this.installDependency(run, project, pinned, depth);
    }
  }

  private async installDependency(run: InstallRun, project: ModrinthProject, pinned: ModrinthVersion | null, depth: number): Promise<void> {
    const { instance, task } = run;
    run.attempted.add(project.id);
    const installedIds = await this.installed.installedProjectIds(instance.id);
    const scan = await this.scanModsFolder(instance);
    if (installedIds.has(project.id) || scan.provided.has(project.slug)) return;
    try {
      const version = pinned ?? (await this.requireVersion(instance, project, 'mod'));
      task.setCurrentFile(project.title);
      await this.installVersion(run, project, 'mod', version, task.downloadReporter('dependencies'));
      await this.installDeclaredDependencies(run, version, depth + 1);
    } catch (error) {
      if (isCancellation(error)) throw error;
      log.warn(`Dependency ${project.title} failed`, error);
      run.failed.push(project.title);
    }
  }

  private async installShaderMod(run: InstallRun): Promise<void> {
    if (!SHADER_LOADERS.has(run.instance.loader.type)) return;
    const [project] = await this.modrinth.projects([SHADER_MOD_SLUG]);
    if (project) await this.installDependency(run, project, null, 0);
  }

  private async scanModsFolder(instance: Instance): Promise<ModsFolderScan> {
    const folder = this.modsFolder(instance);
    const provided = new Set<string>();
    const required = new Set<string>();
    for (const name of await listDirectory(folder)) {
      const disabled = name.endsWith(DISABLED_SUFFIX);
      if (!name.endsWith('.jar') && !name.endsWith(`.jar${DISABLED_SUFFIX}`)) continue;
      await new Promise((resolve) => setImmediate(resolve));
      const metadata = readModMetadata(path.join(folder, name));
      metadata.ids.forEach((id) => provided.add(id));
      if (!disabled) metadata.required.forEach((id) => required.add(id));
    }
    return { provided, missing: [...required].filter((id) => !provided.has(id)) };
  }

  private async installFromModMetadata(run: InstallRun): Promise<void> {
    const unresolved = new Set<string>();
    for (let pass = 0; pass < MAX_METADATA_PASSES; pass++) {
      const missing = (await this.scanModsFolder(run.instance)).missing.filter((id) => !unresolved.has(id));
      if (missing.length === 0) return;
      for (const modId of missing) {
        run.task.throwIfCancelled();
        run.task.setCurrentFile(modId);
        const resolved = await this.installByModId(run, modId).catch((error: unknown) => {
          if (isCancellation(error)) throw error;
          log.warn(`Lookup for mod id ${modId} failed`, error);
          return false;
        });
        if (!resolved) {
          unresolved.add(modId);
          log.warn(`No project found for required mod id ${modId}`);
        }
      }
    }
  }

  private async installByModId(run: InstallRun, modId: string): Promise<boolean> {
    const { instance } = run;
    const candidates = await findModIdCandidates(this.modrinth, modId, instance.loader.type, instance.gameVersion);
    for (const { project, trusted } of candidates) {
      if (run.attempted.has(project.id)) continue;
      const version = await this.findVersion(instance, project, 'mod');
      if (!version) continue;
      if (trusted) {
        await this.installDependency(run, project, version, 0);
        return true;
      }
      if (await this.installIfProvides(run, project, version, modId)) return true;
    }
    return false;
  }

  private async installIfProvides(run: InstallRun, project: ModrinthProject, version: ModrinthVersion, modId: string): Promise<boolean> {
    const file = primaryFile(version);
    if (!file) return false;
    const inspectDir = path.join(this.settings.gamePaths().cache, 'mod-candidates');
    const candidate = path.join(inspectDir, file.filename);
    await ensureDir(inspectDir);
    await downloadFile({ url: file.url, destination: candidate, sha1: file.hashes.sha1, size: file.size }, { signal: run.task.signal, onProgress: run.task.downloadReporter('dependencies') });
    if (!readModMetadata(candidate).ids.includes(modId)) {
      await fs.rm(candidate, { force: true });
      return false;
    }
    run.attempted.add(project.id);
    const folder = this.modsFolder(run.instance);
    await ensureDir(folder);
    await fs.rename(candidate, path.join(folder, file.filename));
    await this.recordVersion(run.instance, 'mod', file.filename, project, version);
    await this.installDeclaredDependencies(run, version, 1);
    return true;
  }
}
