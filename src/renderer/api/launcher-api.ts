import { LauncherError, type IpcResult } from '../../shared/errors';
import type { IpcArgs, IpcChannel, IpcEventName, IpcEvents, IpcReturn } from '../../shared/ipc/contract';

export async function invoke<C extends IpcChannel>(channel: C, ...args: IpcArgs<C>): Promise<IpcReturn<C>> {
  const result = (await window.comely.invoke(channel, args)) as IpcResult<IpcReturn<C>>;
  if (!result.ok) throw LauncherError.fromSerialized(result.error);
  return result.value;
}

export function subscribe<E extends IpcEventName>(name: E, listener: (payload: IpcEvents[E]) => void): () => void {
  return window.comely.on(name, (payload) => listener(payload as IpcEvents[E]));
}
