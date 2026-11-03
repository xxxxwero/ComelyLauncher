import { LauncherError } from '../../../shared/errors';
import { fetchJson, httpRequest, postJson } from '../../core/http';
import { MICROSOFT_CLIENT_ID, MICROSOFT_REDIRECT_URI, MICROSOFT_SCOPE } from './microsoft-login-window';

const TOKEN_URL = 'https://login.live.com/oauth20_token.srf';
const XBOX_USER_URL = 'https://user.auth.xboxlive.com/user/authenticate';
const XSTS_URL = 'https://xsts.auth.xboxlive.com/xsts/authorize';
const MINECRAFT_LOGIN_URL = 'https://api.minecraftservices.com/authentication/login_with_xbox';
export const MINECRAFT_PROFILE_URL = 'https://api.minecraftservices.com/minecraft/profile';

interface MicrosoftTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

interface XboxResponse {
  Token: string;
  DisplayClaims: { xui: Array<{ uhs: string }> };
  XErr?: number;
}

export interface MinecraftProfileResponse {
  id: string;
  name: string;
  skins?: Array<{ id: string; state: string; url: string; variant: string }>;
  capes?: Array<{ id: string; state: string; url: string; alias: string }>;
}

export interface MinecraftSession {
  refreshToken: string;
  accessToken: string;
  accessTokenExpiresAt: number;
  profile: MinecraftProfileResponse;
}

const XSTS_ERRORS: Record<number, 'auth-no-xbox' | 'auth-region-blocked' | 'auth-child-account'> = {
  2148916233: 'auth-no-xbox',
  2148916235: 'auth-region-blocked',
  2148916236: 'auth-child-account',
  2148916237: 'auth-child-account',
  2148916238: 'auth-child-account'
};

async function requestMicrosoftTokens(params: Record<string, string>): Promise<MicrosoftTokens> {
  const body = new URLSearchParams({ client_id: MICROSOFT_CLIENT_ID, scope: MICROSOFT_SCOPE, redirect_uri: MICROSOFT_REDIRECT_URI, ...params });
  const response = await httpRequest(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });
  const data = (await response.json().catch(() => ({}))) as Partial<MicrosoftTokens> & { error_description?: string };
  if (!response.ok || !data.access_token || !data.refresh_token) {
    throw new LauncherError('auth-expired', data.error_description ?? `Microsoft token request failed (${response.status})`);
  }
  return data as MicrosoftTokens;
}

async function authenticateXbox(microsoftAccessToken: string): Promise<XboxResponse> {
  for (const ticket of [microsoftAccessToken, `t=${microsoftAccessToken}`, `d=${microsoftAccessToken}`]) {
    const { status, data } = await postJson<XboxResponse>(XBOX_USER_URL, {
      Properties: { AuthMethod: 'RPS', SiteName: 'user.auth.xboxlive.com', RpsTicket: ticket },
      RelyingParty: 'http://auth.xboxlive.com',
      TokenType: 'JWT'
    });
    if (status === 200 && data.Token) return data;
  }
  throw new LauncherError('auth-microsoft-failed', 'Xbox Live authentication failed');
}

async function authorizeXsts(xboxToken: string): Promise<XboxResponse> {
  const { status, data } = await postJson<XboxResponse>(XSTS_URL, {
    Properties: { SandboxId: 'RETAIL', UserTokens: [xboxToken] },
    RelyingParty: 'rp://api.minecraftservices.com/',
    TokenType: 'JWT'
  });
  if (status === 200 && data.Token) return data;
  const code = data.XErr ? XSTS_ERRORS[data.XErr] : undefined;
  throw new LauncherError(code ?? 'auth-microsoft-failed', `XSTS authorization failed (${data.XErr ?? status})`);
}

async function loginWithXbox(xsts: XboxResponse): Promise<{ access_token: string; expires_in: number }> {
  const userHash = xsts.DisplayClaims.xui[0]?.uhs;
  const { status, data } = await postJson<{ access_token?: string; expires_in?: number; errorMessage?: string }>(MINECRAFT_LOGIN_URL, {
    identityToken: `XBL3.0 x=${userHash};${xsts.Token}`
  });
  if (status !== 200 || !data.access_token) {
    throw new LauncherError('auth-microsoft-failed', data.errorMessage ?? `Minecraft login failed (${status})`);
  }
  return { access_token: data.access_token, expires_in: data.expires_in ?? 86400 };
}

export async function fetchMinecraftProfile(accessToken: string): Promise<MinecraftProfileResponse> {
  const response = await httpRequest(MINECRAFT_PROFILE_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (response.status === 404) throw new LauncherError('auth-no-minecraft', 'This Microsoft account does not own Minecraft');
  if (response.status === 401) throw new LauncherError('auth-expired', 'Minecraft token expired');
  if (!response.ok) throw new LauncherError('network', `Profile request failed (${response.status})`);
  return (await response.json()) as MinecraftProfileResponse;
}

async function completeSession(tokens: MicrosoftTokens): Promise<MinecraftSession> {
  const xbox = await authenticateXbox(tokens.access_token);
  const xsts = await authorizeXsts(xbox.Token);
  const minecraft = await loginWithXbox(xsts);
  const profile = await fetchMinecraftProfile(minecraft.access_token);
  return {
    refreshToken: tokens.refresh_token,
    accessToken: minecraft.access_token,
    accessTokenExpiresAt: Date.now() + minecraft.expires_in * 1000,
    profile
  };
}

export async function sessionFromAuthCode(code: string): Promise<MinecraftSession> {
  return completeSession(await requestMicrosoftTokens({ code, grant_type: 'authorization_code' }));
}

export async function sessionFromRefreshToken(refreshToken: string): Promise<MinecraftSession> {
  return completeSession(await requestMicrosoftTokens({ refresh_token: refreshToken, grant_type: 'refresh_token' }));
}

export async function fetchJsonWithBearer<T>(url: string, accessToken: string): Promise<T> {
  return fetchJson<T>(url, { headers: { Authorization: `Bearer ${accessToken}` } });
}
