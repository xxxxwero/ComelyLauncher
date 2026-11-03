import type { GameSession } from '../../shared/types/game';
import type { Instance, LoaderType } from '../../shared/types/instances';
import type { LanguageCode } from '../../shared/types/settings';
import type { DiscordActivity } from './discord-ipc-client';

const DOWNLOAD_URL = 'https://github.com/xxxxwero/ComelyLauncher/releases/latest';
const LOGO_ASSET = 'logo';
const PRODUCT_NAME = 'ComelyLauncher';
const GAME_NAME = 'Minecraft';
const ACTIVE_PHASES = new Set<GameSession['phase']>(['installing', 'preparing', 'starting', 'running']);

const LOADER_NAMES: Record<LoaderType, string | null> = {
  vanilla: null,
  fabric: 'Fabric',
  quilt: 'Quilt',
  forge: 'Forge',
  neoforge: 'NeoForge'
};

const LABELS: Record<LanguageCode, { inLauncher: string; starting: string; vanilla: string; download: string }> = {
  ru: { inLauncher: 'В лаунчере', starting: 'Запускает игру', vanilla: 'Без модов', download: 'Скачать лаунчер' },
  en: { inLauncher: 'In the launcher', starting: 'Starting the game', vanilla: 'No mods', download: 'Get the launcher' }
};

function gameTitle(instance: Instance | null): string {
  return instance ? `${GAME_NAME} ${instance.gameVersion}` : GAME_NAME;
}

export function isSessionActive(session: GameSession | null): session is GameSession {
  return session !== null && ACTIVE_PHASES.has(session.phase);
}

export function buildActivity(session: GameSession | null, instance: Instance | null, windowVisible: boolean, language: LanguageCode): DiscordActivity | null {
  const labels = LABELS[language];
  const base = {
    assets: { large_image: LOGO_ASSET, large_text: PRODUCT_NAME },
    buttons: [{ label: labels.download, url: DOWNLOAD_URL }]
  };
  if (!isSessionActive(session)) return windowVisible ? { ...base, details: labels.inLauncher } : null;
  if (session.phase !== 'running' || session.runningSince === null) return { ...base, details: gameTitle(instance), state: labels.starting };
  const loader = instance ? LOADER_NAMES[instance.loader.type] : null;
  return { ...base, details: gameTitle(instance), state: loader ?? labels.vanilla, timestamps: { start: session.runningSince } };
}
