import type { SerializedLauncherError } from '../errors';
import type { StepState } from './tasks';

export type GamePhase = 'installing' | 'preparing' | 'starting' | 'running' | 'stopped' | 'crashed' | 'failed';

export type LaunchStepId = 'files' | 'java' | 'game' | 'server';

export interface LaunchStep {
  id: LaunchStepId;
  state: StepState;
  note: string | null;
}

export type CrashCause =
  | 'out-of-memory'
  | 'wrong-java'
  | 'mod-conflict'
  | 'missing-dependency'
  | 'graphics-driver'
  | 'unknown';

export interface CrashReport {
  exitCode: number | null;
  cause: CrashCause;
  excerpt: string;
  crashReportPath: string | null;
}

export interface GameSession {
  id: string;
  instanceId: string;
  phase: GamePhase;
  installTaskId: string | null;
  steps: LaunchStep[];
  server: string | null;
  javaMajorVersion: number | null;
  memoryMb: number;
  startedAt: number;
  runningSince: number | null;
  launchDurationMs: number | null;
  endedAt: number | null;
  exitCode: number | null;
  crash: CrashReport | null;
  error: SerializedLauncherError | null;
  lastLogLine: string | null;
}

export interface LaunchOptions {
  server?: string | null;
}
