import fs from 'node:fs/promises';
import path from 'node:path';
import { LauncherError } from '../../../shared/errors';
import type { InstanceLoader, LoaderType } from '../../../shared/types/instances';
import { copyTree, listDirectory, moveDirectory, pathExists, readJsonFile } from '../../core/file-system';
import { packageName, TRANSIENT_FOLDERS, type InstancePackage, type PackageSource } from './instance-package';

const COMPONENTS_FILE = 'mmc-pack.json';
const CONFIG_FILE = 'instance.cfg';
const MINECRAFT_COMPONENT = 'net.minecraft';

const LOADER_COMPONENTS: Record<string, Exclude<LoaderType, 'vanilla'>> = {
  'net.fabricmc.fabric-loader': 'fabric',
  'org.quiltmc.quilt-loader': 'quilt',
  'net.minecraftforge': 'forge',
  'net.neoforged': 'neoforge'
};

interface PrismComponent {
  uid?: string;
  version?: string;
  cachedVersion?: string;
}

function componentVersion(component: PrismComponent): string | null {
  return component.version ?? component.cachedVersion ?? null;
}

function loaderFromComponents(components: PrismComponent[], gameVersion: string): InstanceLoader {
  for (const component of components) {
    const type = component.uid ? LOADER_COMPONENTS[component.uid] : undefined;
    if (!type) continue;
    const version = componentVersion(component);
    return { type, version: type === 'forge' && version ? `${gameVersion}-${version}` : version };
  }
  return { type: 'vanilla', version: null };
}

async function readInstanceName(root: string): Promise<string | null> {
  const config = await fs.readFile(path.join(root, CONFIG_FILE), 'utf8').catch(() => '');
  const raw = /^name=(.*)$/m.exec(config)?.[1]?.trim();
  if (!raw) return null;
  return raw.replace(/^"(.*)"$/, '$1').replace(/\\(["\\])/g, '$1');
}

async function findGameFolder(root: string): Promise<string | null> {
  for (const name of ['.minecraft', 'minecraft']) {
    const candidate = path.join(root, name);
    if (await pathExists(candidate)) return candidate;
  }
  return null;
}

export async function findPrismRoot(root: string): Promise<string | null> {
  if (await pathExists(path.join(root, COMPONENTS_FILE))) return root;
  for (const child of await listDirectory(root)) {
    const candidate = path.join(root, child);
    if (await pathExists(path.join(candidate, COMPONENTS_FILE))) return candidate;
  }
  return null;
}

export async function defaultPrismInstancesDirectory(): Promise<string | undefined> {
  const directory = path.join(process.env.APPDATA ?? '', 'PrismLauncher', 'instances');
  return (await pathExists(directory)) ? directory : undefined;
}

export async function readPrismPackage(root: string, fallbackName: string, source: PackageSource): Promise<InstancePackage> {
  const pack = await readJsonFile<{ components?: PrismComponent[] } | null>(path.join(root, COMPONENTS_FILE), null);
  const components = pack?.components ?? [];
  const minecraft = components.find((component) => component.uid === MINECRAFT_COMPONENT);
  const gameVersion = minecraft ? componentVersion(minecraft) : null;
  if (!gameVersion) throw new LauncherError('modpack-invalid', `${COMPONENTS_FILE} has no Minecraft version`);
  return {
    name: packageName(await readInstanceName(root), fallbackName),
    gameVersion,
    loader: loaderFromComponents(components, gameVersion),
    async install(instanceDir, task) {
      task.startStep('files');
      const gameFolder = await findGameFolder(root);
      if (!gameFolder) return;
      if (source === 'extracted-archive') {
        await moveDirectory(gameFolder, instanceDir);
        await Promise.all(TRANSIENT_FOLDERS.map((folder) => fs.rm(path.join(instanceDir, folder), { recursive: true, force: true })));
        return;
      }
      await copyTree(gameFolder, instanceDir, {
        exclude: new Set(TRANSIENT_FOLDERS),
        signal: task.signal,
        onProgress: (fraction) => task.setStepProgress('files', fraction)
      });
    }
  };
}
