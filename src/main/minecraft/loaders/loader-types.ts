import type { LoaderType } from '../../../shared/types/instances';
import type { LoaderVersionEntry } from '../../../shared/types/versions';
import type { GamePaths } from '../../core/game-paths';
import type { DownloadOptions } from '../../downloads/download-types';

export type ModLoaderType = Exclude<LoaderType, 'vanilla'>;

export interface LoaderInstallContext {
  paths: GamePaths;
  gameVersion: string;
  loaderVersion: string;
  download: DownloadOptions;
  resolveJava: () => Promise<string>;
  reportProgress: (fraction: number, file: string | null) => void;
}

export interface LoaderInstaller {
  readonly type: ModLoaderType;
  listVersions(gameVersion: string): Promise<LoaderVersionEntry[]>;
  install(context: LoaderInstallContext): Promise<string>;
}
