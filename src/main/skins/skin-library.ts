import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { LauncherError } from '../../shared/errors';
import type { SkinLibraryEntry, SkinModel } from '../../shared/types/skins';
import { userDataPath } from '../core/app-paths';
import { readJsonFile, writeJsonFile } from '../core/file-system';
import { isValidSkin } from './png-info';

interface LibraryRecord {
  id: string;
  name: string;
  model: SkinModel;
  addedAt: number;
}

export class SkinLibrary {
  private readonly dir = userDataPath('skins');
  private readonly indexFile = path.join(this.dir, 'library.json');

  async list(): Promise<SkinLibraryEntry[]> {
    const records = await readJsonFile<LibraryRecord[]>(this.indexFile, []);
    const entries: SkinLibraryEntry[] = [];
    for (const record of records) {
      const data = await fs.readFile(this.file(record.id)).catch(() => null);
      if (data) entries.push({ ...record, dataUrl: `data:image/png;base64,${data.toString('base64')}` });
    }
    return entries.sort((a, b) => b.addedAt - a.addedAt);
  }

  async add(sourceFile: string): Promise<SkinLibraryEntry> {
    const data = await fs.readFile(sourceFile);
    if (!isValidSkin(data)) throw new LauncherError('skin-invalid', 'Skin must be a 64x64 or 64x32 PNG');
    const record: LibraryRecord = {
      id: randomUUID(),
      name: path.basename(sourceFile, path.extname(sourceFile)).slice(0, 32),
      model: 'classic',
      addedAt: Date.now()
    };
    await fs.mkdir(this.dir, { recursive: true });
    await fs.writeFile(this.file(record.id), data);
    await writeJsonFile(this.indexFile, [...(await readJsonFile<LibraryRecord[]>(this.indexFile, [])), record]);
    return { ...record, dataUrl: `data:image/png;base64,${data.toString('base64')}` };
  }

  async remove(skinId: string): Promise<SkinLibraryEntry[]> {
    const records = await readJsonFile<LibraryRecord[]>(this.indexFile, []);
    await writeJsonFile(this.indexFile, records.filter((record) => record.id !== skinId));
    await fs.rm(this.file(skinId), { force: true });
    return this.list();
  }

  async setModel(skinId: string, model: SkinModel): Promise<SkinLibraryEntry[]> {
    const records = await readJsonFile<LibraryRecord[]>(this.indexFile, []);
    await writeJsonFile(this.indexFile, records.map((record) => (record.id === skinId ? { ...record, model } : record)));
    return this.list();
  }

  async get(skinId: string): Promise<{ record: LibraryRecord; data: Buffer }> {
    const records = await readJsonFile<LibraryRecord[]>(this.indexFile, []);
    const record = records.find((entry) => entry.id === skinId);
    if (!record) throw new LauncherError('skin-invalid', 'Skin not found');
    return { record, data: await fs.readFile(this.file(skinId)) };
  }

  private file(skinId: string): string {
    return path.join(this.dir, `${skinId}.png`);
  }
}
