import type { ContentProjectType } from '../../shared/types/content';
import type { ContentKind, LoaderType } from '../../shared/types/instances';

export const CONTENT_KINDS: ContentKind[] = ['mod', 'resourcepack', 'shaderpack'];

export const CONTENT_FOLDERS: Record<ContentKind, string> = {
  mod: 'mods',
  resourcepack: 'resourcepacks',
  shaderpack: 'shaderpacks'
};

export const CONTENT_EXTENSIONS: Record<ContentKind, string[]> = {
  mod: ['.jar'],
  resourcepack: ['.zip'],
  shaderpack: ['.zip']
};

export const DISABLED_SUFFIX = '.disabled';

export function kindForProjectType(type: ContentProjectType | string): ContentKind | null {
  if (type === 'mod') return 'mod';
  if (type === 'resourcepack') return 'resourcepack';
  if (type === 'shader') return 'shaderpack';
  return null;
}

export function modrinthLoaders(kind: ContentKind, loader: LoaderType): string[] | null {
  if (kind === 'resourcepack') return ['minecraft'];
  if (kind === 'shaderpack') return null;
  if (loader === 'vanilla') return [];
  if (loader === 'quilt') return ['quilt', 'fabric'];
  return [loader];
}
