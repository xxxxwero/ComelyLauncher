import { randomUUID } from 'node:crypto';
import type { BrowserWindow } from 'electron';
import { LauncherError } from '../../shared/errors';
import { joinElyBySession } from './session-join';
import { signWithPlayerCertificate, type PlayerIdentityProof } from './microsoft/player-certificate';
import type { AccountsState, ElyByCredentials, ElyByLoginResult } from '../../shared/types/accounts';
import type { RendererEvents } from '../core/renderer-events';
import { AccountStore } from './account-store';
import {
  toSummary,
  type AccountsFile,
  type ElyByAccount,
  type LaunchCredentials,
  type MicrosoftAccount,
  type StoredAccount
} from './account-types';
import { authenticateElyBy, ELYBY_AUTHLIB_SERVER, refreshElyBy, validateElyBy } from './elyby/elyby-auth';
import { sessionFromAuthCode, sessionFromRefreshToken, type MinecraftSession } from './microsoft/microsoft-auth';
import { requestMicrosoftAuthCode } from './microsoft/microsoft-login-window';
import { offlineUuid, validateOfflineUsername } from './offline/offline-account';

const TOKEN_SAFETY_MARGIN_MS = 5 * 60 * 1000;
const AVATAR_PRESETS = 6;

function isAuthFailure(error: unknown): boolean {
  return error instanceof LauncherError && (error.code === 'auth-expired' || error.code === 'auth-elyby-invalid' || error.code === 'auth-no-minecraft');
}

export class AccountService {
  private readonly store = new AccountStore();
  private data: AccountsFile = { accounts: [], activeId: null };
  private restoreFailed = false;
  private readonly refreshes = new Map<string, Promise<void>>();

  constructor(
    private readonly events: RendererEvents,
    private readonly parentWindow: () => BrowserWindow | null
  ) {}

  async load(): Promise<void> {
    const { data, restoreFailed } = await this.store.read();
    this.data = data;
    this.restoreFailed = restoreFailed;
    if (this.data.activeId && !this.data.accounts.some((account) => account.id === this.data.activeId)) {
      this.data.activeId = this.data.accounts[0]?.id ?? null;
    }
  }

  state(): AccountsState {
    return { accounts: this.data.accounts.map(toSummary), activeId: this.data.activeId, restoreFailed: this.restoreFailed };
  }

  find(accountId: string): StoredAccount {
    const account = this.data.accounts.find((entry) => entry.id === accountId);
    if (!account) throw new LauncherError('no-account', `Account ${accountId} not found`);
    return account;
  }

  active(): StoredAccount | null {
    return this.data.accounts.find((entry) => entry.id === this.data.activeId) ?? null;
  }

  async loginMicrosoft(): Promise<AccountsState> {
    const code = await requestMicrosoftAuthCode(this.parentWindow());
    const session = await sessionFromAuthCode(code);
    const existing = this.data.accounts.find((account) => account.type === 'microsoft' && account.uuid === session.profile.id);
    const account: MicrosoftAccount = {
      id: existing?.id ?? randomUUID(),
      type: 'microsoft',
      username: session.profile.name,
      uuid: session.profile.id,
      avatarPreset: existing?.avatarPreset ?? 0,
      needsReauth: false,
      addedAt: existing?.addedAt ?? Date.now(),
      ...this.microsoftTokens(session)
    };
    return this.upsertAndActivate(account);
  }

  async loginElyBy(credentials: ElyByCredentials): Promise<ElyByLoginResult> {
    const login = credentials.login.trim();
    if (!login || !credentials.password) throw new LauncherError('invalid-input', 'Login and password are required');
    const existing = this.data.accounts.find((account): account is ElyByAccount => account.type === 'elyby' && account.username.toLowerCase() === login.toLowerCase());
    const clientToken = existing?.clientToken ?? randomUUID();
    const password = credentials.totp ? `${credentials.password}:${credentials.totp.trim()}` : credentials.password;
    const outcome = await authenticateElyBy(login, password, clientToken);
    if (outcome.kind === 'two-factor-required') return { status: 'two-factor-required' };
    const session = outcome.session;
    const account: ElyByAccount = {
      id: existing?.id ?? this.data.accounts.find((entry) => entry.type === 'elyby' && entry.uuid === session.uuid)?.id ?? randomUUID(),
      type: 'elyby',
      username: session.username,
      uuid: session.uuid,
      avatarPreset: existing?.avatarPreset ?? 0,
      needsReauth: false,
      addedAt: existing?.addedAt ?? Date.now(),
      accessToken: session.accessToken,
      clientToken: session.clientToken
    };
    return { status: 'ok', state: await this.upsertAndActivate(account) };
  }

  async addOffline(username: string): Promise<AccountsState> {
    const name = validateOfflineUsername(username);
    const existing = this.data.accounts.find((account) => account.type === 'offline' && account.username.toLowerCase() === name.toLowerCase());
    return this.upsertAndActivate({
      id: existing?.id ?? randomUUID(),
      type: 'offline',
      username: name,
      uuid: offlineUuid(name),
      avatarPreset: existing?.avatarPreset ?? this.data.accounts.length % AVATAR_PRESETS,
      needsReauth: false,
      addedAt: existing?.addedAt ?? Date.now()
    });
  }

  async select(accountId: string): Promise<AccountsState> {
    this.find(accountId);
    this.data.activeId = accountId;
    return this.persist();
  }

  async remove(accountId: string): Promise<AccountsState> {
    this.data.accounts = this.data.accounts.filter((account) => account.id !== accountId);
    if (this.data.activeId === accountId) this.data.activeId = this.data.accounts[0]?.id ?? null;
    return this.persist();
  }

  async setAvatar(accountId: string, preset: number): Promise<AccountsState> {
    const account = this.find(accountId);
    account.avatarPreset = Math.max(0, Math.min(AVATAR_PRESETS - 1, Math.round(preset)));
    return this.persist();
  }

  async refresh(accountId: string): Promise<AccountsState> {
    await this.ensureFreshAccount(this.find(accountId), true);
    return this.persist();
  }

  async minecraftAccessToken(accountId: string): Promise<string> {
    const account = this.find(accountId);
    if (account.type !== 'microsoft') throw new LauncherError('no-account', 'Microsoft account required');
    await this.ensureFreshAccount(account, false);
    await this.persist();
    return account.accessToken;
  }

  async joinElyBySession(accountId: string, serverId: string): Promise<void> {
    const account = this.find(accountId);
    if (account.type !== 'elyby') throw new LauncherError('no-account', 'Ely.by account required');
    await this.ensureFreshAccount(account, false);
    await this.persist();
    await joinElyBySession(account.accessToken, account.uuid, serverId);
  }

  async provePlayerIdentity(accountId: string, message: string): Promise<PlayerIdentityProof> {
    const account = this.find(accountId);
    return signWithPlayerCertificate(await this.minecraftAccessToken(accountId), account.uuid, message);
  }

  async launchCredentials(): Promise<LaunchCredentials> {
    const account = this.active();
    if (!account) throw new LauncherError('no-account', 'No account selected');
    await this.ensureFreshAccount(account, false);
    await this.persist();
    if (account.type === 'microsoft') {
      return { accountType: 'microsoft', username: account.username, uuid: account.uuid, accessToken: account.accessToken, userType: 'msa', xuid: '', authlibInjectorServer: null };
    }
    if (account.type === 'elyby') {
      return { accountType: 'elyby', username: account.username, uuid: account.uuid, accessToken: account.accessToken, userType: 'mojang', xuid: '', authlibInjectorServer: ELYBY_AUTHLIB_SERVER };
    }
    return { accountType: 'offline', username: account.username, uuid: account.uuid, accessToken: account.uuid, userType: 'legacy', xuid: '', authlibInjectorServer: null };
  }

  private ensureFreshAccount(account: StoredAccount, force: boolean): Promise<void> {
    const running = this.refreshes.get(account.id);
    if (running) return running;
    const refresh = this.refreshAccount(account, force).finally(() => this.refreshes.delete(account.id));
    this.refreshes.set(account.id, refresh);
    return refresh;
  }

  private async refreshAccount(account: StoredAccount, force: boolean): Promise<void> {
    try {
      if (account.type === 'microsoft') {
        if (!force && account.accessTokenExpiresAt - TOKEN_SAFETY_MARGIN_MS > Date.now()) return;
        const session = await sessionFromRefreshToken(account.refreshToken);
        Object.assign(account, this.microsoftTokens(session), { username: session.profile.name, needsReauth: false });
      } else if (account.type === 'elyby') {
        if (!force && (await validateElyBy(account.accessToken))) return;
        const session = await refreshElyBy(account.accessToken, account.clientToken);
        Object.assign(account, { accessToken: session.accessToken, clientToken: session.clientToken, username: session.username, needsReauth: false });
      }
    } catch (error) {
      if (isAuthFailure(error)) {
        account.needsReauth = true;
        await this.persist();
        throw new LauncherError('auth-expired', 'Session expired, sign in again', { account: account.username });
      }
      throw error;
    }
  }

  private microsoftTokens(session: MinecraftSession): Pick<MicrosoftAccount, 'refreshToken' | 'accessToken' | 'accessTokenExpiresAt'> {
    return { refreshToken: session.refreshToken, accessToken: session.accessToken, accessTokenExpiresAt: session.accessTokenExpiresAt };
  }

  private async upsertAndActivate(account: StoredAccount): Promise<AccountsState> {
    const index = this.data.accounts.findIndex((entry) => entry.id === account.id);
    if (index >= 0) this.data.accounts[index] = account;
    else this.data.accounts.push(account);
    this.data.activeId = account.id;
    return this.persist();
  }

  private async persist(): Promise<AccountsState> {
    await this.store.write(this.data);
    const state = this.state();
    this.events.emit('accounts:changed', state);
    return state;
  }
}
