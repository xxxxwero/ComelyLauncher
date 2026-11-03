import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { LauncherError } from '../../../shared/errors';
import type { GameSession, LaunchOptions, LaunchStepId } from '../../../shared/types/game';
import type { Instance } from '../../../shared/types/instances';
import type { AccountService } from '../../accounts/account-service';
import { launcherVersion } from '../../core/app-paths';
import type { RendererEvents } from '../../core/renderer-events';
import { createLogger } from '../../core/logger';
import type { InstanceService } from '../../instances/instance-service';
import { javaRequirement, type JavaService } from '../../java/java-service';
import type { SettingsService } from '../../settings/settings-service';
import type { TaskManager } from '../../tasks/task-manager';
import { prepareLegacyAssets } from '../assets';
import { installSteps, type GameInstaller, type InstallResult } from '../game-installer';
import { resolveVersion } from '../version-resolver';
import { ensureAuthlibInjector } from './authlib-injector';
import { analyzeCrash } from './crash-analyzer';
import { GameLogBuffer } from './game-log-buffer';
import { ensureGameLanguage } from './game-options';
import { buildLaunchArguments, parseServerAddress } from './launch-arguments';

export interface GameWindowHooks {
  onGameStarted(): void;
  onGameExited(): void;
}

const RUNNING_PATTERN = /Backend library: LWJGL|LWJGL Version|Sound engine started|Created: \d+x\d+x\d+|Narrator library/i;
const SERVER_PATTERN = /Connecting to .+|Joined the server|\[CHAT\]/i;
const RUNNING_FALLBACK_MS = 25000;
const MAX_COMMAND_LENGTH = 30000;
const GRACEFUL_STOP_MS = 15000;

const log = createLogger('game');

export class GameSessionService {
  private session: GameSession | null = null;
  private process: ChildProcess | null = null;
  private stopRequested = false;
  private preparation: AbortController | null = null;
  private forceStopTimer: NodeJS.Timeout | null = null;
  private readonly logs: GameLogBuffer;
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly settings: SettingsService,
    private readonly accounts: AccountService,
    private readonly instances: InstanceService,
    private readonly installer: GameInstaller,
    private readonly java: JavaService,
    private readonly tasks: TaskManager,
    private readonly events: RendererEvents,
    private readonly hooks: GameWindowHooks
  ) {
    this.logs = new GameLogBuffer(events);
  }

  onChange(listener: () => void): void {
    this.listeners.add(listener);
  }

  current(): GameSession | null {
    return this.session ? structuredClone(this.session) : null;
  }

  logLines(): string[] {
    return this.logs.all();
  }

  isActive(): boolean {
    return Boolean(this.session && ['installing', 'preparing', 'starting', 'running'].includes(this.session.phase));
  }

  private throwIfInstanceBusy(instanceId: string): void {
    const busy = this.tasks.list().some((task) => task.state === 'running' && (task.kind === 'instance-move' || (task.instanceId === instanceId && task.kind === 'game-install')));
    if (busy) throw new LauncherError('instance-busy', 'The instance is being installed');
  }

  async install(instanceId: string): Promise<string> {
    const instance = await this.instances.get(instanceId);
    this.throwIfInstanceBusy(instanceId);
    if (this.isActive() && this.session?.instanceId === instanceId) throw new LauncherError('game-running', 'The game is already running');
    const task = this.tasks.create({
      kind: 'game-install',
      title: { key: 'tasks.installInstance', params: { name: instance.name } },
      instanceId,
      steps: installSteps(instance)
    });
    return this.tasks.runInBackground(task, async (handle) => {
      const result = await this.installer.install(instance, handle);
      await this.instances.markInstalled(instanceId, result.versionId, result.loaderVersion);
    });
  }

  async launch(instanceId: string, options: LaunchOptions): Promise<GameSession> {
    if (this.isActive()) throw new LauncherError('game-running', 'The game is already running');
    if (!this.accounts.active()) throw new LauncherError('no-account', 'Sign in to play');
    const instance = await this.instances.get(instanceId);
    this.throwIfInstanceBusy(instanceId);
    const settings = this.settings.get();
    const server = options.server ?? (settings.game.autoConnectLastServer ? instance.lastServer : null);
    const steps: GameSession['steps'] = [
      { id: 'files', state: 'pending', note: null },
      { id: 'java', state: 'pending', note: null },
      { id: 'game', state: 'pending', note: null }
    ];
    if (server) steps.push({ id: 'server', state: 'pending', note: server });
    this.session = {
      id: randomUUID(),
      instanceId,
      phase: 'installing',
      installTaskId: null,
      steps,
      server: server ?? null,
      javaMajorVersion: null,
      memoryMb: settings.game.memoryMb,
      startedAt: Date.now(),
      runningSince: null,
      launchDurationMs: null,
      endedAt: null,
      exitCode: null,
      crash: null,
      error: null,
      lastLogLine: null
    };
    this.stopRequested = false;
    this.logs.reset();
    this.emit();
    this.run(instance).catch((error) => this.fail(error));
    return this.current() as GameSession;
  }

  stop(): void {
    const alreadyStopping = this.stopRequested;
    this.stopRequested = true;
    this.preparation?.abort();
    if (this.session?.installTaskId) this.tasks.cancel(this.session.installTaskId);
    if (this.process && this.process.exitCode === null) this.terminateGame(this.process, alreadyStopping);
    else if (this.session && this.isActive()) this.finish('stopped', null);
  }

  private terminateGame(child: ChildProcess, force: boolean): void {
    if (force || !child.pid) {
      child.kill();
      return;
    }
    execFile('taskkill', ['/PID', String(child.pid)], { windowsHide: true }, (error) => {
      if (error) child.kill();
    });
    this.forceStopTimer = setTimeout(() => child.kill(), GRACEFUL_STOP_MS);
  }

  dismiss(): void {
    if (this.isActive()) return;
    this.session = null;
    this.emit();
  }

  private async run(instance: Instance): Promise<void> {
    const session = this.session as GameSession;
    const settings = this.settings.get();
    const paths = this.settings.gamePaths();
    const instanceDir = this.instances.dir(instance.id);
    await fs.mkdir(instanceDir, { recursive: true });

    this.setStep('files', 'active');
    const ready = await this.installer.findReady(instance);
    if (ready && !instance.installedVersionId) await this.instances.markInstalled(instance.id, ready.versionId, ready.loaderVersion);
    const installed = ready ?? (await this.installWithProgress(instance, session));
    this.throwIfStopped();
    this.setStep('files', 'done');

    session.phase = 'preparing';
    this.setStep('java', 'active');
    this.preparation = new AbortController();
    const { signal } = this.preparation;
    const version = await resolveVersion(paths, installed.versionId);
    const [java, credentials] = await Promise.all([
      this.java.select(paths, javaRequirement(version), settings.java, {
        signal,
        onProgress: (progress) => {
          if (progress.totalBytes > 0) this.setStepNote('java', `${Math.round((progress.downloadedBytes / progress.totalBytes) * 100)}%`);
        }
      }),
      this.accounts.launchCredentials()
    ]);
    session.javaMajorVersion = java.majorVersion;
    if (credentials.accountType !== 'offline') this.logs.setSecrets([credentials.accessToken]);
    const authlib = credentials.authlibInjectorServer ? await ensureAuthlibInjector(paths, signal) : null;
    const assets = await prepareLegacyAssets(paths, version.assetIndex?.id ?? version.assets ?? 'legacy', instanceDir);
    await ensureGameLanguage(instanceDir, settings.launcher.language, version.releaseTime);
    this.throwIfStopped();
    this.setStep('java', 'done', `Java ${java.majorVersion}`);

    const args = buildLaunchArguments({
      paths,
      version,
      instanceDir,
      gameAssetsDir: assets.gameAssetsDir,
      credentials,
      launcherVersion: launcherVersion(),
      memoryMb: settings.game.memoryMb,
      windowWidth: settings.game.windowWidth,
      windowHeight: settings.game.windowHeight,
      fullscreen: settings.game.fullscreen,
      extraJvmArguments: settings.java.jvmArguments,
      server: session.server ? parseServerAddress(session.server) : null,
      authlibInjectorJar: authlib
    });
    session.phase = 'starting';
    this.setStep('game', 'active');
    this.logs.append(`[ComelyLauncher] ${path.basename(java.executable)} ${version.mainClass} (${version.id}), ${settings.game.memoryMb} MB`);
    await this.spawnGame(java.executable, java.majorVersion, args, instanceDir, instance);
  }

  private async installWithProgress(instance: Instance, session: GameSession): Promise<InstallResult> {
    const task = this.tasks.create({
      kind: 'game-install',
      title: { key: 'tasks.installInstance', params: { name: instance.name } },
      instanceId: instance.id,
      steps: installSteps(instance)
    });
    session.installTaskId = task.id;
    this.emit();
    const installed = await this.tasks.run(task, (handle) => this.installer.install(instance, handle));
    await this.instances.markInstalled(instance.id, installed.versionId, installed.loaderVersion);
    this.tasks.dismiss(task.id);
    session.installTaskId = null;
    return installed;
  }

  private async commandArguments(javaMajor: number, args: string[], instanceDir: string): Promise<string[]> {
    const length = args.reduce((sum, arg) => sum + arg.length + 3, 0);
    if (length < MAX_COMMAND_LENGTH || javaMajor < 9) return args;
    const argFile = path.join(instanceDir, '.comely', 'launch-args.txt');
    await fs.mkdir(path.dirname(argFile), { recursive: true });
    const quoted = args.map((arg) => `"${arg.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join('\n');
    await fs.writeFile(argFile, quoted, 'utf8');
    return [`@${argFile}`];
  }

  private async spawnGame(executable: string, javaMajor: number, args: string[], instanceDir: string, instance: Instance): Promise<void> {
    const session = this.session as GameSession;
    const child = spawn(executable, await this.commandArguments(javaMajor, args, instanceDir), { cwd: instanceDir, windowsHide: false });
    this.process = child;
    const fallback = setTimeout(() => this.markRunning(), RUNNING_FALLBACK_MS);
    const onLine = (line: string): void => {
      session.lastLogLine = line;
      if (session.phase === 'starting' && RUNNING_PATTERN.test(line)) this.markRunning();
      if (session.server && SERVER_PATTERN.test(line)) this.setStep('server', 'done');
    };
    child.stdout?.on('data', (chunk: Buffer) => this.logs.push(chunk, onLine));
    child.stderr?.on('data', (chunk: Buffer) => this.logs.push(chunk, onLine));
    child.on('error', (error) => {
      clearTimeout(fallback);
      this.fail(new LauncherError('java-not-found', error.message));
    });
    child.on('spawn', () => this.hooks.onGameStarted());
    child.on('close', (code) => {
      clearTimeout(fallback);
      if (this.forceStopTimer) clearTimeout(this.forceStopTimer);
      this.forceStopTimer = null;
      this.logs.flushPartial(onLine);
      this.process = null;
      this.hooks.onGameExited();
      this.onExit(code, instance, instanceDir).catch((error) => log.error('Exit handling failed', error));
    });
  }

  private async onExit(code: number | null, instance: Instance, instanceDir: string): Promise<void> {
    const session = this.session;
    if (!session) return;
    const playedMs = session.runningSince ? Date.now() - session.runningSince : 0;
    await this.instances.recordSession(instance.id, session.startedAt, playedMs, session.server).catch(() => undefined);
    if (this.stopRequested || code === 0) {
      this.finish('stopped', code);
      return;
    }
    session.crash = await analyzeCrash(instanceDir, this.logs.all(), code, session.startedAt);
    this.finish('crashed', code);
  }

  private markRunning(): void {
    const session = this.session;
    if (!session || session.phase !== 'starting') return;
    session.phase = 'running';
    session.runningSince = Date.now();
    session.launchDurationMs = session.runningSince - session.startedAt;
    this.setStep('game', 'done');
    if (session.server) this.setStep('server', 'active');
    this.emit();
  }

  private finish(phase: 'stopped' | 'crashed', exitCode: number | null): void {
    const session = this.session;
    if (!session) return;
    session.phase = phase;
    session.exitCode = exitCode;
    session.endedAt = Date.now();
    this.emit();
  }

  private fail(error: unknown): void {
    const session = this.session;
    if (!session) return;
    const launcherError = LauncherError.from(error);
    if (session.installTaskId) {
      this.tasks.dismiss(session.installTaskId);
      session.installTaskId = null;
    }
    if (launcherError.code === 'cancelled' || this.stopRequested) {
      this.finish('stopped', null);
      return;
    }
    log.error('Launch failed', error);
    session.phase = 'failed';
    session.error = launcherError.serialize();
    session.endedAt = Date.now();
    this.emit();
  }

  private throwIfStopped(): void {
    if (this.stopRequested) throw new LauncherError('cancelled');
  }

  private setStep(id: LaunchStepId, state: 'active' | 'done', note?: string): void {
    const step = this.session?.steps.find((entry) => entry.id === id);
    if (!step) return;
    step.state = state;
    if (note !== undefined) step.note = note;
    this.emit();
  }

  private setStepNote(id: LaunchStepId, note: string): void {
    const step = this.session?.steps.find((entry) => entry.id === id);
    if (!step || step.note === note) return;
    step.note = note;
    this.emit();
  }

  private emit(): void {
    this.events.emit('game:session', this.current());
    for (const listener of this.listeners) listener();
  }
}
