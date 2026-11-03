import fs from 'node:fs/promises';
import path from 'node:path';
import type { DriveInfo } from '../../shared/types/system';
import { defaultGameDirectory } from '../core/app-paths';

const GAME_FOLDER_NAME = 'ComelyLauncher';
const DRIVE_LETTERS = 'CDEFGHIJKLMNOPQRSTUVWXYZ';
const DRIVE_TIMEOUT_MS = 1500;

export function normalizeGameDirectory(directory: string): string {
  const resolved = path.resolve(directory);
  const isDedicated = path.basename(resolved).toLowerCase() === GAME_FOLDER_NAME.toLowerCase() || resolved.toLowerCase() === path.resolve(defaultGameDirectory()).toLowerCase();
  return isDedicated ? resolved : path.join(resolved, GAME_FOLDER_NAME);
}

async function readDrive(root: string): Promise<DriveInfo | null> {
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), DRIVE_TIMEOUT_MS));
  const stat = await Promise.race([fs.statfs(root).catch(() => null), timeout]);
  if (!stat || stat.blocks === 0) return null;
  return {
    root,
    gameDirectory: path.join(root, GAME_FOLDER_NAME),
    freeBytes: Number(stat.bavail) * Number(stat.bsize),
    totalBytes: Number(stat.blocks) * Number(stat.bsize)
  };
}

export async function listDrives(): Promise<DriveInfo[]> {
  const drives = await Promise.all([...DRIVE_LETTERS].map((letter) => readDrive(`${letter}:\\`)));
  return drives.filter((drive): drive is DriveInfo => drive !== null);
}
