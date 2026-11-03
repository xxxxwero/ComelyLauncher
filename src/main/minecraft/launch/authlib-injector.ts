import path from 'node:path';
import { LauncherError } from '../../../shared/errors';
import { hashFile, pathExists, readJsonFile, writeJsonFile } from '../../core/file-system';
import type { GamePaths } from '../../core/game-paths';
import { fetchJson } from '../../core/http';
import { downloadFile } from '../../downloads/download-manager';

const LATEST_URL = 'https://authlib-injector.yushi.moe/artifact/latest.json';
const GITHUB_LATEST_URL = 'https://api.github.com/repos/yushijinhun/authlib-injector/releases/latest';
const UPDATE_CHECK_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

interface ArtifactInfo {
  version: string;
  url: string;
  sha256: string | null;
}

interface InstalledArtifact {
  version: string;
  checkedAt?: number;
}

async function latestArtifact(): Promise<ArtifactInfo> {
  try {
    const latest = await fetchJson<{ version: string; download_url: string; checksums?: { sha256?: string } }>(LATEST_URL, { timeoutMs: 15000 });
    return { version: latest.version, url: latest.download_url, sha256: latest.checksums?.sha256 ?? null };
  } catch {
    const release = await fetchJson<{ tag_name: string; assets: Array<{ name: string; browser_download_url: string }> }>(GITHUB_LATEST_URL, { timeoutMs: 15000 });
    const asset = release.assets.find((entry) => entry.name.endsWith('.jar'));
    if (!asset) throw new LauncherError('network', 'authlib-injector release has no jar');
    return { version: release.tag_name.replace(/^v/, ''), url: asset.browser_download_url, sha256: null };
  }
}

export async function ensureAuthlibInjector(paths: GamePaths, signal?: AbortSignal): Promise<string> {
  const jar = path.join(paths.cache, 'authlib-injector.jar');
  const metaFile = path.join(paths.cache, 'authlib-injector.json');
  const meta = await readJsonFile<InstalledArtifact | null>(metaFile, null);
  const jarExists = await pathExists(jar);
  if (jarExists && meta?.checkedAt && Date.now() - meta.checkedAt < UPDATE_CHECK_INTERVAL_MS) return jar;
  let artifact: ArtifactInfo;
  try {
    artifact = await latestArtifact();
  } catch (error) {
    if (jarExists) return jar;
    throw error;
  }
  if (meta?.version !== artifact.version || !jarExists) {
    await downloadFile({ url: artifact.url, destination: jar }, { signal });
    if (artifact.sha256 && (await hashFile(jar, 'sha256')) !== artifact.sha256.toLowerCase()) {
      throw new LauncherError('hash-mismatch', 'authlib-injector checksum mismatch', { file: 'authlib-injector.jar' });
    }
  }
  await writeJsonFile(metaFile, { version: artifact.version, checkedAt: Date.now() } satisfies InstalledArtifact);
  return jar;
}
