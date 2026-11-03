import AdmZip from 'adm-zip';

export interface ModMetadata {
  ids: string[];
  required: string[];
}

const MAX_NESTING = 3;

const PLATFORM_IDS = new Set([
  'minecraft',
  'java',
  'fabricloader',
  'fabric-loader',
  'quilt_loader',
  'quilt_base',
  'forge',
  'neoforge',
  'mcp',
  'javafml',
  'lowcodefml',
  'fml'
]);

interface FabricModJson {
  id?: string;
  provides?: string[];
  depends?: Record<string, unknown>;
  jars?: Array<{ file?: string }>;
}

type QuiltReference = string | { id?: string; optional?: boolean };

interface QuiltModJson {
  quilt_loader?: {
    id?: string;
    provides?: QuiltReference[];
    depends?: QuiltReference[];
    jars?: string[];
  };
}

interface JarJarMetadata {
  jars?: Array<{ path?: string; identifier?: { artifact?: string } }>;
}

function readJson<T>(zip: AdmZip, entryName: string): T | null {
  if (!zip.getEntry(entryName)) return null;
  try {
    return JSON.parse(zip.readAsText(entryName)) as T;
  } catch {
    return null;
  }
}

function referenceId(reference: QuiltReference): string | null {
  return typeof reference === 'string' ? reference : reference.id ?? null;
}

function tomlValue(block: string, key: string): string | null {
  return new RegExp(`^\\s*${key}\\s*=\\s*["']([^"']+)["']`, 'mi').exec(block)?.[1] ?? null;
}

function isRequiredTomlDependency(block: string): boolean {
  const side = tomlValue(block, 'side');
  if (side?.toUpperCase() === 'SERVER') return false;
  const type = tomlValue(block, 'type');
  if (type) return type.toLowerCase() === 'required';
  return /^\s*mandatory\s*=\s*true/im.test(block);
}

function readToml(text: string): ModMetadata {
  const metadata: ModMetadata = { ids: [], required: [] };
  for (const block of text.split(/^\s*\[\[/m).slice(1)) {
    const header = block.slice(0, block.indexOf(']]')).trim();
    const modId = tomlValue(block, 'modId');
    if (!modId) continue;
    if (header === 'mods') metadata.ids.push(modId);
    else if (header.startsWith('dependencies') && isRequiredTomlDependency(block)) metadata.required.push(modId);
  }
  return metadata;
}

function nestedJarPaths(zip: AdmZip, metadata: ModMetadata): string[] {
  const fabric = readJson<FabricModJson>(zip, 'fabric.mod.json');
  const quilt = readJson<QuiltModJson>(zip, 'quilt.mod.json');
  const jarJar = readJson<JarJarMetadata>(zip, 'META-INF/jarjar/metadata.json');
  for (const entry of jarJar?.jars ?? []) {
    if (entry.identifier?.artifact) metadata.ids.push(entry.identifier.artifact);
  }
  return [
    ...(fabric?.jars ?? []).map((entry) => entry.file),
    ...(quilt?.quilt_loader?.jars ?? []),
    ...(jarJar?.jars ?? []).map((entry) => entry.path)
  ].filter((value): value is string => Boolean(value));
}

function readDeclarations(zip: AdmZip): ModMetadata {
  const metadata: ModMetadata = { ids: [], required: [] };
  const fabric = readJson<FabricModJson>(zip, 'fabric.mod.json');
  if (fabric) {
    if (fabric.id) metadata.ids.push(fabric.id);
    metadata.ids.push(...(fabric.provides ?? []));
    metadata.required.push(...Object.keys(fabric.depends ?? {}));
  }
  const quilt = readJson<QuiltModJson>(zip, 'quilt.mod.json')?.quilt_loader;
  if (quilt) {
    if (quilt.id) metadata.ids.push(quilt.id);
    metadata.ids.push(...(quilt.provides ?? []).map(referenceId).filter((id): id is string => Boolean(id)));
    for (const dependency of quilt.depends ?? []) {
      const id = referenceId(dependency);
      if (id && !(typeof dependency === 'object' && dependency.optional)) metadata.required.push(id);
    }
  }
  for (const tomlFile of ['META-INF/neoforge.mods.toml', 'META-INF/mods.toml']) {
    if (!zip.getEntry(tomlFile)) continue;
    const toml = readToml(zip.readAsText(tomlFile));
    metadata.ids.push(...toml.ids);
    metadata.required.push(...toml.required);
  }
  return metadata;
}

function collect(zip: AdmZip, depth: number): ModMetadata {
  const metadata = readDeclarations(zip);
  if (depth >= MAX_NESTING) return metadata;
  for (const jarPath of nestedJarPaths(zip, metadata)) {
    const entry = zip.getEntry(jarPath);
    if (!entry) continue;
    try {
      metadata.ids.push(...collect(new AdmZip(entry.getData()), depth + 1).ids);
    } catch {
      continue;
    }
  }
  return metadata;
}

export function readModMetadata(file: string): ModMetadata {
  try {
    const metadata = collect(new AdmZip(file), 0);
    return {
      ids: [...new Set(metadata.ids)],
      required: [...new Set(metadata.required)].filter((id) => !PLATFORM_IDS.has(id))
    };
  } catch {
    return { ids: [], required: [] };
  }
}
