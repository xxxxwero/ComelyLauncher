export type ContentProjectType = 'mod' | 'modpack' | 'resourcepack' | 'shader';

export type ContentSort = 'relevance' | 'downloads' | 'newest' | 'updated';

export interface ContentSearchQuery {
  text: string;
  type: ContentProjectType;
  sort: ContentSort;
  instanceId: string | null;
  compatibleOnly: boolean;
  offset: number;
}

export interface ContentProject {
  projectId: string;
  slug: string;
  title: string;
  author: string;
  description: string;
  iconUrl: string | null;
  downloads: number;
  categories: string[];
  gameVersions: string[];
  projectType: ContentProjectType;
  installed: boolean;
}

export interface ContentSearchResult {
  hits: ContentProject[];
  total: number;
  offset: number;
}
