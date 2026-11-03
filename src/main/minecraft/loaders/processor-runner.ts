import AdmZip from 'adm-zip';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { LauncherError } from '../../../shared/errors';

export function readMainClass(jarPath: string): string {
  const manifest = new AdmZip(jarPath).readAsText('META-INF/MANIFEST.MF');
  const mainClass = /^Main-Class:\s*(.+)$/m.exec(manifest)?.[1]?.trim();
  if (!mainClass) throw new LauncherError('install-failed', `No Main-Class in ${path.basename(jarPath)}`);
  return mainClass;
}

export function runJavaProcess(java: string, args: string[], cwd: string, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(java, args, { cwd, windowsHide: true, signal });
    const tail: string[] = [];
    const collect = (chunk: Buffer): void => {
      tail.push(...chunk.toString('utf8').split(/\r?\n/).filter(Boolean));
      if (tail.length > 40) tail.splice(0, tail.length - 40);
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    child.on('error', (error) => reject(signal?.aborted ? new LauncherError('cancelled') : new LauncherError('install-failed', error.message)));
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new LauncherError('install-failed', `Processor exited with code ${code}: ${tail.slice(-6).join(' | ')}`));
    });
  });
}
