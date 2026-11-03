import type { LanguageCode } from '../../shared/types/settings';

export interface TrayLabels {
  open: string;
  quit: string;
  tooltip: string;
}

const LABELS: Record<LanguageCode, TrayLabels> = {
  ru: { open: 'Открыть ComelyLauncher', quit: 'Выйти', tooltip: 'ComelyLauncher' },
  en: { open: 'Open ComelyLauncher', quit: 'Quit', tooltip: 'ComelyLauncher' }
};

export function trayLabels(language: LanguageCode): TrayLabels {
  return LABELS[language];
}
