import fs from 'node:fs/promises';
import path from 'node:path';
import { LauncherError } from '../../shared/errors';
import type { ServerDraft, ServerEntry } from '../../shared/types/media';
import { writeFileAtomic } from '../core/file-system';
import { readNbt, TagType, writeNbt, type NbtTag } from './nbt';

type CompoundTag = Extract<NbtTag, { type: TagType.Compound }>;
type ListTag = Extract<NbtTag, { type: TagType.List }>;

function serversFile(instanceDir: string): string {
  return path.join(instanceDir, 'servers.dat');
}

async function readRoot(instanceDir: string): Promise<CompoundTag> {
  try {
    const { tag } = readNbt(await fs.readFile(serversFile(instanceDir)));
    return tag as CompoundTag;
  } catch {
    return { type: TagType.Compound, value: {} };
  }
}

function serverList(root: CompoundTag): ListTag {
  const existing = root.value.servers;
  if (existing && existing.type === TagType.List) return existing;
  const list: ListTag = { type: TagType.List, elementType: TagType.Compound, value: [] };
  root.value.servers = list;
  return list;
}

function stringField(tag: CompoundTag, key: string): string {
  const field = tag.value[key];
  return field?.type === TagType.String ? field.value : '';
}

function validateDraft(draft: ServerDraft): ServerDraft {
  const address = draft.address.trim();
  if (!address || /\s/.test(address)) throw new LauncherError('invalid-input', 'Server address is invalid');
  return { name: draft.name.trim() || 'Minecraft Server', address };
}

export async function readServers(instanceDir: string): Promise<ServerEntry[]> {
  const root = await readRoot(instanceDir);
  return serverList(root).value
    .filter((tag): tag is CompoundTag => tag.type === TagType.Compound)
    .map((tag, index) => {
      const icon = stringField(tag, 'icon');
      return {
        index,
        name: stringField(tag, 'name'),
        address: stringField(tag, 'ip'),
        iconDataUrl: icon ? `data:image/png;base64,${icon}` : null
      };
    });
}

export async function saveServer(instanceDir: string, index: number | null, draft: ServerDraft): Promise<ServerEntry[]> {
  const valid = validateDraft(draft);
  const root = await readRoot(instanceDir);
  const list = serverList(root);
  list.elementType = TagType.Compound;
  if (index === null) {
    list.value.push({
      type: TagType.Compound,
      value: { name: { type: TagType.String, value: valid.name }, ip: { type: TagType.String, value: valid.address } }
    });
  } else {
    const target = list.value[index];
    if (!target || target.type !== TagType.Compound) throw new LauncherError('invalid-input', 'Server not found');
    target.value.name = { type: TagType.String, value: valid.name };
    target.value.ip = { type: TagType.String, value: valid.address };
  }
  await writeFileAtomic(serversFile(instanceDir), writeNbt('', root));
  return readServers(instanceDir);
}

export async function removeServer(instanceDir: string, index: number): Promise<ServerEntry[]> {
  const root = await readRoot(instanceDir);
  const list = serverList(root);
  list.value.splice(index, 1);
  await writeFileAtomic(serversFile(instanceDir), writeNbt('', root));
  return readServers(instanceDir);
}
