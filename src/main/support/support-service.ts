import { randomBytes } from 'node:crypto';
import { app } from 'electron';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { LauncherError, type LauncherErrorCode } from '../../shared/errors';
import type { SupportSession, SupportThread, SupportTicket, SupportTicketDraft, SupportTicketStatus } from '../../shared/types/support';
import type { AccountService } from '../accounts/account-service';
import { userDataPath } from '../core/app-paths';
import { readJsonFile, writeJsonFile } from '../core/file-system';
import { httpRequest } from '../core/http';
import { createLogger } from '../core/logger';
import type { InstanceService } from '../instances/instance-service';
import { sanitizeLog } from '../minecraft/launch/log-sharing';
import type { GameSessionService } from '../minecraft/launch/game-session-service';
import type { SettingsService } from '../settings/settings-service';
import { SUPPORT_SERVER_URL } from './support-config';

const REQUEST_TIMEOUT_MS = 20000;
const MAX_LOG_CHARS = 250 * 1024;
const LAUNCHER_LOG_CHARS = 50 * 1024;
const GUEST_KEY = 'guest';
const EXPIRY_MARGIN_MS = 60 * 1000;
const UNVERIFIED_SESSION_TTL_MS = 2 * 60 * 1000;
const CHALLENGE_SIGNATURE_PREFIX = 'comely-support:';

const ERROR_CODES: Record<string, LauncherErrorCode> = {
  'rate-limited': 'support-rate-limited',
  blocked: 'support-blocked',
  'ticket-closed': 'support-ticket-closed',
  'too-large': 'invalid-input',
  'invalid-input': 'invalid-input'
};

const log = createLogger('support');

interface DeviceState {
  secret: string;
  engaged: boolean;
}

interface CachedSession {
  token: string;
  expiresAt: number;
  session: SupportSession;
}

interface AuthResponse extends Omit<SupportSession, 'verificationFailed'> {
  token: string;
  expiresAt: number;
}

export class SupportService {
  private readonly deviceFile = userDataPath('support-device.json');
  private readonly sessions = new Map<string, CachedSession>();
  private device: DeviceState | null = null;

  constructor(
    private readonly accounts: AccountService,
    private readonly settings: SettingsService,
    private readonly instances: InstanceService,
    private readonly game: GameSessionService
  ) {}

  async session(): Promise<SupportSession> {
    await this.markEngaged();
    if (this.sessions.get(this.sessionKey())?.session.verificationFailed) this.sessions.delete(this.sessionKey());
    return (await this.ensureSession()).session;
  }

  async unread(): Promise<number> {
    if (!(await this.loadDevice()).engaged) return 0;
    return (await this.request<{ count: number }>('GET', '/unread')).count;
  }

  tickets(status: SupportTicketStatus): Promise<SupportTicket[]> {
    return this.request('GET', `/tickets?status=${status}`);
  }

  thread(ticketId: string): Promise<SupportThread> {
    return this.request('GET', `/tickets/${encodeURIComponent(ticketId)}`);
  }

  async create(draft: SupportTicketDraft): Promise<SupportTicket> {
    await this.markEngaged();
    const logText = draft.attachLog ? await this.collectLog() : null;
    return this.request('POST', '/tickets', { subject: draft.subject, message: draft.message, log: logText, meta: await this.collectMeta() });
  }

  reply(ticketId: string, text: string): Promise<SupportThread> {
    return this.request('POST', `/tickets/${encodeURIComponent(ticketId)}/messages`, { text });
  }

  setStatus(ticketId: string, status: SupportTicketStatus): Promise<SupportThread> {
    return this.request('POST', `/tickets/${encodeURIComponent(ticketId)}/status`, { status });
  }

  setBlocked(ticketId: string, blocked: boolean): Promise<SupportThread> {
    return this.request('POST', `/tickets/${encodeURIComponent(ticketId)}/block`, { blocked });
  }

  async ticketLog(ticketId: string): Promise<string> {
    return (await this.request<{ log: string }>('GET', `/tickets/${encodeURIComponent(ticketId)}/log`)).log;
  }

  private sessionKey(): string {
    return this.accounts.active()?.id ?? GUEST_KEY;
  }

  private async ensureSession(): Promise<CachedSession> {
    const key = this.sessionKey();
    const cached = this.sessions.get(key);
    if (cached && cached.expiresAt - EXPIRY_MARGIN_MS > Date.now()) return cached;
    const verified = await this.verifiedLogin();
    const auth = verified ?? (await this.guestLogin());
    const verificationFailed = !verified && Boolean(this.accounts.active()) && this.accounts.active()?.type !== 'offline';
    const created: CachedSession = {
      token: auth.token,
      expiresAt: verificationFailed ? Date.now() + UNVERIFIED_SESSION_TTL_MS + EXPIRY_MARGIN_MS : auth.expiresAt,
      session: { name: auth.name, provider: auth.provider, isAdmin: auth.isAdmin, verificationFailed }
    };
    this.sessions.set(key, created);
    return created;
  }

  private async verifiedLogin(): Promise<AuthResponse | null> {
    const account = this.accounts.active();
    if (!account || account.type === 'offline') return null;
    try {
      const { challenge, serverId } = await this.send<{ challenge: string; serverId: string }>('POST', '/auth/challenge', {});
      if (account.type === 'microsoft') {
        const proof = await this.accounts.provePlayerIdentity(account.id, `${CHALLENGE_SIGNATURE_PREFIX}${serverId}`);
        return await this.send<AuthResponse>('POST', '/auth/certificate', { ...proof, challenge, name: account.username });
      }
      await this.accounts.joinElyBySession(account.id, serverId);
      return await this.send<AuthResponse>('POST', '/auth/verify', { provider: account.type, username: account.username, challenge });
    } catch (error) {
      log.warn('Could not verify the account, continuing without verification', error);
      return null;
    }
  }

  private async guestLogin(): Promise<AuthResponse> {
    const { secret } = await this.loadDevice();
    return this.send<AuthResponse>('POST', '/auth/guest', { deviceSecret: secret, name: this.accounts.active()?.username ?? null });
  }

  async isAdminIfEngaged(): Promise<boolean> {
    if (!(await this.loadDevice()).engaged) return false;
    return (await this.ensureSession().catch(() => null))?.session.isAdmin ?? false;
  }

  fetchPublic<T>(route: string): Promise<T> {
    return this.send<T>('GET', route);
  }

  async request<T>(method: string, route: string, body?: unknown): Promise<T> {
    const { token } = await this.ensureSession();
    try {
      return await this.send<T>(method, route, body, token);
    } catch (error) {
      if (!(error instanceof LauncherError) || error.params?.status !== 401) throw error;
      this.sessions.delete(this.sessionKey());
      return this.send<T>(method, route, body, (await this.ensureSession()).token);
    }
  }

  private async send<T>(method: string, route: string, body?: unknown, token?: string): Promise<T> {
    const response = await httpRequest(`${SUPPORT_SERVER_URL}/v1${route}`, {
      method,
      timeoutMs: REQUEST_TIMEOUT_MS,
      retries: method === 'GET' ? 1 : 0,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body)
    }).catch((error: unknown) => {
      throw new LauncherError('support-unavailable', error instanceof Error ? error.message : String(error));
    });
    const data = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
    if (response.ok && data) return data;
    throw new LauncherError(ERROR_CODES[data?.error ?? ''] ?? 'support-unavailable', data?.error ?? `HTTP ${response.status}`, { status: response.status });
  }

  private async loadDevice(): Promise<DeviceState> {
    if (this.device) return this.device;
    const stored = await readJsonFile<Partial<DeviceState>>(this.deviceFile, {});
    this.device = { secret: stored.secret ?? randomBytes(32).toString('hex'), engaged: stored.engaged ?? false };
    if (!stored.secret) await writeJsonFile(this.deviceFile, this.device);
    return this.device;
  }

  private async markEngaged(): Promise<void> {
    const device = await this.loadDevice();
    if (device.engaged) return;
    device.engaged = true;
    await writeJsonFile(this.deviceFile, device);
  }

  private async collectLog(): Promise<string | null> {
    const launcherLog = await fs.readFile(userDataPath('logs', 'launcher.log'), 'utf8').catch(() => '');
    const gameLog = (await this.gameLogLines()).join('\n');
    const parts = [];
    if (launcherLog) parts.push(`=== launcher.log ===\n${launcherLog.slice(-LAUNCHER_LOG_CHARS)}`);
    if (gameLog) parts.push(`=== game log ===\n${gameLog.slice(-(MAX_LOG_CHARS - LAUNCHER_LOG_CHARS))}`);
    return parts.length > 0 ? sanitizeLog(parts.join('\n\n')) : null;
  }

  private async gameLogLines(): Promise<string[]> {
    const buffered = this.game.logLines();
    if (buffered.length > 0) return buffered;
    const instanceId = this.game.current()?.instanceId ?? this.settings.get().selectedInstanceId;
    if (!instanceId) return [];
    const latest = await fs.readFile(path.join(this.instances.dir(instanceId), 'logs', 'latest.log'), 'utf8').catch(() => '');
    return latest.split(/\r?\n/).filter(Boolean);
  }

  private async collectMeta(): Promise<Record<string, string>> {
    const settings = this.settings.get();
    const instance = settings.selectedInstanceId ? await this.instances.get(settings.selectedInstanceId).catch(() => null) : null;
    const session = this.game.current();
    return {
      launcherVersion: app.getVersion(),
      system: `Windows ${os.release()}`,
      totalMemoryMb: String(Math.round(os.totalmem() / (1024 * 1024))),
      gameMemoryMb: String(settings.game.memoryMb),
      instance: instance ? `${instance.gameVersion} ${instance.loader.type} ${instance.loader.version ?? ''}`.trim() : '',
      modCount: instance ? String(instance.contentCount) : '',
      gamePhase: session?.phase ?? '',
      crashCause: session?.crash?.cause ?? ''
    };
  }
}
