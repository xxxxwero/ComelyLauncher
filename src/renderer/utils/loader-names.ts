import type { Instance, LoaderType } from '../../shared/types/instances';

export const LOADER_NAMES: Record<LoaderType, string> = {
  vanilla: 'Vanilla',
  fabric: 'Fabric',
  forge: 'Forge',
  neoforge: 'NeoForge',
  quilt: 'Quilt'
};

export function loaderVersionLabel(loader: LoaderType, version: string, gameVersion: string): string {
  return loader === 'forge' && version.startsWith(`${gameVersion}-`) ? version.slice(gameVersion.length + 1) : version;
}

export function instanceVersionLabel(instance: Instance): string {
  return instance.loader.type === 'vanilla' ? instance.gameVersion : `${instance.gameVersion} · ${LOADER_NAMES[instance.loader.type]}`;
}
