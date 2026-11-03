import { gunzip } from 'node:zlib';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import type { WorldGameMode } from '../../shared/types/worlds';
import { readNbt, TagType, type NbtTag } from '../servers/nbt';

const gunzipAsync = promisify(gunzip);

const GAME_MODES: WorldGameMode[] = ['survival', 'creative', 'adventure', 'spectator'];

export interface LevelSummary {
  name: string | null;
  gameMode: WorldGameMode | null;
  gameVersion: string | null;
  lastPlayedAt: number | null;
}

function child(tag: NbtTag | undefined, name: string): NbtTag | undefined {
  return tag?.type === TagType.Compound ? tag.value[name] : undefined;
}

function numberValue(tag: NbtTag | undefined): number | null {
  if (tag?.type === TagType.Long) return Number(tag.value);
  if (tag?.type === TagType.Int || tag?.type === TagType.Byte) return tag.value;
  return null;
}

function stringValue(tag: NbtTag | undefined): string | null {
  return tag?.type === TagType.String ? tag.value : null;
}

export async function readLevelSummary(worldDir: string): Promise<LevelSummary | null> {
  const raw = await fs.readFile(path.join(worldDir, 'level.dat')).catch(() => null);
  if (!raw) return null;
  try {
    const data = child(readNbt(await gunzipAsync(raw)).tag, 'Data');
    const gameType = numberValue(child(data, 'GameType'));
    const hardcore = numberValue(child(data, 'hardcore')) === 1;
    return {
      name: stringValue(child(data, 'LevelName')),
      gameMode: hardcore ? 'hardcore' : gameType === null ? null : GAME_MODES[gameType] ?? null,
      gameVersion: stringValue(child(child(data, 'Version'), 'Name')),
      lastPlayedAt: numberValue(child(data, 'LastPlayed'))
    };
  } catch {
    return { name: null, gameMode: null, gameVersion: null, lastPlayedAt: null };
  }
}

export async function listFiles(root: string): Promise<Array<{ absolute: string; relative: string; size: number }>> {
  const entries = await fs.readdir(root, { recursive: true, withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const absolute = path.join(entry.parentPath, entry.name);
    const stat = await fs.stat(absolute).catch(() => null);
    if (stat) files.push({ absolute, relative: path.relative(root, absolute).split(path.sep).join('/'), size: stat.size });
  }
  return files;
}
