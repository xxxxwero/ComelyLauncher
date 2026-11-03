import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { LauncherError } from '../../shared/errors';
import { ensureDir } from './file-system';
import { powershellPath } from './powershell';

export interface ArchiveEntry {
  name: string;
  source: string;
}

export interface ArchiveOptions {
  signal?: AbortSignal;
  onProgress?: (fraction: number) => void;
}

const PROGRESS_LINE = /^(\d+)\/(\d+)$/;

const ARCHIVE_SCRIPT = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$lines = [IO.File]::ReadAllLines($env:COMELY_ENTRIES, [Text.Encoding]::UTF8)
$archive = [IO.Compression.ZipFile]::Open($env:COMELY_ARCHIVE, [IO.Compression.ZipArchiveMode]::Create)
try {
  $done = 0
  foreach ($line in $lines) {
    $parts = $line.Split([char]9)
    [void][IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $parts[1], $parts[0], [IO.Compression.CompressionLevel]::Optimal)
    $done++
    if ($done % 10 -eq 0) { [Console]::Out.WriteLine("$done/$($lines.Count)") }
  }
} finally {
  $archive.Dispose()
}
`;

function runArchiver(entriesFile: string, archive: string, options: ArchiveOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(powershellPath(), ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', ARCHIVE_SCRIPT], {
      env: { ...process.env, COMELY_ENTRIES: entriesFile, COMELY_ARCHIVE: archive },
      windowsHide: true,
      signal: options.signal
    });
    let failure = '';
    child.stdout.on('data', (chunk: Buffer) => {
      for (const line of chunk.toString('utf8').split(/\r?\n/)) {
        const match = PROGRESS_LINE.exec(line);
        if (match) options.onProgress?.(Number(match[1]) / Number(match[2]));
      }
    });
    child.stderr.on('data', (chunk: Buffer) => {
      failure = `${failure}${chunk.toString('utf8')}`.slice(-600);
    });
    child.on('error', (error) => reject(options.signal?.aborted ? new LauncherError('cancelled') : new LauncherError('unknown', error.message)));
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(options.signal?.aborted ? new LauncherError('cancelled') : new LauncherError('unknown', failure.trim() || `Archive creation failed (${code})`));
    });
  });
}

export async function writeArchive(entries: ArchiveEntry[], target: string, options: ArchiveOptions = {}): Promise<void> {
  await ensureDir(path.dirname(target));
  const temp = `${target}.${process.pid}.tmp`;
  const entriesFile = `${temp}.entries`;
  await fs.writeFile(entriesFile, entries.map((entry) => `${entry.name}\t${entry.source}`).join('\n'), 'utf8');
  try {
    await runArchiver(entriesFile, temp, options);
    await fs.rename(temp, target);
  } catch (error) {
    await fs.rm(temp, { force: true });
    throw error;
  } finally {
    await fs.rm(entriesFile, { force: true });
  }
}
