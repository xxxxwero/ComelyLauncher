import { LauncherError } from '../../shared/errors';
import { readJsonFile } from '../core/file-system';
import type { GamePaths } from '../core/game-paths';
import type { ResolvedVersion, VersionJson } from './version-json';

export async function readVersionJson(paths: GamePaths, versionId: string): Promise<VersionJson | null> {
  return readJsonFile<VersionJson | null>(paths.versionJson(versionId), null);
}

function fromJson(json: VersionJson): ResolvedVersion {
  return {
    id: json.id,
    chain: [json.id],
    jarVersionId: json.jar ?? json.id,
    jarSourceId: json.jar ?? json.id,
    releaseTime: json.releaseTime ?? null,
    type: json.type ?? 'release',
    mainClass: json.mainClass ?? '',
    minecraftArguments: json.minecraftArguments ?? null,
    gameArguments: json.arguments?.game ?? [],
    jvmArguments: json.arguments?.jvm ?? [],
    libraries: json.libraries ?? [],
    assetIndex: json.assetIndex ?? null,
    assets: json.assets ?? null,
    clientDownload: json.downloads?.client ?? null,
    javaVersion: json.javaVersion ?? null,
    logging: json.logging ?? null
  };
}

function mergeWithParent(child: VersionJson, parent: ResolvedVersion): ResolvedVersion {
  return {
    id: child.id,
    chain: [child.id, ...parent.chain],
    jarVersionId: child.jar ?? child.id,
    jarSourceId: child.jar ?? parent.jarSourceId,
    releaseTime: parent.releaseTime ?? child.releaseTime ?? null,
    type: child.type ?? parent.type,
    mainClass: child.mainClass ?? parent.mainClass,
    minecraftArguments: child.minecraftArguments ?? parent.minecraftArguments,
    gameArguments: [...parent.gameArguments, ...(child.arguments?.game ?? [])],
    jvmArguments: [...parent.jvmArguments, ...(child.arguments?.jvm ?? [])],
    libraries: [...(child.libraries ?? []), ...parent.libraries],
    assetIndex: child.assetIndex ?? parent.assetIndex,
    assets: child.assets ?? parent.assets,
    clientDownload: child.downloads?.client ?? parent.clientDownload,
    javaVersion: child.javaVersion ?? parent.javaVersion,
    logging: child.logging ?? parent.logging
  };
}

export async function resolveVersion(paths: GamePaths, versionId: string, depth = 0): Promise<ResolvedVersion> {
  if (depth > 8) throw new LauncherError('install-failed', `Version inheritance is too deep: ${versionId}`);
  const json = await readVersionJson(paths, versionId);
  if (!json) throw new LauncherError('install-failed', `Version ${versionId} is not installed`, { version: versionId });
  if (!json.inheritsFrom) return fromJson(json);
  const parent = await resolveVersion(paths, json.inheritsFrom, depth + 1);
  return mergeWithParent(json, parent);
}
