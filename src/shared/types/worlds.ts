export type WorldGameMode = 'survival' | 'creative' | 'adventure' | 'spectator' | 'hardcore';

export interface WorldInfo {
  folder: string;
  name: string;
  gameMode: WorldGameMode | null;
  gameVersion: string | null;
  lastPlayedAt: number | null;
  sizeBytes: number;
  iconUrl: string | null;
  backupCount: number;
}

export interface WorldBackup {
  fileName: string;
  worldFolder: string;
  createdAt: number;
  sizeBytes: number;
}
