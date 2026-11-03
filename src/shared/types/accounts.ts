export type AccountType = 'microsoft' | 'elyby' | 'offline';

export interface AccountSummary {
  id: string;
  type: AccountType;
  username: string;
  uuid: string;
  avatarPreset: number;
  needsReauth: boolean;
}

export interface AccountsState {
  accounts: AccountSummary[];
  activeId: string | null;
  restoreFailed: boolean;
}

export interface ElyByCredentials {
  login: string;
  password: string;
  totp?: string;
}

export type ElyByLoginResult =
  | { status: 'ok'; state: AccountsState }
  | { status: 'two-factor-required' };
