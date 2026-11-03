import AdmZip from 'adm-zip';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ensureDir, fileSize } from '../core/file-system';
import type { GamePaths } from '../core/game-paths';
import type { DownloadRequest } from '../downloads/download-types';
import { joinUrl, mavenKey, mavenPath, parseMaven } from './maven';
import { currentArchitecture, isAllowedByRules } from './rules';
import type { DownloadArtifact, LibraryEntry } from './version-json';

const MOJANG_LIBRARIES = 'https://libraries.minecraft.net/';

export interface LibraryFile {
  key: string;
  name: string;
  path: string;
  url: string | null;
  sha1?: string;
  size?: number;
}

export interface NativeArchive extends LibraryFile {
  exclude: string[];
}

export interface ResolvedLibraries {
  classpath: LibraryFile[];
  natives: NativeArchive[];
}

function expectedNativeClassifier(): string {
  const arch = currentArchitecture();
  if (arch === 'x86') return 'natives-windows-x86';
  if (arch === 'arm64') return 'natives-windows-arm64';
  return 'natives-windows';
}

function isForeignNative(classifier: string | null): boolean {
  if (!classifier || !classifier.startsWith('natives-')) return false;
  return classifier !== expectedNativeClassifier();
}

function fromArtifact(name: string, artifact: DownloadArtifact, paths: GamePaths): LibraryFile {
  const relative = artifact.path ?? mavenPath(name);
  return {
    key: mavenKey(name),
    name,
    path: paths.library(relative),
    url: artifact.url ? artifact.url : null,
    sha1: artifact.sha1,
    size: artifact.size
  };
}

function fromMaven(library: LibraryEntry, name: string, paths: GamePaths): LibraryFile {
  const relative = mavenPath(name);
  return {
    key: mavenKey(name),
    name,
    path: paths.library(relative),
    url: joinUrl(library.url ?? MOJANG_LIBRARIES, relative),
    sha1: library.sha1,
    size: library.size
  };
}

function resolveNative(library: LibraryEntry, paths: GamePaths): NativeArchive | null {
  const template = library.natives?.windows;
  if (!template) return null;
  const classifier = template.replace('${arch}', currentArchitecture() === 'x86' ? '32' : '64');
  const artifact = library.downloads?.classifiers?.[classifier];
  const name = `${library.name}:${classifier}`;
  const file = artifact ? fromArtifact(name, artifact, paths) : fromMaven(library, name, paths);
  return { ...file, exclude: library.extract?.exclude ?? ['META-INF/'] };
}

export function resolveLibraries(libraries: LibraryEntry[], paths: GamePaths): ResolvedLibraries {
  const classpath = new Map<string, LibraryFile>();
  const natives = new Map<string, NativeArchive>();
  for (const library of libraries) {
    if (!isAllowedByRules(library.rules)) continue;
    const native = resolveNative(library, paths);
    if (native && !natives.has(native.key)) natives.set(native.key, native);
    if (library.natives && !library.downloads?.artifact) continue;
    if (isForeignNative(parseMaven(library.name).classifier)) continue;
    const artifact = library.downloads?.artifact;
    const file = artifact ? fromArtifact(library.name, artifact, paths) : fromMaven(library, library.name, paths);
    if (!classpath.has(file.key)) classpath.set(file.key, file);
  }
  return { classpath: [...classpath.values()], natives: [...natives.values()] };
}

export function libraryDownloads(resolved: ResolvedLibraries): DownloadRequest[] {
  return [...resolved.classpath, ...resolved.natives]
    .filter((file): file is LibraryFile & { url: string } => file.url !== null)
    .map((file) => ({
      url: file.url,
      destination: file.path,
      sha1: file.sha1,
      size: file.size
    }));
}

export async function missingLocalLibraries(resolved: ResolvedLibraries): Promise<string[]> {
  const missing: string[] = [];
  for (const file of resolved.classpath) {
    if (file.url === null && (await fileSize(file.path)) === null) missing.push(file.name);
  }
  return missing;
}

export async function extractNatives(natives: NativeArchive[], targetDir: string): Promise<void> {
  await ensureDir(targetDir);
  for (const native of natives) {
    const zip = new AdmZip(native.path);
    for (const entry of zip.getEntries()) {
      if (entry.isDirectory) continue;
      if (native.exclude.some((prefix) => entry.entryName.startsWith(prefix))) continue;
      const target = path.join(targetDir, ...entry.entryName.split('/'));
      if ((await fileSize(target)) === entry.header.size) continue;
      await ensureDir(path.dirname(target));
      await fs.writeFile(target, entry.getData());
    }
  }
}
