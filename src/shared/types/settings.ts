export type LanguageCode = 'ru' | 'en';

export type BackgroundPresetId = 'sakura' | 'autumn' | 'snow';

export type AccentMode = 'background' | 'custom';

export type ParticleEffect = 'petals' | 'leaves' | 'snow';

export type ParticleEffectChoice = ParticleEffect | 'auto' | 'none';

export interface CustomBackground {
  id: string;
  name: string;
  path: string;
  thumbPath: string;
  accent?: string | null;
}

export interface GameSettings {
  memoryMb: number;
  windowWidth: number;
  windowHeight: number;
  fullscreen: boolean;
  autoConnectLastServer: boolean;
}

export interface JavaSettings {
  customPath: string;
  jvmArguments: string;
  autoDownload: boolean;
}

export interface AppearanceSettings {
  background: string;
  customBackgrounds: CustomBackground[];
  accentMode: AccentMode;
  accentColor: string;
  effect: ParticleEffectChoice;
  dimPercent: number;
  blurInnerScreens: boolean;
  parallax: boolean;
}

export interface LauncherBehaviorSettings {
  language: LanguageCode;
  gameDirectory: string;
  hideOnLaunch: boolean;
  minimizeToTray: boolean;
  showGameConsole: boolean;
}

export interface LauncherSettings {
  game: GameSettings;
  java: JavaSettings;
  appearance: AppearanceSettings;
  launcher: LauncherBehaviorSettings;
  selectedInstanceId: string | null;
}

export interface SettingsPatch {
  game?: Partial<GameSettings>;
  java?: Partial<JavaSettings>;
  appearance?: Partial<AppearanceSettings>;
  launcher?: Partial<LauncherBehaviorSettings>;
  selectedInstanceId?: string | null;
}
