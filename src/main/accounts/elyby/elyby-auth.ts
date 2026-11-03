import { LauncherError } from '../../../shared/errors';
import { postJson } from '../../core/http';

const AUTH_SERVER = 'https://authserver.ely.by/auth';
export const ELYBY_AUTHLIB_SERVER = 'ely.by';

interface YggdrasilResponse {
  accessToken?: string;
  clientToken?: string;
  selectedProfile?: { id: string; name: string };
  error?: string;
  errorMessage?: string;
}

export interface ElyBySession {
  accessToken: string;
  clientToken: string;
  uuid: string;
  username: string;
}

export type ElyByAuthOutcome = { kind: 'session'; session: ElyBySession } | { kind: 'two-factor-required' };

function toSession(data: YggdrasilResponse, clientToken: string): ElyBySession {
  if (!data.accessToken || !data.selectedProfile) throw new LauncherError('auth-elyby-invalid', 'Ely.by returned no profile');
  return {
    accessToken: data.accessToken,
    clientToken: data.clientToken ?? clientToken,
    uuid: data.selectedProfile.id,
    username: data.selectedProfile.name
  };
}

export async function authenticateElyBy(login: string, password: string, clientToken: string): Promise<ElyByAuthOutcome> {
  const { status, data } = await postJson<YggdrasilResponse>(`${AUTH_SERVER}/authenticate`, {
    username: login,
    password,
    clientToken,
    requestUser: true
  });
  if (status === 200) return { kind: 'session', session: toSession(data, clientToken) };
  if (data.errorMessage?.toLowerCase().includes('two factor')) return { kind: 'two-factor-required' };
  throw new LauncherError('auth-elyby-invalid', data.errorMessage ?? `Ely.by authentication failed (${status})`);
}

export async function refreshElyBy(accessToken: string, clientToken: string): Promise<ElyBySession> {
  const { status, data } = await postJson<YggdrasilResponse>(`${AUTH_SERVER}/refresh`, { accessToken, clientToken, requestUser: true });
  if (status !== 200) throw new LauncherError('auth-expired', data.errorMessage ?? 'Ely.by session expired');
  return toSession(data, clientToken);
}

export async function validateElyBy(accessToken: string): Promise<boolean> {
  const { status } = await postJson<YggdrasilResponse>(`${AUTH_SERVER}/validate`, { accessToken });
  return status === 200;
}
