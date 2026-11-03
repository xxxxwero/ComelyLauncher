export interface JavaInstallation {
  path: string;
  version: string;
  majorVersion: number;
  vendor: string | null;
  managed: boolean;
}

export interface SystemInfo {
  totalMemoryMb: number;
  launcherVersion: string;
  defaultGameDirectory: string;
}

export interface DriveInfo {
  root: string;
  gameDirectory: string;
  freeBytes: number;
  totalBytes: number;
}

export interface GameDirectoryEstimate {
  fileCount: number;
  totalBytes: number;
  freeBytes: number | null;
  sameDrive: boolean;
}

export interface WindowState {
  maximized: boolean;
}
