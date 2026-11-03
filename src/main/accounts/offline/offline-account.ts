import { createHash } from 'node:crypto';
import { LauncherError } from '../../../shared/errors';

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,16}$/;

export function validateOfflineUsername(username: string): string {
  const trimmed = username.trim();
  if (!USERNAME_PATTERN.test(trimmed)) throw new LauncherError('invalid-input', 'Username must be 3-16 latin letters, digits or _');
  return trimmed;
}

export function offlineUuid(username: string): string {
  const hash = createHash('md5').update(`OfflinePlayer:${username}`, 'utf8').digest();
  hash[6] = (hash[6] & 0x0f) | 0x30;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  return hash.toString('hex');
}
