export interface OsRule {
  name?: string;
  arch?: string;
  version?: string;
}

export interface Rule {
  action: 'allow' | 'disallow';
  os?: OsRule;
  features?: Record<string, boolean>;
}

export type ArgumentValue = string | { rules?: Rule[]; value: string | string[] };

export interface DownloadArtifact {
  path?: string;
  url: string;
  sha1?: string;
  size?: number;
}

export interface LibraryEntry {
  name: string;
  url?: string;
  sha1?: string;
  size?: number;
  downloads?: {
    artifact?: DownloadArtifact;
    classifiers?: Record<string, DownloadArtifact>;
  };
  natives?: Record<string, string>;
  extract?: { exclude?: string[] };
  rules?: Rule[];
}

export interface AssetIndexReference {
  id: string;
  sha1: string;
  size: number;
  totalSize?: number;
  url: string;
}

export interface VersionJson {
  id: string;
  inheritsFrom?: string;
  type?: string;
  mainClass?: string;
  minecraftArguments?: string;
  arguments?: { game?: ArgumentValue[]; jvm?: ArgumentValue[] };
  libraries?: LibraryEntry[];
  assetIndex?: AssetIndexReference;
  assets?: string;
  downloads?: { client?: DownloadArtifact };
  javaVersion?: { component: string; majorVersion: number };
  logging?: { client?: { argument: string; file: { id: string; sha1: string; size: number; url: string }; type: string } };
  jar?: string;
  releaseTime?: string;
}

export interface ResolvedVersion {
  id: string;
  chain: string[];
  jarVersionId: string;
  jarSourceId: string;
  releaseTime: string | null;
  type: string;
  mainClass: string;
  minecraftArguments: string | null;
  gameArguments: ArgumentValue[];
  jvmArguments: ArgumentValue[];
  libraries: LibraryEntry[];
  assetIndex: AssetIndexReference | null;
  assets: string | null;
  clientDownload: DownloadArtifact | null;
  javaVersion: { component: string; majorVersion: number } | null;
  logging: VersionJson['logging'] | null;
}
