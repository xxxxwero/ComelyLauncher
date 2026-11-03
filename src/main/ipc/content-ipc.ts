import type { LauncherServices } from '../app/services';
import type { IpcRouter } from '../core/ipc-router';

export function registerContentIpc(router: IpcRouter, services: LauncherServices): void {
  const { content, screenshots } = services;

  router.handle('content:search', (query) => content.search(query));
  router.handle('content:install', (instanceId, projectId, type) => content.install(instanceId, projectId, type));
  router.handle('content:installModpack', (projectId) => content.installModpack(projectId));

  router.handle('screenshots:list', () => screenshots.list());
  router.handle('screenshots:copy', (file) => screenshots.copy(file));
  router.handle('screenshots:reveal', (file) => screenshots.reveal(file));
  router.handle('screenshots:delete', (file) => screenshots.remove(file));
}
