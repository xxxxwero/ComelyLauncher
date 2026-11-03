import { spawn } from 'node:child_process';
import { app } from 'electron';
import fs from 'node:fs/promises';
import { LauncherError } from '../../shared/errors';
import type { UpdateInfo, UpdateState, UpdateStatus } from '../../shared/types/updates';
import type { WindowManager } from '../app/window-manager';
import { userDataPath } from '../core/app-paths';
import { fileSize, hashFile } from '../core/file-system';
import { fetchJson } from '../core/http';
import { createLogger } from '../core/logger';
import type { RendererEvents } from '../core/renderer-events';
import { downloadFile } from '../downloads/download-manager';
import type { GameSessionService } from '../minecraft/launch/game-session-service';
import type { TaskManager } from '../tasks/task-manager';

const REPOSITORY = 'xxxxwero/ComelyLauncher';
const API_ORIGIN = process.env.COMELY_UPDATE_API ?? 'https://api.github.com';
const ASSET_NAME = 'ComelyLauncher-Setup.exe';
const SILENT_UPDATE_ARGUMENT = '--update';
const FIRST_CHECK_DELAY_MS = 15000;
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 20000;
const QUIT_DELAY_MS = 400;
const SHA256_PREFIX = 'sha256:';

const log = createLogger('updates');

interface ReleaseAsset {
  name?: string;
  browser_download_url?: string;
  size?: number;
  digest?: string | null;
}

interface Release {
  tag_name?: string;
  body?: string | null;
  published_at?: string | null;
  draft?: boolean;
  prerelease?: boolean;
  assets?: ReleaseAsset[];
}

interface Candidate {
  info: UpdateInfo;
  url: string;
  digest: string | null;
}

function parseVersion(version: string): number[] {
  return version.replace(/^v/i, '').split('-')[0].split('.').map((part) => Number(part) || 0);
}

export function isNewerVersion(candidate: string, current: string): boolean {
  const next = parseVersion(candidate);
  const installed = parseVersion(current);
  for (let index = 0; index < Math.max(next.length, installed.length); index++) {
    const difference = (next[index] ?? 0) - (installed[index] ?? 0);
    if (difference !== 0) return difference > 0;
  }
  return false;
}

export class UpdateService {
  private status: UpdateStatus = 'idle';
  private candidate: Candidate | null = null;
  private downloaded: string | null = null;

  constructor(
    private readonly tasks: TaskManager,
    private readonly events: RendererEvents,
    private readonly sessions: GameSessionService,
    private readonly windows: WindowManager
  ) {}

  start(): void {
    void fs.rm(userDataPath('updates'), { recursive: true, force: true }).catch(() => undefined);
    setTimeout(() => void this.check().catch(() => undefined), FIRST_CHECK_DELAY_MS).unref();
    setInterval(() => void this.check().catch(() => undefined), CHECK_INTERVAL_MS).unref();
  }

  state(): UpdateState {
    return { status: this.status, currentVersion: app.getVersion(), available: this.candidate?.info ?? null, sourceUrl: `https://github.com/${REPOSITORY}` };
  }

  async check(): Promise<UpdateState> {
    if (this.status === 'downloading' || this.status === 'ready') return this.state();
    this.setStatus('checking');
    try {
      const release = await this.fetchLatestRelease();
      this.candidate = release ? this.toCandidate(release) : null;
      this.setStatus(this.candidate ? 'available' : 'up-to-date');
    } catch (error) {
      log.warn('Could not check for updates', error);
      this.setStatus('failed');
    }
    return this.state();
  }

  download(): string {
    const candidate = this.candidate;
    if (!candidate) throw new LauncherError('invalid-input', 'No update is available');
    const target = userDataPath('updates', `ComelyLauncher-Setup-${candidate.info.version}.exe`);
    const task = this.tasks.create({
      kind: 'launcher-update',
      title: { key: 'tasks.updateLauncher', params: { version: candidate.info.version } },
      steps: [{ id: 'download', label: { key: 'tasks.step.download' } }]
    });
    this.setStatus('downloading');
    this.tasks
      .run(task, async (handle) => {
        handle.startStep('download');
        await downloadFile({ url: candidate.url, destination: target, size: candidate.info.sizeBytes }, { signal: handle.signal, onProgress: handle.downloadReporter('download') });
        await this.verify(target, candidate);
        this.downloaded = target;
      })
      .then(() => this.setStatus('ready'))
      .catch((error: unknown) => {
        log.warn('Could not download the update', error);
        this.setStatus('available');
      });
    return task.id;
  }

  install(): void {
    if (!this.downloaded) throw new LauncherError('invalid-input', 'The update is not downloaded');
    if (this.sessions.isActive()) throw new LauncherError('game-running', 'The game is running');
    const child = spawn(this.downloaded, [SILENT_UPDATE_ARGUMENT], { detached: true, stdio: 'ignore' });
    child.unref();
    setTimeout(() => this.windows.quit(), QUIT_DELAY_MS);
  }

  private async fetchLatestRelease(): Promise<Release | null> {
    try {
      return await fetchJson<Release>(`${API_ORIGIN}/repos/${REPOSITORY}/releases/latest`, { timeoutMs: REQUEST_TIMEOUT_MS, retries: 1, headers: { Accept: 'application/vnd.github+json' } });
    } catch (error) {
      if (error instanceof LauncherError && error.params?.status === 404) return null;
      throw error;
    }
  }

  private toCandidate(release: Release): Candidate | null {
    const version = release.tag_name?.replace(/^v/i, '');
    const asset = release.assets?.find((entry) => entry.name === ASSET_NAME);
    if (!version || release.draft || release.prerelease || !asset?.browser_download_url || !asset.size) return null;
    if (!isNewerVersion(version, app.getVersion())) return null;
    return {
      info: { version, notes: (release.body ?? '').trim(), publishedAt: release.published_at ?? null, sizeBytes: asset.size },
      url: asset.browser_download_url,
      digest: asset.digest?.startsWith(SHA256_PREFIX) ? asset.digest.slice(SHA256_PREFIX.length).toLowerCase() : null
    };
  }

  private async verify(file: string, candidate: Candidate): Promise<void> {
    const size = await fileSize(file);
    const validSize = size === candidate.info.sizeBytes;
    const validHash = !candidate.digest || (await hashFile(file, 'sha256')) === candidate.digest;
    if (validSize && validHash) return;
    await fs.rm(file, { force: true });
    throw new LauncherError('hash-mismatch', 'The downloaded update is damaged', { file: ASSET_NAME });
  }

  private setStatus(status: UpdateStatus): void {
    this.status = status;
    this.events.emit('updates:changed', this.state());
  }
}
