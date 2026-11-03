import type { LauncherServices } from '../app/services';
import type { IpcRouter } from '../core/ipc-router';

export function registerSupportIpc(router: IpcRouter, services: LauncherServices): void {
  const { support } = services;

  router.handle('support:session', () => support.session());
  router.handle('support:unread', () => support.unread());
  router.handle('support:tickets', (status) => support.tickets(status));
  router.handle('support:thread', (ticketId) => support.thread(ticketId));
  router.handle('support:create', (draft) => support.create(draft));
  router.handle('support:reply', (ticketId, text) => support.reply(ticketId, text));
  router.handle('support:setStatus', (ticketId, status) => support.setStatus(ticketId, status));
  router.handle('support:setBlocked', (ticketId, blocked) => support.setBlocked(ticketId, blocked));
  router.handle('support:log', (ticketId) => support.ticketLog(ticketId));
}
