import type { GameSession, LaunchStepId } from '../../../shared/types/game';
import type { TaskSnapshot } from '../../../shared/types/tasks';
import type { TranslationKey } from '../../i18n/i18n';

export const STEP_LABELS: Record<LaunchStepId, TranslationKey> = {
  files: 'game.stepFiles',
  java: 'game.stepJava',
  game: 'game.stepGame',
  server: 'game.stepServer'
};

const STEP_WEIGHTS: Record<LaunchStepId, number> = { files: 0.5, java: 0.15, game: 0.35, server: 0 };

export function launchProgress(session: GameSession, task: TaskSnapshot | null): number {
  return session.steps.reduce((sum, step) => {
    const weight = STEP_WEIGHTS[step.id];
    if (step.state === 'done') return sum + weight;
    if (step.state === 'active' && step.id === 'files' && task) return sum + weight * task.progress;
    return sum;
  }, 0);
}

export function isSessionStarting(session: GameSession | null): boolean {
  return Boolean(session && ['installing', 'preparing', 'starting'].includes(session.phase));
}
