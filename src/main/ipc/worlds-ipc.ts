import { LauncherError } from '../../shared/errors';
import type { LauncherServices } from '../app/services';
import type { IpcRouter } from '../core/ipc-router';

export function registerWorldsIpc(router: IpcRouter, services: LauncherServices): void {
  const { worlds, sessions } = services;

  const ensureNotPlaying = (instanceId: string): void => {
    if (sessions.isActive() && sessions.current()?.instanceId === instanceId) throw new LauncherError('game-running', 'The instance is running');
  };

  router.handle('worlds:list', (instanceId) => worlds.list(instanceId));
  router.handle('worlds:backups', (instanceId) => worlds.listBackups(instanceId));
  router.handle('worlds:backup', (instanceId, folder) => {
    ensureNotPlaying(instanceId);
    return worlds.startBackup(instanceId, folder);
  });
  router.handle('worlds:restore', (instanceId, fileName) => {
    ensureNotPlaying(instanceId);
    return worlds.startRestore(instanceId, fileName);
  });
  router.handle('worlds:remove', (instanceId, folder) => {
    ensureNotPlaying(instanceId);
    return worlds.removeWorld(instanceId, folder);
  });
  router.handle('worlds:removeBackup', (instanceId, fileName) => worlds.removeBackup(instanceId, fileName));
  router.handle('worlds:revealBackup', (instanceId, fileName) => worlds.revealBackup(instanceId, fileName));
}
