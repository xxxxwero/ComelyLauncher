import fs from 'node:fs/promises';
import path from 'node:path';
import { LauncherError } from '../../shared/errors';
import type { LauncherServices } from '../app/services';
import type { IpcRouter } from '../core/ipc-router';
import { copyLogToClipboard } from '../minecraft/launch/log-sharing';

async function collectLogLines(services: LauncherServices): Promise<string[]> {
  const buffered = services.sessions.logLines();
  if (buffered.length > 0) return buffered;
  const session = services.sessions.current();
  if (!session) throw new LauncherError('log-unavailable', 'No game session');
  const latest = path.join(services.instances.dir(session.instanceId), 'logs', 'latest.log');
  const content = await fs.readFile(latest, 'utf8').catch(() => '');
  return content.split(/\r?\n/).filter(Boolean);
}

export function registerGameIpc(router: IpcRouter, services: LauncherServices): void {
  const { versions, loaders, sessions, tasks, instances } = services;

  router.handle('versions:list', (refresh) => versions.list(refresh));
  router.handle('versions:loaderVersions', (loader, gameVersion) => loaders.listVersions(loader, gameVersion));
  router.handle('versions:openFolder', (versionId) => versions.openFolder(versionId));

  router.handle('game:install', (instanceId) => sessions.install(instanceId));
  router.handle('game:launch', (instanceId, options) => sessions.launch(instanceId, options));
  router.handle('game:stop', () => sessions.stop());
  router.handle('game:session', () => sessions.current());
  router.handle('game:dismiss', () => sessions.dismiss());
  router.handle('game:logs', () => sessions.logLines());
  router.handle('game:openLogsFolder', async () => {
    const session = sessions.current();
    if (!session) throw new LauncherError('log-unavailable', 'No game session');
    await instances.openFolder(session.instanceId, 'logs');
  });
  router.handle('game:copyLog', async () => copyLogToClipboard(await collectLogLines(services)));

  router.handle('tasks:list', () => tasks.list());
  router.handle('tasks:cancel', (taskId) => tasks.cancel(taskId));
  router.handle('tasks:dismiss', (taskId) => tasks.dismiss(taskId));
}
