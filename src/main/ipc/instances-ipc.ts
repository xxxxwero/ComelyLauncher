import { shell } from 'electron';
import { LauncherError } from '../../shared/errors';
import { pickDirectory, pickFile, pickSaveFile } from '../app/dialogs';
import { listModrinthProfiles } from '../content/import/modrinth-app-profiles';
import { defaultPrismInstancesDirectory } from '../content/import/prism-package';
import type { LauncherServices } from '../app/services';
import type { IpcRouter } from '../core/ipc-router';
import { sanitizeFolderName } from '../instances/instance-folder-name';
import { pingServer } from '../servers/server-pinger';
import { readServers, removeServer, saveServer } from '../servers/servers-file';

export function registerInstancesIpc(router: IpcRouter, services: LauncherServices): void {
  const { instances, gameDirectoryMover, instanceCopier, mrpackExporter, installedContent, content, sessions, tasks, windows } = services;

  const ensureNotPlaying = (instanceId: string): void => {
    if (sessions.isActive() && sessions.current()?.instanceId === instanceId) throw new LauncherError('game-running', 'The instance is running');
  };

  router.handle('instances:list', () => instances.list());
  router.handle('instances:create', (draft) => instances.create(draft));
  router.handle('instances:update', (instanceId, patch) => instances.update(instanceId, patch));
  router.handle('instances:remove', (instanceId) => instances.remove(instanceId));
  router.handle('instances:ensureForVersion', (gameVersion, loader) => instances.ensureForVersion(gameVersion, loader));
  router.handle('instances:moveToDirectory', (gameDirectory) => {
    if (sessions.isActive()) throw new LauncherError('game-running', 'The game is running');
    if (tasks.list().some((task) => task.state === 'running')) throw new LauncherError('tasks-running', 'Tasks are running');
    return gameDirectoryMover.start(gameDirectory);
  });
  router.handle('instances:moveEstimate', (gameDirectory) => gameDirectoryMover.estimate(gameDirectory));
  router.handle('instances:duplicate', (instanceId, name) => {
    ensureNotPlaying(instanceId);
    return instanceCopier.start(instanceId, name);
  });
  router.handle('instances:exportMrpack', async (instanceId) => {
    ensureNotPlaying(instanceId);
    const instance = await instances.get(instanceId);
    const target = await pickSaveFile(windows.current, `${sanitizeFolderName(instance.name)}.mrpack`, [{ name: 'Modrinth', extensions: ['mrpack'] }]);
    return target ? mrpackExporter.start(instanceId, target, () => shell.showItemInFolder(target)) : null;
  });
  router.handle('instances:openFolder', (instanceId, folder) => instances.openFolder(instanceId, folder));
  router.handle('instances:importModpack', async () => {
    const file = await pickFile(windows.current, [{ name: 'Modrinth, Prism, MultiMC', extensions: ['mrpack', 'zip'] }]);
    return file ? content.importModpackFile(file) : null;
  });
  router.handle('instances:importFolder', async () => {
    const folder = await pickDirectory(windows.current, await defaultPrismInstancesDirectory());
    return folder ? content.importInstanceFolder(folder) : null;
  });

  router.handle('instances:modrinthProfiles', () => listModrinthProfiles());
  router.handle('instances:importModrinthProfile', (profileId) => content.importModrinthProfile(profileId));

  router.handle('instances:content',(instanceId) => installedContent.list(instanceId));
  router.handle('instances:setContentEnabled', (instanceId, kind, fileNames, enabled) => installedContent.setEnabled(instanceId, kind, fileNames, enabled));
  router.handle('instances:removeContent', (instanceId, kind, fileNames) => installedContent.remove(instanceId, kind, fileNames));
  router.handle('instances:checkUpdates', (instanceId) => installedContent.checkUpdates(instanceId));
  router.handle('instances:updateContent', (instanceId, fileNames) => content.update(instanceId, fileNames));
  router.handle('instances:revealContent', (instanceId, kind, fileName) => installedContent.reveal(instanceId, kind, fileName));

  router.handle('instances:servers', (instanceId) => readServers(instances.dir(instanceId)));
  router.handle('instances:saveServer', (instanceId, index, draft) => saveServer(instances.dir(instanceId), index, draft));
  router.handle('instances:removeServer', (instanceId, index) => removeServer(instances.dir(instanceId), index));
  router.handle('servers:ping', (address) => pingServer(address));
}
