import { createHash } from 'node:crypto';
import { constants as fsConstants, createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { LauncherError } from '../../shared/errors';

const RETRYABLE_RENAME_CODES = new Set(['EPERM', 'EBUSY', 'EACCES']);
const RENAME_ATTEMPTS = 6;
const RENAME_RETRY_MS = 80;
let tempCounter = 0;

export async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(target: string): Promise<void> {
  await fs.mkdir(target, { recursive: true });
}

export async function readJsonFile<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeFileAtomic(file: string, data: string | Buffer): Promise<void> {
  await ensureDir(path.dirname(file));
  const temp = `${file}.${process.pid}.${Date.now()}.${tempCounter++}.tmp`;
  await fs.writeFile(temp, data);
  await renameWithRetry(temp, file);
}

async function renameWithRetry(from: string, to: string): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await fs.rename(from, to);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code ?? '';
      if (!RETRYABLE_RENAME_CODES.has(code) || attempt >= RENAME_ATTEMPTS) {
        await fs.rm(from, { force: true });
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, RENAME_RETRY_MS));
    }
  }
}

export async function writeJsonFile(file: string, value: unknown): Promise<void> {
  await writeFileAtomic(file, JSON.stringify(value, null, 2));
}

export async function fileSize(file: string): Promise<number | null> {
  try {
    const stat = await fs.stat(file);
    return stat.size;
  } catch {
    return null;
  }
}

export function sha1OfFile(file: string): Promise<string> {
  return hashFile(file, 'sha1');
}

export function hashFile(file: string, algorithm: 'sha1' | 'sha256' | 'sha512'): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash(algorithm);
    const stream = createReadStream(file);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

export async function isFileValid(file: string, expected: { sha1?: string; size?: number }): Promise<boolean> {
  const size = await fileSize(file);
  if (size === null) return false;
  if (expected.size !== undefined && expected.size !== size) return false;
  if (expected.sha1) return (await sha1OfFile(file)) === expected.sha1.toLowerCase();
  return true;
}

export async function listDirectory(dir: string): Promise<string[]> {
  try {
    return await fs.readdir(dir);
  } catch {
    return [];
  }
}

export interface CopyTreeOptions {
  exclude?: Set<string>;
  keepExisting?: boolean;
  createdFiles?: string[];
  signal?: AbortSignal;
  onProgress?: (fraction: number) => void;
}

export async function copyTree(source: string, target: string, options: CopyTreeOptions = {}): Promise<void> {
  const entries = await fs.readdir(source, { recursive: true, withFileTypes: true });
  const included = entries.filter((entry) => {
    const topLevel = path.relative(source, path.join(entry.parentPath, entry.name)).split(path.sep)[0];
    return !options.exclude?.has(topLevel);
  });
  const files = included.filter((entry) => entry.isFile());
  await ensureDir(target);
  for (const entry of included) {
    if (entry.isDirectory()) await ensureDir(path.join(target, path.relative(source, path.join(entry.parentPath, entry.name))));
  }
  for (const [position, entry] of files.entries()) {
    if (options.signal?.aborted) throw new LauncherError('cancelled');
    const from = path.join(entry.parentPath, entry.name);
    const to = path.join(target, path.relative(source, from));
    await ensureDir(path.dirname(to));
    await copyTreeFile(from, to, options);
    options.onProgress?.((position + 1) / files.length);
  }
}

async function copyTreeFile(from: string, to: string, options: CopyTreeOptions): Promise<void> {
  options.createdFiles?.push(to);
  try {
    await fs.copyFile(from, to, options.keepExisting ? fsConstants.COPYFILE_EXCL : 0);
  } catch (error) {
    if (!options.keepExisting || (error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    options.createdFiles?.pop();
  }
}

export async function moveDirectory(source: string, target: string): Promise<void> {
  await ensureDir(path.dirname(target));
  try {
    await fs.rename(source, target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error;
    await fs.cp(source, target, { recursive: true, errorOnExist: true, force: false });
    await fs.rm(source, { recursive: true, force: true });
  }
}

export function isInside(parent: string, child: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}
