import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { JavaInstallation } from '../../shared/types/system';
import { listDirectory, pathExists } from '../core/file-system';
import type { GamePaths } from '../core/game-paths';

interface JavaInfo {
  version: string;
  majorVersion: number;
  vendor: string | null;
}

const VENDOR_FOLDERS = [
  'Java',
  'Eclipse Adoptium',
  'Eclipse Foundation',
  'AdoptOpenJDK',
  'Microsoft',
  'Zulu',
  'BellSoft',
  'Amazon Corretto',
  'Semeru',
  'ojdkbuild',
  'Liberica'
];

export function parseMajorVersion(version: string): number {
  const parts = version.split(/[._+-]/).map((part) => Number.parseInt(part, 10));
  if (parts[0] === 1 && Number.isFinite(parts[1])) return parts[1];
  return Number.isFinite(parts[0]) ? parts[0] : 0;
}

function javaHomeOf(executable: string): string {
  return path.dirname(path.dirname(executable));
}

async function readReleaseFile(home: string): Promise<JavaInfo | null> {
  try {
    const content = await fs.readFile(path.join(home, 'release'), 'utf8');
    const version = /^JAVA_VERSION="([^"]+)"/m.exec(content)?.[1];
    if (!version) return null;
    const vendor = /^IMPLEMENTOR="([^"]+)"/m.exec(content)?.[1] ?? null;
    return { version, majorVersion: parseMajorVersion(version), vendor };
  } catch {
    return null;
  }
}

function queryVersion(executable: string): Promise<JavaInfo | null> {
  return new Promise((resolve) => {
    execFile(executable, ['-version'], { timeout: 8000, windowsHide: true }, (_error, stdout, stderr) => {
      const output = `${stderr}\n${stdout}`;
      const version = /version "([^"]+)"/.exec(output)?.[1];
      resolve(version ? { version, majorVersion: parseMajorVersion(version), vendor: null } : null);
    });
  });
}

export async function inspectJava(executable: string): Promise<JavaInfo | null> {
  if (!(await pathExists(executable))) return null;
  const javaExe = path.join(path.dirname(executable), 'java.exe');
  return (await readReleaseFile(javaHomeOf(executable))) ?? queryVersion((await pathExists(javaExe)) ? javaExe : executable);
}

async function candidateHomes(paths: GamePaths): Promise<Array<{ home: string; managed: boolean }>> {
  const homes: Array<{ home: string; managed: boolean }> = [];
  for (const component of await listDirectory(paths.runtimes)) {
    homes.push({ home: paths.runtime(component), managed: true });
  }
  if (process.env.JAVA_HOME) homes.push({ home: process.env.JAVA_HOME, managed: false });
  for (const entry of (process.env.PATH ?? '').split(path.delimiter)) {
    if (entry && (await pathExists(path.join(entry, 'java.exe')))) homes.push({ home: path.dirname(entry), managed: false });
  }
  const programRoots = [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.ProgramW6432].filter((root): root is string => Boolean(root));
  for (const root of new Set(programRoots)) {
    for (const vendor of VENDOR_FOLDERS) {
      const vendorDir = path.join(root, vendor);
      for (const child of await listDirectory(vendorDir)) homes.push({ home: path.join(vendorDir, child), managed: false });
    }
  }
  return homes;
}

export async function detectJavaInstallations(paths: GamePaths): Promise<JavaInstallation[]> {
  const result = new Map<string, JavaInstallation>();
  for (const candidate of await candidateHomes(paths)) {
    const executable = path.join(candidate.home, 'bin', 'javaw.exe');
    const key = path.resolve(executable).toLowerCase();
    if (result.has(key)) continue;
    const info = await inspectJava(executable);
    if (!info) continue;
    result.set(key, { path: executable, version: info.version, majorVersion: info.majorVersion, vendor: info.vendor, managed: candidate.managed });
  }
  return [...result.values()].sort((a, b) => b.majorVersion - a.majorVersion);
}
