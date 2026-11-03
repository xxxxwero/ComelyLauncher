import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { LauncherError } from '../../shared/errors';
import { ensureDir, fileSize, sha1OfFile } from '../core/file-system';
import type { DownloadOptions, DownloadProgress, DownloadRequest } from './download-types';
import { openHttpStream } from './http-stream';
import { SpeedMeter } from './speed-meter';

const MAX_ATTEMPTS = 3;
const FILE_CHECK_CONCURRENCY = 32;
const CONNECT_TIMEOUT_MS = 30000;
const IDLE_TIMEOUT_MS = 30000;

async function needsDownload(request: DownloadRequest, verification: 'sha1' | 'size'): Promise<boolean> {
  const size = await fileSize(request.destination);
  if (size === null) return true;
  if (request.size !== undefined && request.size !== size) return true;
  if (verification === 'sha1' && request.sha1) {
    return (await sha1OfFile(request.destination)) !== request.sha1.toLowerCase();
  }
  return false;
}

async function runPool<T>(items: T[], concurrency: number, signal: AbortSignal | undefined, worker: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0;
  let failure: unknown = null;
  const next = async (): Promise<void> => {
    while (failure === null && cursor < items.length) {
      if (signal?.aborted) throw new LauncherError('cancelled');
      const item = items[cursor++];
      try {
        await worker(item);
      } catch (error) {
        failure = error;
        throw error;
      }
    }
  };
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => next());
  const results = await Promise.allSettled(workers);
  const rejected = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
  if (rejected) throw failure ?? rejected.reason;
}

function dedupe(requests: DownloadRequest[]): DownloadRequest[] {
  const seen = new Map<string, DownloadRequest>();
  for (const request of requests) {
    const key = path.resolve(request.destination).toLowerCase();
    if (!seen.has(key)) seen.set(key, request);
  }
  return [...seen.values()];
}

async function streamToFile(
  url: string,
  request: DownloadRequest,
  signal: AbortSignal,
  onActivity: () => void,
  onBytes: (bytes: number) => void
): Promise<string> {
  const response = await openHttpStream(url, signal);
  onActivity();
  await ensureDir(path.dirname(request.destination));
  const partFile = `${request.destination}.part`;
  const hash = createHash('sha1');
  const counter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      onActivity();
      hash.update(chunk);
      onBytes(chunk.length);
      callback(null, chunk);
    }
  });
  try {
    await pipeline(response, counter, createWriteStream(partFile), { signal });
  } catch (error) {
    await fs.rm(partFile, { force: true });
    throw error;
  }
  return hash.digest('hex');
}

async function downloadOnce(
  url: string,
  request: DownloadRequest,
  signal: AbortSignal | undefined,
  onBytes: (bytes: number) => void
): Promise<void> {
  const watchdog = new AbortController();
  const combined = signal ? AbortSignal.any([signal, watchdog.signal]) : watchdog.signal;
  let timer = setTimeout(() => watchdog.abort(), CONNECT_TIMEOUT_MS);
  const onActivity = (): void => {
    clearTimeout(timer);
    timer = setTimeout(() => watchdog.abort(), IDLE_TIMEOUT_MS);
  };
  let digest: string;
  try {
    digest = await streamToFile(url, request, combined, onActivity, onBytes);
  } catch (error) {
    if (signal?.aborted) throw new LauncherError('cancelled');
    if (watchdog.signal.aborted) throw new LauncherError('network', 'Download stalled', { url });
    throw error instanceof LauncherError ? error : new LauncherError('network', error instanceof Error ? error.message : String(error), { url });
  } finally {
    clearTimeout(timer);
  }
  const partFile = `${request.destination}.part`;
  if (request.sha1 && digest !== request.sha1.toLowerCase()) {
    await fs.rm(partFile, { force: true });
    throw new LauncherError('hash-mismatch', `SHA-1 mismatch for ${path.basename(request.destination)}`, { file: path.basename(request.destination) });
  }
  await fs.rm(request.destination, { force: true });
  await fs.rename(partFile, request.destination);
}

export async function allFilesPresent(requests: DownloadRequest[]): Promise<boolean> {
  let complete = true;
  await runPool(dedupe(requests), FILE_CHECK_CONCURRENCY, undefined, async (request) => {
    if (complete && (await needsDownload(request, 'size'))) complete = false;
  });
  return complete;
}

export async function downloadFiles(requests: DownloadRequest[], options: DownloadOptions = {}): Promise<void> {
  const verification = options.verification ?? 'sha1';
  const unique = dedupe(requests);
  const pending: DownloadRequest[] = [];
  await runPool(unique, 16, options.signal, async (request) => {
    if (await needsDownload(request, verification)) pending.push(request);
  });

  const speed = new SpeedMeter();
  const progress: DownloadProgress = {
    downloadedBytes: 0,
    totalBytes: pending.reduce((sum, request) => sum + (request.size ?? 0), 0),
    completedFiles: 0,
    totalFiles: pending.length,
    speedBytesPerSecond: 0,
    currentFile: null
  };
  let lastReport = 0;
  const report = (force: boolean): void => {
    const now = Date.now();
    if (!force && now - lastReport < 100) return;
    lastReport = now;
    progress.speedBytesPerSecond = speed.bytesPerSecond();
    options.onProgress?.({ ...progress });
  };
  report(true);
  if (pending.length === 0) return;

  await runPool(pending, options.concurrency ?? 8, options.signal, async (request) => {
    const urls = [request.url, ...(request.fallbackUrls ?? [])].filter((url) => url.length > 0);
    let lastError: unknown = null;
    for (let attempt = 0; attempt < MAX_ATTEMPTS * urls.length; attempt++) {
      const url = urls[attempt % urls.length];
      let received = 0;
      try {
        progress.currentFile = path.basename(request.destination);
        await downloadOnce(url, request, options.signal, (bytes) => {
          received += bytes;
          progress.downloadedBytes += bytes;
          if (request.size === undefined) progress.totalBytes += bytes;
          speed.record(bytes);
          report(false);
        });
        lastError = null;
        break;
      } catch (error) {
        progress.downloadedBytes -= received;
        if (request.size === undefined) progress.totalBytes -= received;
        lastError = error;
        if (options.signal?.aborted) throw new LauncherError('cancelled');
      }
    }
    if (lastError) throw lastError;
    progress.completedFiles += 1;
    report(false);
  });
  report(true);
}

export async function downloadFile(request: DownloadRequest, options: DownloadOptions = {}): Promise<void> {
  await downloadFiles([request], { ...options, concurrency: 1 });
}
