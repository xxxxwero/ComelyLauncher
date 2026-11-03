import path from 'node:path';
import { LauncherError } from '../../shared/errors';
import { ensureDir, pathExists, readJsonFile, writeJsonFile } from '../core/file-system';
import type { GamePaths } from '../core/game-paths';
import { fetchJson } from '../core/http';
import { downloadFiles } from '../downloads/download-manager';
import type { DownloadOptions, DownloadRequest } from '../downloads/download-types';

const RUNTIME_INDEX_URL = 'https://launchermeta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json';
const MARKER_FILE = '.comely-runtime.json';

interface RuntimeRelease {
  manifest: { sha1: string; size: number; url: string };
  version: { name: string; released: string };
}

type RuntimeIndex = Record<string, Record<string, RuntimeRelease[]>>;

interface RuntimeManifest {
  files: Record<string, { type: 'file' | 'directory' | 'link'; executable?: boolean; downloads?: { raw: { sha1: string; size: number; url: string } } }>;
}

interface RuntimeMarker {
  manifestSha1: string;
  versionName: string;
}

function platformKeys(): string[] {
  if (process.arch === 'ia32') return ['windows-x86'];
  if (process.arch === 'arm64') return ['windows-arm64', 'windows-x64'];
  return ['windows-x64'];
}

export class JavaRuntimeInstaller {
  private index: RuntimeIndex | null = null;

  executable(paths: GamePaths, component: string): string {
    return path.join(paths.runtime(component), 'bin', 'javaw.exe');
  }

  async ensure(paths: GamePaths, component: string, options: DownloadOptions): Promise<string> {
    const executable = this.executable(paths, component);
    const markerPath = path.join(paths.runtime(component), MARKER_FILE);
    const marker = await readJsonFile<RuntimeMarker | null>(markerPath, null);
    if (marker && (await pathExists(executable))) return executable;
    const release = await this.findRelease(component);

    const manifest = await fetchJson<RuntimeManifest>(release.manifest.url, { signal: options.signal });
    const root = paths.runtime(component);
    const requests: DownloadRequest[] = [];
    for (const [relative, entry] of Object.entries(manifest.files)) {
      const target = path.join(root, ...relative.split('/'));
      if (entry.type === 'directory') await ensureDir(target);
      else if (entry.type === 'file' && entry.downloads?.raw) {
        requests.push({ url: entry.downloads.raw.url, destination: target, sha1: entry.downloads.raw.sha1, size: entry.downloads.raw.size });
      }
    }
    await downloadFiles(requests, { ...options, verification: 'sha1', concurrency: 12 });
    await writeJsonFile(markerPath, { manifestSha1: release.manifest.sha1, versionName: release.version.name } satisfies RuntimeMarker);
    if (!(await pathExists(executable))) throw new LauncherError('java-not-found', `Runtime ${component} has no javaw.exe`);
    return executable;
  }

  private async findRelease(component: string): Promise<RuntimeRelease> {
    if (!this.index) this.index = await fetchJson<RuntimeIndex>(RUNTIME_INDEX_URL, { timeoutMs: 20000 });
    for (const platform of platformKeys()) {
      const release = this.index[platform]?.[component]?.[0];
      if (release) return release;
    }
    throw new LauncherError('java-not-found', `Mojang runtime ${component} is not available for Windows`, { component });
  }
}
