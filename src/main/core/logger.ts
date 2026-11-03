import fs from 'node:fs';
import path from 'node:path';
import { userDataPath } from './app-paths';

type Level = 'INFO' | 'WARN' | 'ERROR';

let stream: fs.WriteStream | null = null;

function output(): fs.WriteStream {
  if (!stream) {
    const dir = userDataPath('logs');
    fs.mkdirSync(dir, { recursive: true });
    stream = fs.createWriteStream(path.join(dir, 'launcher.log'), { flags: 'w' });
  }
  return stream;
}

function write(level: Level, scope: string, message: string, error?: unknown): void {
  const details = error instanceof Error ? ` ${error.stack ?? error.message}` : error ? ` ${String(error)}` : '';
  const line = `[${new Date().toISOString()}] [${level}] [${scope}] ${message}${details}`;
  output().write(`${line}\n`);
  if (level === 'ERROR') console.error(line);
  else console.log(line);
}

export interface Logger {
  info(message: string): void;
  warn(message: string, error?: unknown): void;
  error(message: string, error?: unknown): void;
}

export function createLogger(scope: string): Logger {
  return {
    info: (message) => write('INFO', scope, message),
    warn: (message, error) => write('WARN', scope, message, error),
    error: (message, error) => write('ERROR', scope, message, error)
  };
}
