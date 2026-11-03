import path from 'node:path';
import { LauncherError } from '../../shared/errors';
import type { JavaSettings } from '../../shared/types/settings';
import type { JavaInstallation } from '../../shared/types/system';
import { pathExists } from '../core/file-system';
import type { GamePaths } from '../core/game-paths';
import type { DownloadOptions } from '../downloads/download-types';
import type { ResolvedVersion } from '../minecraft/version-json';
import { detectJavaInstallations, inspectJava } from './java-locator';
import { JavaRuntimeInstaller } from './java-runtime-installer';

export interface SelectedJava {
  executable: string;
  majorVersion: number;
}

export interface JavaRequirement {
  component: string;
  majorVersion: number;
}

export function javaRequirement(version: ResolvedVersion): JavaRequirement {
  return version.javaVersion ?? { component: 'jre-legacy', majorVersion: 8 };
}

function isCompatible(installed: number, required: number): boolean {
  if (required <= 8) return installed === 8;
  return installed >= required;
}

export class JavaService {
  private readonly runtimes = new JavaRuntimeInstaller();

  detect(paths: GamePaths): Promise<JavaInstallation[]> {
    return detectJavaInstallations(paths);
  }

  async select(paths: GamePaths, requirement: JavaRequirement, settings: JavaSettings, options: DownloadOptions): Promise<SelectedJava> {
    if (settings.customPath.trim()) return this.fromCustomPath(settings.customPath.trim(), requirement);
    if (settings.autoDownload) {
      const executable = await this.runtimes.ensure(paths, requirement.component, options);
      return { executable, majorVersion: requirement.majorVersion };
    }
    const installations = await this.detect(paths);
    const exact = installations.find((java) => java.majorVersion === requirement.majorVersion);
    const compatible = exact ?? installations.find((java) => isCompatible(java.majorVersion, requirement.majorVersion));
    if (!compatible) {
      throw new LauncherError('java-not-found', `Java ${requirement.majorVersion} was not found`, { required: requirement.majorVersion });
    }
    return { executable: compatible.path, majorVersion: compatible.majorVersion };
  }

  private async fromCustomPath(customPath: string, requirement: JavaRequirement): Promise<SelectedJava> {
    const javaw = path.basename(customPath).toLowerCase() === 'java.exe' ? path.join(path.dirname(customPath), 'javaw.exe') : customPath;
    const executable = (await pathExists(javaw)) ? javaw : customPath;
    const info = await inspectJava(executable);
    if (!info) throw new LauncherError('java-not-found', `Java executable not found: ${customPath}`, { required: requirement.majorVersion });
    return { executable, majorVersion: info.majorVersion };
  }
}
