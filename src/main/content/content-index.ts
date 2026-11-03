import path from 'node:path';
import type { ContentKind } from '../../shared/types/instances';
import { readJsonFile, writeJsonFile } from '../core/file-system';
import { INSTANCE_META_DIR } from '../instances/instance-store';

export interface ContentRecord {
  projectId: string;
  versionId: string;
  versionNumber: string;
  title: string;
  author: string | null;
  slug: string | null;
  projectType: string;
  iconUrl: string | null;
}

export type ContentIndex = Record<string, ContentRecord>;

export function contentKey(kind: ContentKind, fileName: string): string {
  return `${kind}/${fileName}`;
}

function indexFile(instanceDir: string): string {
  return path.join(instanceDir, INSTANCE_META_DIR, 'content.json');
}

export function readContentIndex(instanceDir: string): Promise<ContentIndex> {
  return readJsonFile<ContentIndex>(indexFile(instanceDir), {});
}

export function writeContentIndex(instanceDir: string, index: ContentIndex): Promise<void> {
  return writeJsonFile(indexFile(instanceDir), index);
}
