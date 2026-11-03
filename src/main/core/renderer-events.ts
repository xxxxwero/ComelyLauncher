import type { BrowserWindow } from 'electron';
import { IPC_EVENT_BRIDGE, type IpcEventName, type IpcEvents } from '../../shared/ipc/contract';

export class RendererEvents {
  private window: BrowserWindow | null = null;

  attach(window: BrowserWindow): void {
    this.window = window;
  }

  emit<E extends IpcEventName>(name: E, payload: IpcEvents[E]): void {
    const window = this.window;
    if (!window || window.isDestroyed()) return;
    window.webContents.send(IPC_EVENT_BRIDGE, name, payload);
  }
}
