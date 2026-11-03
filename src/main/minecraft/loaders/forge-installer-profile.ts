import AdmZip from 'adm-zip';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { LauncherError } from '../../../shared/errors';
import { ensureDir, isFileValid, pathExists, writeJsonFile } from '../../core/file-system';
import type { GamePaths } from '../../core/game-paths';
import { downloadFiles } from '../../downloads/download-manager';
import type { DownloadRequest } from '../../downloads/download-types';
import { joinUrl, mavenPath } from '../maven';
import type { LibraryEntry, VersionJson } from '../version-json';
import type { LoaderInstallContext } from './loader-types';
import { readMainClass, runJavaProcess } from './processor-runner';

const MOJANG_LIBRARIES = 'https://libraries.minecraft.net/';
const FORGE_MAVEN = 'https://maven.minecraftforge.net/';

interface Processor {
  sides?: string[];
  jar: string;
  classpath: string[];
  args: string[];
  outputs?: Record<string, string>;
}

interface ModernProfile {
  json: string;
  minecraft: string;
  data?: Record<string, { client: string; server: string }>;
  processors?: Processor[];
  libraries?: LibraryEntry[];
}

interface LegacyLibrary {
  name: string;
  url?: string;
  serverreq?: boolean;
  clientreq?: boolean;
}

interface LegacyProfile {
  install: { path: string; filePath: string; minecraft: string };
  versionInfo: Omit<VersionJson, 'libraries'> & { libraries: LegacyLibrary[] };
}

function normalizeMavenBase(url: string): string {
  return url
    .replace(/^http:\/\//, 'https://')
    .replace('https://files.minecraftforge.net/maven/', FORGE_MAVEN);
}

function extractEntry(zip: AdmZip, entryName: string, target: string): boolean {
  const entry = zip.getEntry(entryName);
  return entry ? zip.extractEntryTo(entry, path.dirname(target), false, true, false, path.basename(target)) : false;
}

export class ForgeInstallerProfile {
  private readonly zip: AdmZip;

  constructor(private readonly installerPath: string) {
    this.zip = new AdmZip(installerPath);
  }

  async install(context: LoaderInstallContext): Promise<string> {
    const raw = JSON.parse(this.zip.readAsText('install_profile.json')) as Partial<ModernProfile & LegacyProfile>;
    if (raw.install && raw.versionInfo) return this.installLegacy(context, raw as LegacyProfile);
    if (raw.json) return this.installModern(context, raw as ModernProfile);
    throw new LauncherError('loader-unavailable', 'Unsupported installer format');
  }

  private async installLegacy(context: LoaderInstallContext, profile: LegacyProfile): Promise<string> {
    const { paths } = context;
    const info = profile.versionInfo;
    const universalTarget = paths.library(mavenPath(profile.install.path));
    if (!(await pathExists(universalTarget))) {
      await ensureDir(path.dirname(universalTarget));
      if (!extractEntry(this.zip, profile.install.filePath, universalTarget)) {
        throw new LauncherError('install-failed', 'Universal jar is missing in installer');
      }
    }
    const libraries: LibraryEntry[] = info.libraries
      .filter((library) => !(library.serverreq && !library.clientreq))
      .map((library) => ({
        name: library.name,
        url: library.name === profile.install.path ? undefined : library.url ? normalizeMavenBase(library.url) : MOJANG_LIBRARIES
      }));
    const version: VersionJson = {
      ...info,
      libraries,
      inheritsFrom: info.inheritsFrom ?? profile.install.minecraft,
      jar: info.jar ?? profile.install.minecraft
    };
    const requests: DownloadRequest[] = libraries
      .filter((library) => library.url)
      .map((library) => {
        const relative = mavenPath(library.name);
        return {
          url: joinUrl(library.url as string, relative),
          fallbackUrls: [joinUrl(FORGE_MAVEN, relative)],
          destination: paths.library(relative)
        };
      });
    await downloadFiles(requests, { ...context.download, verification: 'size' });
    await writeJsonFile(paths.versionJson(version.id), version);
    context.reportProgress(1, null);
    return version.id;
  }

  private async installModern(context: LoaderInstallContext, profile: ModernProfile): Promise<string> {
    const { paths } = context;
    const version = JSON.parse(this.zip.readAsText(profile.json.replace(/^\//, ''))) as VersionJson;
    const libraries = [...(profile.libraries ?? []), ...(version.libraries ?? [])];
    await this.provideLibraries(context, libraries);
    context.reportProgress(0.4, null);

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'comely-forge-'));
    try {
      const data = this.buildData(paths, profile, tempDir);
      const processors = (profile.processors ?? []).filter((processor) => !processor.sides || processor.sides.includes('client'));
      const java = processors.length > 0 ? await context.resolveJava() : '';
      for (const [index, processor] of processors.entries()) {
        context.reportProgress(0.4 + (0.6 * index) / processors.length, processor.jar);
        await this.runProcessor(context, processor, data, java);
      }
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
    await writeJsonFile(paths.versionJson(version.id), version);
    context.reportProgress(1, null);
    return version.id;
  }

  private async provideLibraries(context: LoaderInstallContext, libraries: LibraryEntry[]): Promise<void> {
    const requests: DownloadRequest[] = [];
    for (const library of libraries) {
      const artifact = library.downloads?.artifact;
      const relative = artifact?.path ?? mavenPath(library.name);
      const target = context.paths.library(relative);
      if (artifact?.url) {
        requests.push({ url: artifact.url, destination: target, sha1: artifact.sha1, size: artifact.size });
        continue;
      }
      if (await isFileValid(target, { sha1: artifact?.sha1 })) continue;
      if (extractEntry(this.zip, `maven/${relative}`, target)) continue;
      if (library.url) requests.push({ url: joinUrl(library.url, relative), destination: target });
    }
    await downloadFiles(requests, context.download);
  }

  private buildData(paths: GamePaths, profile: ModernProfile, tempDir: string): Map<string, string> {
    const data = new Map<string, string>([
      ['SIDE', 'client'],
      ['MINECRAFT_JAR', paths.versionJar(profile.minecraft)],
      ['MINECRAFT_VERSION', profile.minecraft],
      ['ROOT', paths.root],
      ['INSTALLER', this.installerPath],
      ['LIBRARY_DIR', paths.libraries]
    ]);
    for (const [key, value] of Object.entries(profile.data ?? {})) {
      const client = value.client;
      if (client.startsWith('[') && client.endsWith(']')) data.set(key, paths.library(mavenPath(client.slice(1, -1))));
      else if (client.startsWith("'") && client.endsWith("'")) data.set(key, client.slice(1, -1));
      else if (client.startsWith('/')) {
        const target = path.join(tempDir, ...client.slice(1).split('/'));
        extractEntry(this.zip, client.slice(1), target);
        data.set(key, target);
      } else data.set(key, client);
    }
    return data;
  }

  private resolveToken(value: string, data: Map<string, string>, paths: GamePaths): string {
    if (value.startsWith('[') && value.endsWith(']')) return paths.library(mavenPath(value.slice(1, -1)));
    return value.replace(/\{([A-Z_]+)\}/g, (match, key: string) => data.get(key) ?? match);
  }

  private async outputsAreValid(processor: Processor, data: Map<string, string>, paths: GamePaths): Promise<boolean> {
    if (!processor.outputs || Object.keys(processor.outputs).length === 0) return false;
    for (const [file, sha1] of Object.entries(processor.outputs)) {
      const target = this.resolveToken(file, data, paths);
      const expected = this.resolveToken(sha1, data, paths).replace(/'/g, '');
      if (!(await isFileValid(target, { sha1: expected }))) return false;
    }
    return true;
  }

  private async runProcessor(context: LoaderInstallContext, processor: Processor, data: Map<string, string>, java: string): Promise<void> {
    const { paths } = context;
    if (await this.outputsAreValid(processor, data, paths)) return;
    const jar = paths.library(mavenPath(processor.jar));
    const classpath = [jar, ...processor.classpath.map((name) => paths.library(mavenPath(name)))];
    const args = processor.args.map((arg) => this.resolveToken(arg, data, paths));
    await runJavaProcess(java, ['-cp', classpath.join(path.delimiter), readMainClass(jar), ...args], paths.root, context.download.signal);
  }
}
