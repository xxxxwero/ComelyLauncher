import fs from 'node:fs/promises';
import path from 'node:path';
import type { LanguageCode } from '../../../shared/types/settings';
import { writeFileAtomic } from '../../core/file-system';

const OPTIONS_FILE = 'options.txt';
const LOWERCASE_LANGUAGE_CODES_SINCE = Date.parse('2016-08-10T00:00:00Z');

const GAME_LANGUAGES: Record<LanguageCode, string | null> = {
  ru: 'ru_ru',
  en: null
};

function languageCode(language: string, releaseTime: string | null): string {
  const released = releaseTime ? Date.parse(releaseTime) : Number.NaN;
  if (Number.isNaN(released) || released >= LOWERCASE_LANGUAGE_CODES_SINCE) return language;
  const [locale, region] = language.split('_');
  return `${locale}_${region.toUpperCase()}`;
}

export async function ensureGameLanguage(instanceDir: string, launcherLanguage: LanguageCode, releaseTime: string | null): Promise<void> {
  const language = GAME_LANGUAGES[launcherLanguage];
  if (!language) return;
  const file = path.join(instanceDir, OPTIONS_FILE);
  const existing = await fs.readFile(file, 'utf8').catch(() => null);
  if (existing !== null && /^lang:/m.test(existing)) return;
  const separator = existing && !existing.endsWith('\n') ? '\n' : '';
  await writeFileAtomic(file, `${existing ?? ''}${separator}lang:${languageCode(language, releaseTime)}\n`);
}
