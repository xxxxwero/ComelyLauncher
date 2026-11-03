import type { LauncherSettings, SettingsPatch } from '../../shared/types/settings';
import type { SystemInfo } from '../../shared/types/system';
import { invoke } from '../api/launcher-api';
import { createStore, useStore } from './create-store';

export const settingsStore = createStore<LauncherSettings | null>(null);
export const systemInfoStore = createStore<SystemInfo | null>(null);

export function useSettings(): LauncherSettings {
  const settings = useStore(settingsStore);
  if (!settings) throw new Error('Settings are not loaded');
  return settings;
}

export function useSystemInfo(): SystemInfo | null {
  return useStore(systemInfoStore);
}

export async function loadSettings(): Promise<void> {
  const [settings, info] = await Promise.all([invoke('settings:get'), invoke('settings:systemInfo')]);
  settingsStore.set(settings);
  systemInfoStore.set(info);
}

export async function updateSettings(patch: SettingsPatch): Promise<LauncherSettings> {
  const updated = await invoke('settings:update', patch);
  settingsStore.set(updated);
  return updated;
}

export async function resetSettings(): Promise<void> {
  settingsStore.set(await invoke('settings:reset'));
}
