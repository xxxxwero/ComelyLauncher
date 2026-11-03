import type { LoaderType } from '../../shared/types/instances';
import type { ModrinthClient, ModrinthProject } from './modrinth-client';

const KNOWN_SLUGS: Record<string, string> = {
  fabric: 'fabric-api',
  'fabric-api': 'fabric-api',
  'cloth-config': 'cloth-config',
  'cloth-config2': 'cloth-config',
  cloth_config: 'cloth-config',
  architectury: 'architectury-api',
  yet_another_config_lib_v3: 'yacl',
  'yet-another-config-lib': 'yacl',
  yacl: 'yacl',
  owo: 'owo-lib',
  puzzleslib: 'puzzles-lib',
  forgeconfigapiport: 'forge-config-api-port',
  kotlinforforge: 'kotlin-for-forge',
  fabric_language_kotlin: 'fabric-language-kotlin',
  'fabric-language-kotlin': 'fabric-language-kotlin',
  quilted_fabric_api: 'qsl',
  resourcefullib: 'resourceful-lib'
};

const FABRIC_API_MODULE = /^fabric-[a-z0-9-]+(-v\d+)?$/;
const INTERNAL_LIBRARY = /^(org|com|net|io|de)[_.]/;
const SEARCH_LIMIT = 3;

export interface ModIdCandidate {
  project: ModrinthProject;
  trusted: boolean;
}

function knownSlug(modId: string): string | null {
  if (KNOWN_SLUGS[modId]) return KNOWN_SLUGS[modId];
  return FABRIC_API_MODULE.test(modId) ? 'fabric-api' : null;
}

export async function findModIdCandidates(modrinth: ModrinthClient, modId: string, loader: LoaderType, gameVersion: string): Promise<ModIdCandidate[]> {
  const known = knownSlug(modId);
  if (known) return (await modrinth.projects([known])).map((project) => ({ project, trusted: true }));
  if (INTERNAL_LIBRARY.test(modId)) return [];

  const slugs = [...new Set([modId, modId.replace(/_/g, '-')])];
  const search = await modrinth.search({
    query: modId.replace(/[_-]/g, ' '),
    facets: [['project_type:mod'], [`versions:${gameVersion}`], [`categories:${loader}`]],
    index: 'relevance',
    offset: 0,
    limit: SEARCH_LIMIT
  });
  const projects = await modrinth.projects([...new Set([...slugs, ...search.hits.map((hit) => hit.project_id)])]);
  return projects.filter((project) => project.project_type === 'mod').map((project) => ({ project, trusted: false }));
}
