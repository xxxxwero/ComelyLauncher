import type { UpdateState } from '../../shared/types/updates';
import { invoke } from '../api/launcher-api';
import { createStore, useStore } from './create-store';

export const updatesStore = createStore<UpdateState | null>(null);

export function useUpdates(): UpdateState | null {
  return useStore(updatesStore);
}

export async function loadUpdates(): Promise<void> {
  updatesStore.set(await invoke('updates:state'));
}
