import { pickFile } from '../app/dialogs';
import type { LauncherServices } from '../app/services';
import type { IpcRouter } from '../core/ipc-router';

export function registerAccountsIpc(router: IpcRouter, services: LauncherServices): void {
  const { accounts, skins, windows } = services;

  router.handle('accounts:get', () => accounts.state());
  router.handle('accounts:loginMicrosoft', () => accounts.loginMicrosoft());
  router.handle('accounts:loginElyBy', (credentials) => accounts.loginElyBy(credentials));
  router.handle('accounts:addOffline', (username) => accounts.addOffline(username));
  router.handle('accounts:select', (accountId) => accounts.select(accountId));
  router.handle('accounts:remove', (accountId) => accounts.remove(accountId));
  router.handle('accounts:refresh', (accountId) => accounts.refresh(accountId));
  router.handle('accounts:setAvatar', (accountId, preset) => accounts.setAvatar(accountId, preset));

  router.handle('skins:profile', (accountId) => skins.profile(accountId));
  router.handle('skins:library', () => skins.listLibrary());
  router.handle('skins:import', async () => {
    const file = await pickFile(windows.current, [{ name: 'PNG', extensions: ['png'] }]);
    return file ? skins.addToLibrary(file) : null;
  });
  router.handle('skins:remove', (skinId) => skins.removeFromLibrary(skinId));
  router.handle('skins:setModel', (skinId, model) => skins.setLibraryModel(skinId, model));
  router.handle('skins:apply', (accountId, skinId) => skins.apply(accountId, skinId));
  router.handle('skins:setCape', (accountId, capeId) => skins.setCape(accountId, capeId));
}
