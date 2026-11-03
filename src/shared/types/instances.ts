export type LoaderType = 'vanilla' | 'fabric' | 'quilt' | 'forge' | 'neoforge';

export const LOADER_TYPES: readonly LoaderType[] = ['vanilla', 'fabric', 'forge', 'neoforge', 'quilt'];

export interface InstanceLoader {
  type: LoaderType;
  version: string | null;
}

export interface Instance {
  id: string;
  name: string;
  cover: string;
  gameVersion: string;
  loader: InstanceLoader;
  createdAt: number;
  lastPlayedAt: number | null;
  totalPlayTimeMs: number;
  lastServer: string | null;
  installedVersionId: string | null;
  contentCount: number;
}

export interface InstanceDraft {
  name: string;
  cover: string;
  gameVersion: string;
  loader: InstanceLoader;
}

export interface InstancePatch {
  name?: string;
  cover?: string;
  gameVersion?: string;
  loader?: InstanceLoader;
}

export type InstanceFolder = 'root' | 'mods' | 'resourcepacks' | 'shaderpacks' | 'saves' | 'screenshots' | 'logs';

export type ContentKind = 'mod' | 'resourcepack' | 'shaderpack';

export interface InstalledContent {
  fileName: string;
  kind: ContentKind;
  enabled: boolean;
  sizeBytes: number;
  title: string;
  author: string | null;
  projectId: string | null;
  versionNumber: string | null;
  iconUrl: string | null;
  pageUrl: string | null;
  updateVersionId: string | null;
  updateVersionNumber: string | null;
}
