import { app } from 'electron';
import os from 'node:os';
import type { LauncherSettings } from '../../shared/types/settings';
import { defaultGameDirectory } from '../core/app-paths';

export const DEFAULT_JVM_ARGUMENTS =
  '-XX:+UnlockExperimentalVMOptions -XX:+UseG1GC -XX:G1NewSizePercent=20 -XX:G1ReservePercent=20 -XX:MaxGCPauseMillis=50 -XX:G1HeapRegionSize=32M';

export const MIN_MEMORY_MB = 1024;

export function totalMemoryMb(): number {
  return Math.floor(os.totalmem() / 1024 / 1024);
}

export function maxMemoryMb(): number {
  return Math.max(MIN_MEMORY_MB, Math.floor((totalMemoryMb() - 1024) / 512) * 512);
}

export function recommendedMemoryMb(): number {
  const quarter = Math.floor(totalMemoryMb() / 4 / 1024) * 1024;
  return Math.min(8192, Math.max(2048, quarter));
}

export function createDefaultSettings(): LauncherSettings {
  return {
    game: {
      memoryMb: recommendedMemoryMb(),
      windowWidth: 1280,
      windowHeight: 720,
      fullscreen: false,
      autoConnectLastServer: false
    },
    java: {
      customPath: '',
      jvmArguments: DEFAULT_JVM_ARGUMENTS,
      autoDownload: true
    },
    appearance: {
      background: 'sakura',
      customBackgrounds: [],
      accentMode: 'background',
      accentColor: '#F25C05',
      effect: 'auto',
      dimPercent: 55,
      blurInnerScreens: true,
      parallax: false
    },
    launcher: {
      language: app.getLocale().toLowerCase().startsWith('ru') ? 'ru' : 'en',
      gameDirectory: defaultGameDirectory(),
      hideOnLaunch: false,
      minimizeToTray: true,
      showGameConsole: false
    },
    selectedInstanceId: null
  };
}
