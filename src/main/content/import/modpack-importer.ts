import fs from 'node:fs/promises';
import path from 'node:path';
import type { ExternalProfile } from '../../../shared/types/imports';
import type { Instance } from '../../../shared/types/instances';
import { createLogger } from '../../core/logger';
import { createInstanceId, type InstanceService } from '../../instances/instance-service';
import type { SettingsService } from '../../settings/settings-service';
import type { TaskHandle } from '../../tasks/task-manager';
import type { InstalledContentService } from '../installed-content-service';
import { extractArchive } from './archive-extractor';
import type { InstancePackage } from './instance-package';
import { createModrinthProfilePackage, listModrinthProfiles } from './modrinth-app-profiles';
import { detectPackage } from './package-detector';

const log = createLogger('import');

export class ModpackImporter {
  constructor(
    private readonly settings: SettingsService,
    private readonly instances: InstanceService,
    private readonly installed: InstalledContentService
  ) {}

  async importArchive(file: string, task: TaskHandle): Promise<Instance> {
    const instanceId = createInstanceId();
    const workDir = path.join(this.settings.gamePaths().cache, 'imports', instanceId);
    task.startStep('read');
    try {
      await extractArchive(file, workDir, { signal: task.signal, onProgress: (fraction) => task.setStepProgress('read', fraction) });
      const fallbackName = path.basename(file, path.extname(file));
      return await this.build(await detectPackage(workDir, fallbackName, 'extracted-archive'), instanceId, task);
    } finally {
      await fs.rm(workDir, { recursive: true, force: true });
    }
  }

  async importFolder(folder: string, task: TaskHandle): Promise<Instance> {
    task.startStep('read');
    const resolved = path.resolve(folder).toLowerCase();
    const profile = (await listModrinthProfiles()).find((entry) => path.resolve(entry.folder).toLowerCase() === resolved);
    const instancePackage = profile ? createModrinthProfilePackage(profile) : await detectPackage(folder, path.basename(folder), 'external-folder');
    return this.build(instancePackage, createInstanceId(), task);
  }

  async importModrinthProfile(profile: ExternalProfile, task: TaskHandle): Promise<Instance> {
    task.startStep('read');
    return this.build(createModrinthProfilePackage(profile), createInstanceId(), task);
  }

  private async build(instancePackage: InstancePackage, instanceId: string, task: TaskHandle): Promise<Instance> {
    const instanceDir = await this.instances.reserveFolder(instanceId, instancePackage.name);
    let instance: Instance;
    try {
      await instancePackage.install(instanceDir, task);
      task.throwIfCancelled();
      instance = await this.instances.create(
        { name: instancePackage.name, cover: '', gameVersion: instancePackage.gameVersion, loader: instancePackage.loader },
        instanceId
      );
    } catch (error) {
      await fs.rm(instanceDir, { recursive: true, force: true });
      this.instances.releaseFolder(instanceId);
      throw error;
    }
    await this.installed.identifyContent(instanceId).catch((error: unknown) => log.warn('Content identification failed', error));
    await this.instances.emitChanged();
    return instance;
  }
}
