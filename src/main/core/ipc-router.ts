import { ipcMain } from 'electron';
import { LauncherError, type IpcResult } from '../../shared/errors';
import { IPC_INVOKE_BRIDGE, type IpcArgs, type IpcChannel, type IpcReturn } from '../../shared/ipc/contract';
import { createLogger } from './logger';

type Handler<C extends IpcChannel> = (...args: IpcArgs<C>) => IpcReturn<C> | Promise<IpcReturn<C>>;
type AnyHandler = (...args: unknown[]) => unknown;

const log = createLogger('ipc');

export class IpcRouter {
  private readonly handlers = new Map<string, AnyHandler>();

  handle<C extends IpcChannel>(channel: C, handler: Handler<C>): void {
    if (this.handlers.has(channel)) throw new Error(`IPC handler already registered: ${channel}`);
    this.handlers.set(channel, handler as AnyHandler);
  }

  listen(): void {
    ipcMain.handle(IPC_INVOKE_BRIDGE, async (_event, channel: string, args: unknown[]): Promise<IpcResult<unknown>> => {
      const handler = this.handlers.get(channel);
      if (!handler) return { ok: false, error: { code: 'unknown', message: `Unknown channel ${channel}` } };
      try {
        return { ok: true, value: await handler(...(Array.isArray(args) ? args : [])) };
      } catch (error) {
        const launcherError = LauncherError.from(error);
        if (launcherError.code !== 'cancelled' && launcherError.code !== 'auth-cancelled') {
          log.error(`${channel} failed`, error);
        }
        return { ok: false, error: launcherError.serialize() };
      }
    });
  }
}
