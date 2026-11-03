import type { InstanceLoader } from '../../shared/types/instances';
import type { JavaService } from '../java/java-service';
import { javaRequirement } from '../java/java-service';
import type { SettingsService } from '../settings/settings-service';
import type { StepDefinition, TaskHandle } from '../tasks/task-manager';
import type { LoaderRegistry } from './loaders/loader-registry';
import type { VanillaInstaller } from './vanilla-installer';
import { resolveVersion } from './version-resolver';

export interface InstallTarget {
  gameVersion: string;
  loader: InstanceLoader;
}

export interface InstallResult {
  versionId: string;
  loaderVersion: string | null;
}

const LOADER_NAMES: Record<string, string> = {
  fabric: 'Fabric',
  quilt: 'Quilt',
  forge: 'Forge',
  neoforge: 'NeoForge'
};

export function installSteps(target: InstallTarget): StepDefinition[] {
  const steps: StepDefinition[] = [{ id: 'client', label: { key: 'install.step.client' }, weight: 2 }];
  if (target.loader.type !== 'vanilla') {
    steps.push({ id: 'loader', label: { key: 'install.step.loader', params: { loader: LOADER_NAMES[target.loader.type] } }, weight: 2 });
  }
  steps.push(
    { id: 'libraries', label: { key: 'install.step.libraries' }, weight: 3 },
    { id: 'assets', label: { key: 'install.step.assets' }, weight: 5 },
    { id: 'natives', label: { key: 'install.step.natives' }, weight: 1 }
  );
  return steps;
}

export class GameInstaller {
  constructor(
    private readonly settings: SettingsService,
    private readonly vanilla: VanillaInstaller,
    private readonly loaders: LoaderRegistry,
    private readonly java: JavaService
  ) {}

  private async findCandidate(target: InstallTarget & { installedVersionId: string | null }): Promise<InstallResult | null> {
    if (target.installedVersionId) return { versionId: target.installedVersionId, loaderVersion: target.loader.version };
    if (target.loader.type === 'vanilla') return { versionId: target.gameVersion, loaderVersion: null };
    return this.loaders.findInstalled(this.settings.gamePaths(), target.loader.type, target.gameVersion, target.loader.version);
  }

  async findReady(target: InstallTarget & { installedVersionId: string | null }): Promise<InstallResult | null> {
    const candidate = await this.findCandidate(target);
    if (!candidate) return null;
    const paths = this.settings.gamePaths();
    try {
      const version = await resolveVersion(paths, candidate.versionId);
      return (await this.vanilla.isInstalled(paths, version)) ? candidate : null;
    } catch {
      return null;
    }
  }

  async install(target: InstallTarget, task: TaskHandle): Promise<InstallResult> {
    const paths = this.settings.gamePaths();
    const options = (stepId: string) => ({ signal: task.signal, onProgress: task.downloadReporter(stepId) });

    task.startStep('client');
    await this.vanilla.installVersionJson(paths, target.gameVersion, task.signal);
    const vanillaVersion = await resolveVersion(paths, target.gameVersion);
    await this.vanilla.installClient(paths, vanillaVersion, options('client'));
    task.throwIfCancelled();

    let versionId = target.gameVersion;
    let loaderVersion: string | null = null;
    if (target.loader.type !== 'vanilla') {
      task.startStep('loader');
      const type = target.loader.type;
      loaderVersion = await this.loaders.resolveVersion(type, target.gameVersion, target.loader.version);
      const existing = await this.loaders.installedVersionId(paths, type, target.gameVersion, loaderVersion);
      if (existing) versionId = existing;
      else {
        versionId = await this.loaders.get(type).install({
          paths,
          gameVersion: target.gameVersion,
          loaderVersion,
          download: options('loader'),
          resolveJava: async () => (await this.java.select(paths, javaRequirement(vanillaVersion), this.settings.get().java, options('loader'))).executable,
          reportProgress: (fraction, file) => {
            task.setStepProgress('loader', fraction);
            task.setCurrentFile(file);
          }
        });
        await this.loaders.rememberInstall(paths, type, target.gameVersion, loaderVersion, versionId);
      }
      task.throwIfCancelled();
    }

    const resolved = await resolveVersion(paths, versionId);
    task.startStep('libraries');
    await this.vanilla.linkClientJar(paths, resolved);
    await this.vanilla.installLibraries(paths, resolved, options('libraries'));
    task.startStep('assets');
    await this.vanilla.installAssets(paths, resolved, options('assets'));
    task.startStep('natives');
    await this.vanilla.installNatives(paths, resolved);
    task.completeStep('natives');
    return { versionId, loaderVersion };
  }
}
