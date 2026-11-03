import { safeStorage } from 'electron';
import fs from 'node:fs/promises';
import { userDataPath } from '../core/app-paths';
import { writeFileAtomic } from '../core/file-system';
import { createLogger } from '../core/logger';
import type { AccountsFile } from './account-types';

const ENCRYPTED_PREFIX = 'enc1:';
const PLAIN_PREFIX = 'plain:';
const log = createLogger('accounts');

export interface AccountsReadResult {
  data: AccountsFile;
  restoreFailed: boolean;
}

async function decode(raw: string): Promise<string> {
  if (raw.startsWith(ENCRYPTED_PREFIX)) {
    const { result } = await safeStorage.decryptStringAsync(Buffer.from(raw.slice(ENCRYPTED_PREFIX.length), 'base64'));
    return result;
  }
  return Buffer.from(raw.slice(PLAIN_PREFIX.length), 'base64').toString('utf8');
}

async function encode(json: string): Promise<string> {
  if (await safeStorage.isAsyncEncryptionAvailable()) {
    return `${ENCRYPTED_PREFIX}${(await safeStorage.encryptStringAsync(json)).toString('base64')}`;
  }
  return `${PLAIN_PREFIX}${Buffer.from(json, 'utf8').toString('base64')}`;
}

export class AccountStore {
  private readonly file = userDataPath('accounts.dat');
  private writing: Promise<void> = Promise.resolve();

  async read(): Promise<AccountsReadResult> {
    const empty: AccountsFile = { accounts: [], activeId: null };
    let raw: string;
    try {
      raw = await fs.readFile(this.file, 'utf8');
    } catch {
      return { data: empty, restoreFailed: false };
    }
    try {
      const parsed = JSON.parse(await decode(raw)) as AccountsFile;
      return { data: { accounts: parsed.accounts ?? [], activeId: parsed.activeId ?? null }, restoreFailed: false };
    } catch (error) {
      const preserved = userDataPath(`accounts.unreadable-${Date.now()}.dat`);
      log.warn(`Accounts file is unreadable, preserved as ${preserved}`, error);
      await fs.rename(this.file, preserved).catch((renameError: unknown) => log.warn('Could not preserve accounts file', renameError));
      return { data: empty, restoreFailed: true };
    }
  }

  write(data: AccountsFile): Promise<void> {
    const snapshot = JSON.stringify(data);
    this.writing = this.writing.catch(() => undefined).then(async () => writeFileAtomic(this.file, await encode(snapshot)));
    return this.writing;
  }
}
