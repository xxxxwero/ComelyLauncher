import { fetchJson, postJson } from '../core/http';

const API = 'https://api.modrinth.com/v2';

export interface ModrinthSearchHit {
  project_id: string;
  slug: string;
  title: string;
  author: string;
  description: string;
  icon_url: string | null;
  downloads: number;
  categories: string[];
  versions: string[];
  project_type: string;
}

export interface ModrinthSearchResponse {
  hits: ModrinthSearchHit[];
  total_hits: number;
  offset: number;
}

export interface ModrinthFile {
  url: string;
  filename: string;
  primary: boolean;
  size: number;
  hashes: { sha1: string; sha512?: string };
}

export interface ModrinthDependency {
  project_id: string | null;
  version_id: string | null;
  dependency_type: 'required' | 'optional' | 'incompatible' | 'embedded';
}

export interface ModrinthVersion {
  id: string;
  project_id: string;
  name: string;
  version_number: string;
  version_type: 'release' | 'beta' | 'alpha';
  game_versions: string[];
  loaders: string[];
  files: ModrinthFile[];
  dependencies: ModrinthDependency[];
}

export interface ModrinthProject {
  id: string;
  slug: string;
  title: string;
  icon_url: string | null;
  project_type: string;
  team: string;
}

export interface SearchParams {
  query: string;
  facets: string[][];
  index: 'relevance' | 'downloads' | 'newest' | 'updated';
  offset: number;
  limit: number;
}

export class ModrinthClient {
  search(params: SearchParams): Promise<ModrinthSearchResponse> {
    const query = new URLSearchParams({
      query: params.query,
      facets: JSON.stringify(params.facets),
      index: params.index,
      offset: String(params.offset),
      limit: String(params.limit)
    });
    return fetchJson<ModrinthSearchResponse>(`${API}/search?${query.toString()}`);
  }

  projectVersions(projectId: string, loaders: string[] | null, gameVersions: string[] | null): Promise<ModrinthVersion[]> {
    const query = new URLSearchParams();
    if (loaders) query.set('loaders', JSON.stringify(loaders));
    if (gameVersions) query.set('game_versions', JSON.stringify(gameVersions));
    return fetchJson<ModrinthVersion[]>(`${API}/project/${encodeURIComponent(projectId)}/version?${query.toString()}`);
  }

  projects(ids: string[]): Promise<ModrinthProject[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return fetchJson<ModrinthProject[]>(`${API}/projects?ids=${encodeURIComponent(JSON.stringify(ids))}`);
  }

  version(versionId: string): Promise<ModrinthVersion> {
    return fetchJson<ModrinthVersion>(`${API}/version/${encodeURIComponent(versionId)}`);
  }

  async versionsByHashes(hashes: string[]): Promise<Record<string, ModrinthVersion>> {
    if (hashes.length === 0) return {};
    const { status, data } = await postJson<Record<string, ModrinthVersion>>(`${API}/version_files`, { hashes, algorithm: 'sha1' });
    return status === 200 ? data : {};
  }

  async latestVersionsByHashes(hashes: string[], loaders: string[], gameVersions: string[]): Promise<Record<string, ModrinthVersion>> {
    if (hashes.length === 0) return {};
    const body: Record<string, unknown> = { hashes, algorithm: 'sha1', game_versions: gameVersions };
    if (loaders.length > 0) body.loaders = loaders;
    const { status, data } = await postJson<Record<string, ModrinthVersion>>(`${API}/version_files/update`, body);
    return status === 200 ? data : {};
  }
}

export function primaryFile(version: ModrinthVersion): ModrinthFile | null {
  return version.files.find((file) => file.primary) ?? version.files[0] ?? null;
}

export function pickBestVersion(versions: ModrinthVersion[]): ModrinthVersion | null {
  return versions.find((version) => version.version_type === 'release') ?? versions[0] ?? null;
}
