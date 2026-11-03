import type { InstanceLoader } from './instances';

export interface ExternalProfile {
  id: string;
  name: string;
  folder: string;
  gameVersion: string;
  loader: InstanceLoader;
  modCount: number;
  worldCount: number;
}
