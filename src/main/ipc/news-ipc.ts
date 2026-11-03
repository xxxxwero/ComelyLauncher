import type { LauncherServices } from '../app/services';
import type { IpcRouter } from '../core/ipc-router';

export function registerNewsIpc(router: IpcRouter, services: LauncherServices): void {
  router.handle('news:list', () => services.news.list());
  router.handle('news:canManage', () => services.support.isAdminIfEngaged());
  router.handle('news:create', (draft) => services.news.create(draft));
  router.handle('news:delete', (newsId, kind) => services.news.remove(newsId, kind));
}
