import type { SerializedLauncherError } from '../errors';

export interface LocalizedText {
  key: string;
  params?: Record<string, string | number>;
}

export type TaskState = 'running' | 'done' | 'failed' | 'cancelled';

export type StepState = 'pending' | 'active' | 'done';

export interface TaskStep {
  id: string;
  label: LocalizedText;
  state: StepState;
  progress: number;
}

export type TaskKind = 'game-install' | 'content-install' | 'content-update' | 'modpack-install' | 'instance-move' | 'instance-copy' | 'instance-export' | 'world-backup' | 'world-restore' | 'launcher-update';

export interface TaskSnapshot {
  id: string;
  kind: TaskKind;
  title: LocalizedText;
  instanceId: string | null;
  state: TaskState;
  steps: TaskStep[];
  progress: number;
  downloadedBytes: number;
  totalBytes: number;
  speedBytesPerSecond: number;
  currentFile: string | null;
  error: SerializedLauncherError | null;
  startedAt: number;
  finishedAt: number | null;
}
