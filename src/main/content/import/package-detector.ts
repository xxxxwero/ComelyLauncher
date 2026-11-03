import path from 'node:path';
import { LauncherError } from '../../../shared/errors';
import { pathExists, readJsonFile } from '../../core/file-system';
import type { InstancePackage, PackageSource } from './instance-package';
import { MRPACK_INDEX_FILE, readMrpackPackage } from './mrpack-package';
import { findPrismRoot, readPrismPackage } from './prism-package';

const CURSEFORGE_MANIFEST = 'manifest.json';

export async function detectPackage(root: string, fallbackName: string, source: PackageSource): Promise<InstancePackage> {
  if (await pathExists(path.join(root, MRPACK_INDEX_FILE))) return readMrpackPackage(root, fallbackName);
  const prismRoot = await findPrismRoot(root);
  if (prismRoot) return readPrismPackage(prismRoot, fallbackName, source);
  const manifest = await readJsonFile<{ manifestType?: string } | null>(path.join(root, CURSEFORGE_MANIFEST), null);
  if (manifest?.manifestType) throw new LauncherError('modpack-curseforge', 'CurseForge packs need a CurseForge API key');
  throw new LauncherError('modpack-invalid', 'Unknown instance format');
}
