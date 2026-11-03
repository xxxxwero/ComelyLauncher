import type { LauncherServices } from '../app/services';
import { IpcRouter } from '../core/ipc-router';
import { registerAccountsIpc } from './accounts-ipc';
import { registerContentIpc } from './content-ipc';
import { registerGameIpc } from './game-ipc';
import { registerInstancesIpc } from './instances-ipc';
import { registerNewsIpc } from './news-ipc';
import { registerSettingsIpc } from './settings-ipc';
import { registerSupportIpc } from './support-ipc';
import { registerUpdatesIpc } from './updates-ipc';
import { registerWorldsIpc } from './worlds-ipc';

export function registerIpc(services: LauncherServices): void {
  const router = new IpcRouter();
  registerSettingsIpc(router, services);
  registerAccountsIpc(router, services);
  registerInstancesIpc(router, services);
  registerGameIpc(router, services);
  registerContentIpc(router, services);
  registerWorldsIpc(router, services);
  registerNewsIpc(router, services);
  registerSupportIpc(router, services);
  registerUpdatesIpc(router, services);
  router.listen();
}
