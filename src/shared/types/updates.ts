export type UpdateStatus = 'disabled' | 'idle' | 'checking' | 'up-to-date' | 'available' | 'downloading' | 'ready' | 'failed';

export interface UpdateInfo {
  version: string;
  notes: string;
  publishedAt: string | null;
  sizeBytes: number;
}

export interface UpdateState {
  status: UpdateStatus;
  currentVersion: string;
  available: UpdateInfo | null;
  sourceUrl: string | null;
}
