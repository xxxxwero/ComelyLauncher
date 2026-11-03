export interface DownloadRequest {
  url: string;
  fallbackUrls?: string[];
  destination: string;
  sha1?: string;
  size?: number;
}

export interface DownloadProgress {
  downloadedBytes: number;
  totalBytes: number;
  completedFiles: number;
  totalFiles: number;
  speedBytesPerSecond: number;
  currentFile: string | null;
}

export type VerificationMode = 'sha1' | 'size';

export interface DownloadOptions {
  concurrency?: number;
  verification?: VerificationMode;
  signal?: AbortSignal;
  onProgress?: (progress: DownloadProgress) => void;
}
