import path from 'node:path';
import type { LaunchCredentials } from '../../accounts/account-types';
import { LAUNCHER_NAME } from '../../core/app-paths';
import type { GamePaths } from '../../core/game-paths';
import { resolveLibraries } from '../libraries';
import { isAllowedByRules, type LaunchFeatures } from '../rules';
import type { ArgumentValue, ResolvedVersion } from '../version-json';

export interface ServerAddress {
  host: string;
  port: number;
}

export interface LaunchContext {
  paths: GamePaths;
  version: ResolvedVersion;
  instanceDir: string;
  gameAssetsDir: string;
  credentials: LaunchCredentials;
  launcherVersion: string;
  memoryMb: number;
  windowWidth: number;
  windowHeight: number;
  fullscreen: boolean;
  extraJvmArguments: string;
  server: ServerAddress | null;
  authlibInjectorJar: string | null;
}

const LEGACY_JVM_ARGUMENTS = ['-Djava.library.path=${natives_directory}', '-cp', '${classpath}'];
const FAST_STARTUP_JVM_ARGUMENTS = ['-XX:+UnlockDiagnosticVMOptions', '-XX:-BytecodeVerificationRemote'];

export function parseServerAddress(address: string): ServerAddress {
  const trimmed = address.trim();
  const bracketed = /^\[([^\]]+)\](?::(\d+))?$/.exec(trimmed);
  if (bracketed) return { host: bracketed[1], port: Number(bracketed[2] ?? 25565) };
  const parts = trimmed.split(':');
  if (parts.length === 2 && /^\d+$/.test(parts[1])) return { host: parts[0], port: Number(parts[1]) };
  return { host: trimmed, port: 25565 };
}

export function splitCommandLine(value: string): string[] {
  const result: string[] = [];
  const pattern = /"([^"]*)"|'([^']*)'|(\S+)/g;
  for (const match of value.matchAll(pattern)) result.push(match[1] ?? match[2] ?? match[3]);
  return result;
}

function supportsQuickPlay(version: ResolvedVersion): boolean {
  return version.gameArguments.some((argument) => typeof argument !== 'string' && argument.rules?.some((rule) => rule.features?.is_quick_play_multiplayer));
}

function evaluate(argumentsList: ArgumentValue[], features: LaunchFeatures): string[] {
  const result: string[] = [];
  for (const argument of argumentsList) {
    if (typeof argument === 'string') result.push(argument);
    else if (isAllowedByRules(argument.rules, features)) result.push(...(Array.isArray(argument.value) ? argument.value : [argument.value]));
  }
  return result;
}

function substitute(values: string[], placeholders: Record<string, string>): string[] {
  return values.map((value) => value.replace(/\$\{([a-zA-Z_]+)\}/g, (_match, key: string) => placeholders[key] ?? ''));
}

export function buildLaunchArguments(context: LaunchContext): string[] {
  const { version, paths, credentials } = context;
  const libraries = resolveLibraries(version.libraries, paths);
  const classpath = [...libraries.classpath.map((library) => library.path), paths.versionJar(version.jarVersionId)];
  const quickPlay = Boolean(context.server) && supportsQuickPlay(version);
  const features: LaunchFeatures = {
    has_custom_resolution: !context.fullscreen,
    is_quick_play_multiplayer: quickPlay
  };
  const assetIndex = version.assetIndex?.id ?? version.assets ?? 'legacy';
  const placeholders: Record<string, string> = {
    auth_player_name: credentials.username,
    auth_uuid: credentials.uuid,
    auth_access_token: credentials.accessToken,
    auth_session: `token:${credentials.accessToken}:${credentials.uuid}`,
    auth_xuid: credentials.xuid,
    clientid: '',
    user_type: credentials.userType,
    user_properties: '{}',
    version_name: version.id,
    version_type: version.type,
    game_directory: context.instanceDir,
    assets_root: paths.assets,
    game_assets: context.gameAssetsDir,
    assets_index_name: assetIndex,
    natives_directory: paths.nativesDir(version.id),
    library_directory: paths.libraries,
    classpath: classpath.join(path.delimiter),
    classpath_separator: path.delimiter,
    launcher_name: LAUNCHER_NAME,
    launcher_version: context.launcherVersion,
    resolution_width: String(context.windowWidth),
    resolution_height: String(context.windowHeight),
    quickPlayMultiplayer: context.server ? `${context.server.host}:${context.server.port}` : ''
  };

  const versionJvm = evaluate(version.jvmArguments, features);
  const hasClasspath = versionJvm.some((argument) => argument.includes('${classpath}'));
  const jvm: string[] = [
    `-Xmx${context.memoryMb}M`,
    `-Xms${Math.max(Math.min(context.memoryMb, 1024), Math.floor(context.memoryMb / 2))}M`,
    ...FAST_STARTUP_JVM_ARGUMENTS,
    ...splitCommandLine(context.extraJvmArguments),
    `-Dminecraft.launcher.brand=${LAUNCHER_NAME}`,
    `-Dminecraft.launcher.version=${context.launcherVersion}`
  ];
  if (context.authlibInjectorJar && credentials.authlibInjectorServer) {
    jvm.push(`-javaagent:${context.authlibInjectorJar}=${credentials.authlibInjectorServer}`);
  }
  const logging = version.logging?.client;
  if (logging) jvm.push(logging.argument.replace('${path}', paths.logConfig(logging.file.id)));
  jvm.push(...(hasClasspath ? [] : LEGACY_JVM_ARGUMENTS), ...versionJvm);

  const game = [
    ...(version.minecraftArguments ? splitCommandLine(version.minecraftArguments) : []),
    ...evaluate(version.gameArguments, features)
  ];
  if (version.minecraftArguments && !context.fullscreen) {
    game.push('--width', '${resolution_width}', '--height', '${resolution_height}');
  }
  if (context.fullscreen) game.push('--fullscreen');
  if (context.server && !quickPlay) game.push('--server', context.server.host, '--port', String(context.server.port));

  return [...substitute(jvm, placeholders), version.mainClass, ...substitute(game, placeholders)];
}
