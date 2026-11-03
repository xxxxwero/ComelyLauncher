import fs from 'node:fs/promises';
import path from 'node:path';
import type { CrashCause, CrashReport } from '../../../shared/types/game';
import { listDirectory } from '../../core/file-system';

const CAUSE_PATTERNS: Array<{ cause: CrashCause; pattern: RegExp }> = [
  { cause: 'out-of-memory', pattern: /OutOfMemoryError|Could not reserve enough space for object heap|Java heap space/i },
  { cause: 'wrong-java', pattern: /UnsupportedClassVersionError|compiled by a more recent version of the Java Runtime|Unsupported class file major version|requires Java \d+|java\.lang\.module\.FindException/i },
  { cause: 'missing-dependency', pattern: /Missing or unsupported mandatory dependencies|requires (any version|version) .* of|Mod resolution failed|missing mods|ModResolutionException.*(require|depend)/i },
  { cause: 'mod-conflict', pattern: /Mixin apply.*failed|MixinApplyError|Incompatible mods|DuplicateModsFoundException|found duplicate mods|ModResolutionException/i },
  { cause: 'graphics-driver', pattern: /Pixel format not accelerated|WGL: The driver does not appear to support OpenGL|GLFW error 65542|atio6axx|ig[0-9a-z]+icd|nvoglv|Couldn't set pixel format/i }
];

async function newestCrashReport(instanceDir: string, since: number): Promise<string | null> {
  const dir = path.join(instanceDir, 'crash-reports');
  let newest: { file: string; time: number } | null = null;
  for (const name of await listDirectory(dir)) {
    if (!name.endsWith('.txt')) continue;
    const file = path.join(dir, name);
    const stat = await fs.stat(file).catch(() => null);
    if (stat && stat.mtimeMs >= since - 1000 && (!newest || stat.mtimeMs > newest.time)) newest = { file, time: stat.mtimeMs };
  }
  return newest?.file ?? null;
}

function excerptFromText(text: string): string {
  const lines = text.split(/\r?\n/);
  const description = lines.findIndex((line) => line.startsWith('Description:'));
  if (description >= 0) return lines.slice(description, description + 10).join('\n').trim();
  const exception = lines.findIndex((line) => /(Exception|Error)(:|$)/.test(line) && !line.includes('INFO'));
  const start = exception >= 0 ? exception : Math.max(0, lines.length - 10);
  return lines.slice(start, start + 8).join('\n').trim();
}

export async function analyzeCrash(instanceDir: string, logTail: string[], exitCode: number | null, startedAt: number): Promise<CrashReport> {
  const crashReportPath = await newestCrashReport(instanceDir, startedAt);
  const crashText = crashReportPath ? await fs.readFile(crashReportPath, 'utf8').catch(() => '') : '';
  const logText = logTail.slice(-300).join('\n');
  const combined = `${crashText}\n${logText}`;
  const cause = CAUSE_PATTERNS.find((entry) => entry.pattern.test(combined))?.cause ?? 'unknown';
  const excerpt = excerptFromText(crashText || logText).slice(0, 1400);
  return { exitCode, cause, excerpt, crashReportPath };
}
