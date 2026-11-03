import type { Instance } from '../../shared/types/instances';
import { invoke } from '../api/launcher-api';
import { createStore, useStore } from './create-store';
import { settingsStore, updateSettings } from './settings-store';

export const instancesStore = createStore<Instance[]>([]);

export function useInstances(): Instance[] {
  return useStore(instancesStore);
}

export function useSelectedInstance(): Instance | null {
  const instances = useInstances();
  const settings = useStore(settingsStore);
  return instances.find((instance) => instance.id === settings?.selectedInstanceId) ?? instances[0] ?? null;
}

export function useInstance(instanceId: string | undefined): Instance | null {
  const instances = useInstances();
  return instances.find((instance) => instance.id === instanceId) ?? null;
}

export async function loadInstances(): Promise<void> {
  instancesStore.set(await invoke('instances:list'));
}

export async function selectInstance(instanceId: string): Promise<void> {
  await updateSettings({ selectedInstanceId: instanceId });
}
