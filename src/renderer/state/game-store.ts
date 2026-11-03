import type { GameSession, LaunchOptions } from '../../shared/types/game';
import { invoke } from '../api/launcher-api';
import { createStore, useStore } from './create-store';

const MAX_LINES = 3000;

export interface GameState {
  session: GameSession | null;
  logs: string[];
  overlayHidden: boolean;
}

export const gameStore = createStore<GameState>({ session: null, logs: [], overlayHidden: false });

export function useGame(): GameState {
  return useStore(gameStore);
}

export function isSessionActive(session: GameSession | null): boolean {
  return Boolean(session && ['installing', 'preparing', 'starting', 'running'].includes(session.phase));
}

export async function loadGameSession(): Promise<void> {
  const [session, logs] = await Promise.all([invoke('game:session'), invoke('game:logs')]);
  gameStore.set({ session, logs: logs.slice(-MAX_LINES), overlayHidden: false });
}

export function applySession(session: GameSession | null): void {
  gameStore.set((state) => {
    const isNew = Boolean(session && session.id !== state.session?.id);
    const justCrashed = session?.phase === 'crashed' && state.session?.phase !== 'crashed';
    return {
      session,
      logs: isNew ? [] : state.logs,
      overlayHidden: isNew || justCrashed ? false : state.overlayHidden
    };
  });
}

export function appendLogs(lines: string[]): void {
  gameStore.set((state) => {
    const logs = state.logs.concat(lines);
    return { ...state, logs: logs.length > MAX_LINES ? logs.slice(-MAX_LINES) : logs };
  });
}

export function setOverlayHidden(hidden: boolean): void {
  gameStore.set((state) => ({ ...state, overlayHidden: hidden }));
}

export async function launchGame(instanceId: string, options: LaunchOptions = {}): Promise<void> {
  applySession(await invoke('game:launch', instanceId, options));
}

export async function stopGame(): Promise<void> {
  await invoke('game:stop');
}

export async function dismissSession(): Promise<void> {
  await invoke('game:dismiss');
  applySession(null);
}
