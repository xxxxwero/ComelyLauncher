import { useEffect } from 'react';
import type { SkinProfile } from '../../shared/types/skins';
import { invoke } from '../api/launcher-api';
import { createStore, useStore } from './create-store';

export type SkinProfileEntry = { status: 'loading' } | { status: 'ready'; profile: SkinProfile } | { status: 'error'; error: unknown };

export const skinProfilesStore = createStore<Record<string, SkinProfileEntry>>({});

const RETRY_DELAYS_MS = [15000, 60000];

export async function loadSkinProfile(accountId: string, attempt = 0): Promise<void> {
  if (attempt === 0) skinProfilesStore.set((state) => ({ ...state, [accountId]: { status: 'loading' } }));
  try {
    const profile = await invoke('skins:profile', accountId);
    skinProfilesStore.set((state) => ({ ...state, [accountId]: { status: 'ready', profile } }));
  } catch (error) {
    skinProfilesStore.set((state) => ({ ...state, [accountId]: { status: 'error', error } }));
    const delay = RETRY_DELAYS_MS[attempt];
    if (delay) setTimeout(() => void loadSkinProfile(accountId, attempt + 1), delay);
  }
}

export function storeSkinProfile(profile: SkinProfile): void {
  skinProfilesStore.set((state) => ({ ...state, [profile.accountId]: { status: 'ready', profile } }));
}

export function useSkinProfile(accountId: string | null, enabled = true): SkinProfileEntry | null {
  const state = useStore(skinProfilesStore);
  const entry = accountId ? state[accountId] ?? null : null;
  useEffect(() => {
    if (accountId && enabled && !skinProfilesStore.get()[accountId]) void loadSkinProfile(accountId);
  }, [accountId, enabled]);
  return entry;
}
