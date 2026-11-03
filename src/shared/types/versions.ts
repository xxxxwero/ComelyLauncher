export type MinecraftVersionType = 'release' | 'snapshot' | 'old_beta' | 'old_alpha';

export interface MinecraftVersionEntry {
  id: string;
  type: MinecraftVersionType;
  releaseTime: string;
  installed: boolean;
}

export interface LoaderVersionEntry {
  version: string;
  stable: boolean;
}
