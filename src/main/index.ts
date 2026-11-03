import { app } from 'electron';
import { handleMediaProtocol, registerMediaScheme } from './app/media-protocol';
import { createServices } from './app/services';
import { userDataPath } from './core/app-paths';
import { createLogger } from './core/logger';
import { registerIpc } from './ipc/register-ipc';

const log = createLogger('app');

process.on('uncaughtException', (error) => log.error('Uncaught exception', error));
process.on('unhandledRejection', (reason) => log.error('Unhandled rejection', reason));

app.setAppUserModelId('com.comelylauncher.app');
registerMediaScheme();

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.whenReady()
    .then(async () => {
      const services = await createServices();
      handleMediaProtocol(() => [services.settings.gamePaths().root, userDataPath()]);
      registerIpc(services);
      services.windows.create();
      services.updates.start();
      app.on('second-instance', () => services.windows.show());
      app.on('before-quit', () => services.windows.quit());
      log.info(`ComelyLauncher ${app.getVersion()} started`);
    })
    .catch((error) => {
      log.error('Startup failed', error);
      app.quit();
    });
}

app.on('window-all-closed', () => undefined);
