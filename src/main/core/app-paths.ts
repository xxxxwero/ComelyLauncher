import { app } from 'electron';
import path from 'node:path';

export const LAUNCHER_NAME = 'ComelyLauncher';

export function launcherVersion(): string {
  return app.getVersion();
}

export function userDataPath(...segments: string[]): string {
  return path.join(app.getPath('userData'), ...segments);
}

export function defaultGameDirectory(): string {
  return path.join(app.getPath('appData'), '.comelylauncher');
}

export function iconPath(fileName: string): string {
  const base = app.isPackaged ? path.join(process.resourcesPath, 'icons') : path.join(__dirname, '..', '..', '..', '..', 'assets', 'icons');
  return path.join(base, fileName);
}
