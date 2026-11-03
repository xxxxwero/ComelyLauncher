import { shell } from 'electron';
import { LauncherError } from '../../shared/errors';
import { pickDirectory, pickFile, pickFiles } from '../app/dialogs';
import type { LauncherServices } from '../app/services';
import { defaultGameDirectory, launcherVersion } from '../core/app-paths';
import type { IpcRouter } from '../core/ipc-router';
import { totalMemoryMb } from '../settings/default-settings';
import { listDrives, normalizeGameDirectory } from '../settings/game-directory';

export function registerSettingsIpc(router: IpcRouter, services: LauncherServices): void {
  const { settings, backgrounds, windows, java } = services;

  router.handle('settings:get', () => settings.get());
  router.handle('settings:update', async (patch) => {
    const previousRoot = settings.gamePaths().root;
    const updated = await settings.update(patch);
    if (settings.gamePaths().root !== previousRoot) await services.instances.emitChanged();
    return updated;
  });
  router.handle('settings:reset', () => settings.reset());
  router.handle('settings:pickGameDirectory', async () => {
    const directory = await pickDirectory(windows.current, settings.get().launcher.gameDirectory);
    return directory ? normalizeGameDirectory(directory) : null;
  });
  router.handle('settings:drives', () => listDrives());
  router.handle('settings:pickJavaExecutable', () => pickFile(windows.current, [{ name: 'Java', extensions: ['exe'] }]));
  router.handle('settings:addBackgrounds', async () => {
    const files = await pickFiles(windows.current, [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }]);
    return files.length > 0 ? backgrounds.add(files) : null;
  });
  router.handle('settings:removeBackground', (backgroundId) => backgrounds.remove(backgroundId));
  router.handle('settings:systemInfo', () => ({
    totalMemoryMb: totalMemoryMb(),
    launcherVersion: launcherVersion(),
    defaultGameDirectory: defaultGameDirectory()
  }));

  router.handle('java:detect', () => java.detect(settings.gamePaths()));

  router.handle('window:minimize', () => windows.minimize());
  router.handle('window:toggleMaximize', () => windows.toggleMaximize());
  router.handle('window:close', () => windows.close());
  router.handle('window:hideToTray', () => windows.hideToTray());
  router.handle('window:state', () => windows.state());

  router.handle('shell:openExternal', async (url) => {
    if (!/^https?:\/\//i.test(url)) throw new LauncherError('invalid-input', 'Only web links can be opened');
    await shell.openExternal(url);
  });
}
