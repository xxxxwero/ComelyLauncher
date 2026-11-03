import type { LanguageCode } from '../../shared/types/settings';
import { pluralIn, translateIn } from './i18n';

const DAY_MS = 24 * 60 * 60 * 1000;

export function formatMegabytes(bytes: number, language: LanguageCode): string {
  const value = bytes / 1024 / 1024;
  return translateIn(language, 'common.mb', { value: value >= 100 ? Math.round(value) : value.toFixed(1) });
}

export function formatBytes(bytes: number, language: LanguageCode): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} ${language === 'ru' ? 'КБ' : 'KB'}`;
  if (bytes < 1024 * 1024 * 1024) return formatMegabytes(bytes, language);
  return translateIn(language, 'common.gb', { value: (bytes / 1024 / 1024 / 1024).toFixed(2) });
}

export function formatSpeed(bytesPerSecond: number, language: LanguageCode): string {
  return translateIn(language, 'common.speed', { value: (bytesPerSecond / 1024 / 1024).toFixed(1) });
}

export function formatGigabytes(megabytes: number): string {
  const value = megabytes / 1024;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function formatEta(seconds: number, language: LanguageCode): string {
  const total = Math.max(0, Math.round(seconds));
  if (total >= 60) return translateIn(language, 'time.etaMinutes', { minutes: Math.floor(total / 60), seconds: total % 60 });
  return translateIn(language, 'time.etaSeconds', { seconds: total });
}

export function formatClock(milliseconds: number): string {
  const total = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const seconds = String(total % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`;
}

export function formatPlayTime(milliseconds: number, language: LanguageCode): string {
  const minutes = Math.floor(milliseconds / 60000);
  if (minutes >= 60) return translateIn(language, 'time.durationHours', { hours: Math.floor(minutes / 60), minutes: minutes % 60 });
  return translateIn(language, 'time.durationMinutes', { minutes });
}

export function formatRelative(timestamp: number | null, language: LanguageCode): string {
  if (!timestamp) return translateIn(language, 'time.never');
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (timestamp >= startOfToday) return translateIn(language, 'time.today');
  if (timestamp >= startOfToday - DAY_MS) return translateIn(language, 'time.yesterday');
  const days = Math.floor((startOfToday - timestamp) / DAY_MS) + 1;
  if (days < 7) return translateIn(language, 'time.daysAgo', { count: days, unit: pluralIn(language, 'days', days) });
  if (days < 14) return translateIn(language, 'time.weekAgo');
  if (days < 31) return translateIn(language, 'time.weeksAgo', { count: Math.floor(days / 7) });
  return translateIn(language, 'time.monthAgo');
}

export function formatDate(timestamp: number | string, language: LanguageCode): string {
  return new Date(timestamp).toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatDateTime(timestamp: number, language: LanguageCode): string {
  return new Date(timestamp).toLocaleString(language === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function formatCompactNumber(value: number, language: LanguageCode): string {
  return new Intl.NumberFormat(language === 'ru' ? 'ru-RU' : 'en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}
