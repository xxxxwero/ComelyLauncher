import type { MinecraftVersionEntry } from '../../shared/types/versions';
import { invoke } from '../api/launcher-api';
import { createStore, useStore } from './create-store';

export interface VersionsState {
  entries: MinecraftVersionEntry[];
  loading: boolean;
  error: unknown;
}

export const versionsStore = createStore<VersionsState>({ entries: [], loading: false, error: null });

export function useVersions(): VersionsState {
  return useStore(versionsStore);
}

export async function loadVersions(refresh = false): Promise<void> {
  if (versionsStore.get().loading) return;
  versionsStore.set((state) => ({ ...state, loading: true, error: null }));
  try {
    const entries = await invoke('versions:list', refresh);
    versionsStore.set({ entries, loading: false, error: null });
  } catch (error) {
    versionsStore.set((state) => ({ ...state, loading: false, error }));
  }
}

export function latestRelease(entries: MinecraftVersionEntry[]): string | null {
  return entries.find((entry) => entry.type === 'release')?.id ?? null;
}
