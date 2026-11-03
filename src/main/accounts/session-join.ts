import { LauncherError } from '../../shared/errors';
import { postJson } from '../core/http';

const ELYBY_JOIN_URL = 'https://authserver.ely.by/session/join';
const JOIN_TIMEOUT_MS = 15000;
const JOINED_STATUS = 204;

export async function joinElyBySession(accessToken: string, profileId: string, serverId: string): Promise<void> {
  const { status } = await postJson(ELYBY_JOIN_URL, { accessToken, selectedProfile: profileId.replace(/-/g, ''), serverId }, { timeoutMs: JOIN_TIMEOUT_MS });
  if (status !== JOINED_STATUS) throw new LauncherError('support-unavailable', `Session server answered ${status}`);
}
