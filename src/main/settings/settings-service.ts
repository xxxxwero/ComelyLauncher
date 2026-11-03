import path from 'node:path';
import type { LauncherSettings, SettingsPatch } from '../../shared/types/settings';
import { userDataPath } from '../core/app-paths';
import { readJsonFile, writeJsonFile } from '../core/file-system';
import { GamePaths } from '../core/game-paths';
import type { RendererEvents } from '../core/renderer-events';
import { createDefaultSettings, maxMemoryMb, MIN_MEMORY_MB } from './default-settings';
import { normalizeGameDirectory } from './game-directory';

type SettingsListener = (settings: LauncherSettings, previous: LauncherSettings) => void;

const PRESET_BACKGROUNDS = new Set(['sakura', 'autumn', 'snow']);
const LEGACY_BACKGROUND_ID = 'custom';
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const EFFECTS = new Set(['auto', 'petals', 'leaves', 'snow', 'none']);

interface LegacyAppearance {
  background?: string;
  customBackgroundPath?: string | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function sanitize(settings: LauncherSettings): LauncherSettings {
  const defaults = createDefaultSettings();
  settings.game.memoryMb = clamp(Number(settings.game.memoryMb) || defaults.game.memoryMb, MIN_MEMORY_MB, maxMemoryMb());
  settings.game.windowWidth = clamp(Number(settings.game.windowWidth) || 1280, 320, 7680);
  settings.game.windowHeight = clamp(Number(settings.game.windowHeight) || 720, 240, 4320);
  settings.appearance.dimPercent = clamp(Number(settings.appearance.dimPercent), 0, 80);
  if (!settings.launcher.gameDirectory.trim()) settings.launcher.gameDirectory = defaults.launcher.gameDirectory;
  if (settings.launcher.language !== 'ru' && settings.launcher.language !== 'en') settings.launcher.language = defaults.launcher.language;
  const { background, customBackgrounds } = settings.appearance;
  if (settings.appearance.accentMode !== 'custom') settings.appearance.accentMode = 'background';
  if (!HEX_COLOR.test(settings.appearance.accentColor)) settings.appearance.accentColor = defaults.appearance.accentColor;
  if (!EFFECTS.has(settings.appearance.effect)) settings.appearance.effect = defaults.appearance.effect;
  if (!PRESET_BACKGROUNDS.has(background) && !customBackgrounds.some((entry) => entry.id === background)) settings.appearance.background = defaults.appearance.background;
  return settings;
}

function migrateLegacyBackground(stored: SettingsPatch): SettingsPatch {
  const legacy = stored.appearance as LegacyAppearance | undefined;
  if (!legacy || legacy.customBackgroundPath === undefined) return stored;
  const { customBackgroundPath, ...appearance } = stored.appearance as NonNullable<SettingsPatch['appearance']> & LegacyAppearance;
  if (!customBackgroundPath) return { ...stored, appearance };
  const entry = { id: LEGACY_BACKGROUND_ID, name: '', path: customBackgroundPath, thumbPath: customBackgroundPath };
  return { ...stored, appearance: { ...appearance, customBackgrounds: [entry] } };
}

function merge(base: LauncherSettings, patch: SettingsPatch): LauncherSettings {
  return sanitize({
    game: { ...base.game, ...patch.game },
    java: { ...base.java, ...patch.java },
    appearance: { ...base.appearance, ...patch.appearance },
    launcher: { ...base.launcher, ...patch.launcher },
    selectedInstanceId: patch.selectedInstanceId !== undefined ? patch.selectedInstanceId : base.selectedInstanceId
  });
}

export class SettingsService {
  private settings: LauncherSettings = createDefaultSettings();
  private readonly listeners = new Set<SettingsListener>();
  private readonly file = userDataPath('settings.json');

  constructor(private readonly events: RendererEvents) {}

  async load(): Promise<void> {
    const stored = await readJsonFile<SettingsPatch>(this.file, {});
    this.settings = merge(createDefaultSettings(), migrateLegacyBackground(stored));
  }

  get(): LauncherSettings {
    return structuredClone(this.settings);
  }

  gamePaths(): GamePaths {
    return new GamePaths(path.resolve(this.settings.launcher.gameDirectory));
  }

  onChange(listener: SettingsListener): void {
    this.listeners.add(listener);
  }

  async update(patch: SettingsPatch): Promise<LauncherSettings> {
    const previous = this.settings;
    const gameDirectory = patch.launcher?.gameDirectory;
    this.settings = merge(previous, gameDirectory ? { ...patch, launcher: { ...patch.launcher, gameDirectory: normalizeGameDirectory(gameDirectory) } } : patch);
    await this.persist(previous);
    return this.get();
  }

  async reset(): Promise<LauncherSettings> {
    const previous = this.settings;
    const defaults = createDefaultSettings();
    defaults.launcher.language = previous.launcher.language;
    defaults.launcher.gameDirectory = previous.launcher.gameDirectory;
    defaults.selectedInstanceId = previous.selectedInstanceId;
    this.settings = sanitize(defaults);
    await this.persist(previous);
    return this.get();
  }

  private async persist(previous: LauncherSettings): Promise<void> {
    await writeJsonFile(this.file, this.settings);
    const snapshot = this.get();
    this.events.emit('settings:changed', snapshot);
    for (const listener of this.listeners) listener(snapshot, previous);
  }
}
