import type { InstanceLoader } from '../../../shared/types/instances';
import type { TaskHandle } from '../../tasks/task-manager';

const MAX_NAME_LENGTH = 48;

export const TRANSIENT_FOLDERS = ['logs', 'crash-reports', '.fabric', '.mixin.out', '.cache'];

export type PackageSource = 'extracted-archive' | 'external-folder';

export interface InstancePackage {
  name: string;
  gameVersion: string;
  loader: InstanceLoader;
  install(instanceDir: string, task: TaskHandle): Promise<void>;
}

export function packageName(name: string | null | undefined, fallback: string): string {
  const cleaned = (name ?? '').trim();
  return (cleaned || fallback).slice(0, MAX_NAME_LENGTH);
}
