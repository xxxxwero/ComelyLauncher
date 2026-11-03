import type { AccountSummary, AccountType } from '../../shared/types/accounts';

interface StoredAccountBase {
  id: string;
  type: AccountType;
  username: string;
  uuid: string;
  avatarPreset: number;
  needsReauth: boolean;
  addedAt: number;
}

export interface MicrosoftAccount extends StoredAccountBase {
  type: 'microsoft';
  refreshToken: string;
  accessToken: string;
  accessTokenExpiresAt: number;
}

export interface ElyByAccount extends StoredAccountBase {
  type: 'elyby';
  accessToken: string;
  clientToken: string;
}

export interface OfflineAccount extends StoredAccountBase {
  type: 'offline';
}

export type StoredAccount = MicrosoftAccount | ElyByAccount | OfflineAccount;

export interface AccountsFile {
  accounts: StoredAccount[];
  activeId: string | null;
}

export interface LaunchCredentials {
  accountType: AccountType;
  username: string;
  uuid: string;
  accessToken: string;
  userType: 'msa' | 'mojang' | 'legacy';
  xuid: string;
  authlibInjectorServer: string | null;
}

export function toSummary(account: StoredAccount): AccountSummary {
  return {
    id: account.id,
    type: account.type,
    username: account.username,
    uuid: account.uuid,
    avatarPreset: account.avatarPreset,
    needsReauth: account.needsReauth
  };
}
