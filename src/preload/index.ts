import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { IPC_DOMAINS, IPC_EVENT_BRIDGE, IPC_INVOKE_BRIDGE } from '../shared/ipc/contract';

type Listener = (payload: unknown) => void;

const listeners = new Map<string, Set<Listener>>();

ipcRenderer.on(IPC_EVENT_BRIDGE,(_event: IpcRendererEvent, name: string, payload: unknown) => {
  for (const listener of listeners.get(name) ?? []) listener(payload);
});

function isAllowedChannel(channel: string): boolean {
  const domain = channel.split(':')[0];
  return (IPC_DOMAINS as readonly string[]).includes(domain);
}

contextBridge.exposeInMainWorld('comely', {
  invoke(channel: string, args: unknown[]): Promise<unknown> {
    if (!isAllowedChannel(channel)) return Promise.reject(new Error(`Channel ${channel} is not allowed`));
    return ipcRenderer.invoke(IPC_INVOKE_BRIDGE, channel, args);
  },
  on(name: string, listener: Listener): () => void {
    const set = listeners.get(name) ?? new Set<Listener>();
    set.add(listener);
    listeners.set(name, set);
    return () => set.delete(listener);
  }
});
