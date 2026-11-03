export interface Screenshot {
  path: string;
  url: string;
  thumbUrl: string;
  fileName: string;
  instanceId: string;
  instanceName: string;
  createdAt: number;
  sizeBytes: number;
}

export interface MotdSegment {
  text: string;
  color: string | null;
  bold: boolean;
  italic: boolean;
}

export interface ServerEntry {
  index: number;
  name: string;
  address: string;
  iconDataUrl: string | null;
}

export interface ServerStatus {
  address: string;
  online: boolean;
  motd: MotdSegment[][];
  playersOnline: number;
  playersMax: number;
  versionName: string | null;
  latencyMs: number | null;
  iconDataUrl: string | null;
}

export interface ServerDraft {
  name: string;
  address: string;
}
