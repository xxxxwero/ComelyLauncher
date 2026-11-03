import { LauncherError } from '../../shared/errors';
import type { LanguageCode } from '../../shared/types/settings';
import { useStore } from '../state/create-store';
import { settingsStore } from '../state/settings-store';
import { en } from './en';
import { ru, type Dictionary } from './ru';

type Leaves<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : Leaves<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type TranslationKey = Leaves<Dictionary>;
export type PluralKey = keyof Dictionary['plural'];
export type TranslationParams = Record<string, string | number>;
export type Translate = (key: TranslationKey, params?: TranslationParams) => string;

const DICTIONARIES: Record<LanguageCode, Dictionary> = { ru, en };

function currentLanguage(): LanguageCode {
  return settingsStore.get()?.launcher.language ?? 'ru';
}

function lookup(dictionary: Dictionary, key: string): string | null {
  let node: unknown = dictionary;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return null;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : null;
}

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (params[name] !== undefined ? String(params[name]) : match));
}

export function translateIn(language: LanguageCode, key: string, params?: TranslationParams): string {
  const template = lookup(DICTIONARIES[language], key) ?? lookup(ru, key) ?? key;
  return interpolate(template, params);
}

export function translate(key: TranslationKey, params?: TranslationParams): string {
  return translateIn(currentLanguage(), key, params);
}

export function pluralIn(language: LanguageCode, key: PluralKey, count: number): string {
  const forms = DICTIONARIES[language].plural[key].split('|');
  if (language === 'ru') {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return forms[0];
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
    return forms[2];
  }
  return count === 1 ? forms[0] : forms[1];
}

export function errorMessage(error: unknown): string {
  const launcherError = LauncherError.from(error);
  const key = `errors.${launcherError.code}`;
  const text = translateIn(currentLanguage(), key, launcherError.params);
  return text === key ? launcherError.message : text;
}

export interface I18n {
  language: LanguageCode;
  t: Translate;
  plural: (key: PluralKey, count: number) => string;
  count: (key: PluralKey, count: number) => string;
}

export function useI18n(): I18n {
  const settings = useStore(settingsStore);
  const language = settings?.launcher.language ?? 'ru';
  return {
    language,
    t: (key, params) => translateIn(language, key, params),
    plural: (key, count) => pluralIn(language, key, count),
    count: (key, count) => `${count} ${pluralIn(language, key, count)}`
  };
}
