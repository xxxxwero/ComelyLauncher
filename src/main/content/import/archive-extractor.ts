import { spawn } from 'node:child_process';
import { LauncherError } from '../../../shared/errors';
import { ensureDir } from '../../core/file-system';
import { powershellPath } from '../../core/powershell';

export interface ExtractOptions {
  signal?: AbortSignal;
  onProgress?: (fraction: number) => void;
}

const PROGRESS_LINE = /^(\d+)\/(\d+)$/;

const EXTRACT_SCRIPT = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::OpenRead($env:COMELY_ARCHIVE)
try {
  $root = [IO.Path]::GetFullPath($env:COMELY_TARGET).TrimEnd('\\') + '\\'
  $total = $archive.Entries.Count
  $done = 0
  foreach ($entry in $archive.Entries) {
    $target = [IO.Path]::GetFullPath([IO.Path]::Combine($root, $entry.FullName))
    if ($target.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) {
      if ($entry.Name -eq '') {
        [void][IO.Directory]::CreateDirectory($target)
      } else {
        [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($target))
        [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $target, $true)
      }
    }
    $done++
    if ($done % 20 -eq 0) { [Console]::Out.WriteLine("$done/$total") }
  }
} finally {
  $archive.Dispose()
}
`;

export async function extractArchive(file: string, target: string, options: ExtractOptions = {}): Promise<void> {
  await ensureDir(target);
  await new Promise<void>((resolve, reject) => {
    const child = spawn(powershellPath(), ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', EXTRACT_SCRIPT], {
      env: { ...process.env, COMELY_ARCHIVE: file, COMELY_TARGET: target },
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
    child.on('error', (error) => reject(options.signal?.aborted ? new LauncherError('cancelled') : new LauncherError('modpack-invalid', error.message)));
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(options.signal?.aborted ? new LauncherError('cancelled') : new LauncherError('modpack-invalid', failure.trim() || `Archive extraction failed (${code})`));
    });
  });
}
