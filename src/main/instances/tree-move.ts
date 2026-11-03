import fs from 'node:fs/promises';
import path from 'node:path';
import { LauncherError } from '../../shared/errors';
import { ensureDir, pathExists } from '../core/file-system';

const BUSY_CODES = new Set(['EPERM', 'EBUSY', 'EACCES']);
const RENAME_ATTEMPTS = 4;
const RENAME_RETRY_MS = 300;

export interface MovedPath {
  from: string;
  to: string;
}

export interface TreeMoveOptions {
  moved: MovedPath[];
  signal?: AbortSignal;
  onProgress?: (fraction: number) => void;
}

export function isFilesBusyError(error: unknown): boolean {
  return BUSY_CODES.has((error as NodeJS.ErrnoException).code ?? '');
}

export function toMoveError(error: unknown): LauncherError {
  if (isFilesBusyError(error)) return new LauncherError('game-files-busy', error instanceof Error ? error.message : String(error));
  return LauncherError.from(error);
}

export async function renameWithRetries(source: string, target: string): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await fs.rename(source, target);
      return;
    } catch (error) {
      if (!isFilesBusyError(error) || attempt >= RENAME_ATTEMPTS) throw error;
      await new Promise((resolve) => setTimeout(resolve, RENAME_RETRY_MS));
    }
  }
}

export async function removeEmptyTree(directory: string): Promise<void> {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (entry.isDirectory()) await removeEmptyTree(path.join(directory, entry.name));
  }
  await fs.rmdir(directory).catch(() => undefined);
}

export async function moveTreeByFiles(source: string, target: string, options: TreeMoveOptions): Promise<void> {
  const entries = await fs.readdir(source, { recursive: true, withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile());
  await ensureDir(target);
  for (const entry of entries) {
    if (entry.isDirectory()) await ensureDir(path.join(target, path.relative(source, path.join(entry.parentPath, entry.name))));
  }
  for (const [position, entry] of files.entries()) {
    if (options.signal?.aborted) throw new LauncherError('cancelled');
    const from = path.join(entry.parentPath, entry.name);
    const to = path.join(target, path.relative(source, from));
    if (!(await pathExists(to))) {
      await renameWithRetries(from, to);
      options.moved.push({ from, to });
    }
    options.onProgress?.((position + 1) / files.length);
  }
  await removeEmptyTree(source);
}

export async function restoreMovedFiles(moved: MovedPath[]): Promise<string[]> {
  const failed: string[] = [];
  for (const { from, to } of [...moved].reverse()) {
    await ensureDir(path.dirname(from));
    await fs.rename(to, from).catch(() => failed.push(to));
  }
  return failed;
}
