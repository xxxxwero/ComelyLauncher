import type { LauncherServices } from '../app/services';
import type { IpcRouter } from '../core/ipc-router';

export function registerUpdatesIpc(router: IpcRouter, services: LauncherServices): void {
  const { updates } = services;

  router.handle('updates:state', () => updates.state());
  router.handle('updates:check', () => updates.check());
  router.handle('updates:download', () => updates.download());
  router.handle('updates:install', () => updates.install());
}
