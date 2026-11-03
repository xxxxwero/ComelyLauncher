import { useEffect } from 'react';
import type { ServerStatus } from '../../shared/types/media';
import { invoke } from '../api/launcher-api';
import { createStore, useStore } from './create-store';

const FRESH_MS = 60000;

export type ServerStatusEntry = { status: 'pinging'; checkedAt: number } | { status: 'done'; checkedAt: number; result: ServerStatus };

export const serverStatusStore = createStore<Record<string, ServerStatusEntry>>({});

export async function pingServer(address: string): Promise<void> {
  serverStatusStore.set((state) => ({ ...state, [address]: { status: 'pinging', checkedAt: Date.now() } }));
  const result = await invoke('servers:ping', address).catch(
    (): ServerStatus => ({ address, online: false, motd: [], playersOnline: 0, playersMax: 0, versionName: null, latencyMs: null, iconDataUrl: null })
  );
  serverStatusStore.set((state) => ({ ...state, [address]: { status: 'done', checkedAt: Date.now(), result } }));
}

export function useServerStatus(address: string): ServerStatusEntry | null {
  const state = useStore(serverStatusStore);
  useEffect(() => {
    const entry = serverStatusStore.get()[address];
    if (!entry || Date.now() - entry.checkedAt > FRESH_MS) void pingServer(address);
  }, [address]);
  return state[address] ?? null;
}
