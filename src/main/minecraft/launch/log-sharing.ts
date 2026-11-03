import { clipboard } from 'electron';
import os from 'node:os';
import { LauncherError } from '../../../shared/errors';

const SESSION_PATTERN = /token:[^:\s)]+/g;
const JWT_PATTERN = /eyJ[\w-]+\.[\w-]+\.[\w-]+/g;

export function sanitizeLog(text: string): string {
  const home = os.homedir();
  return text.split(home).join('<home>').split(home.replace(/\\/g, '/')).join('<home>').replace(SESSION_PATTERN, 'token:<hidden>').replace(JWT_PATTERN, '<hidden>');
}

export async function copyLogToClipboard(lines: string[]): Promise<void> {
  if (lines.length === 0) throw new LauncherError('log-unavailable', 'No log to copy');
  await clipboard.writeText(sanitizeLog(lines.join('\n')));
}
