import { ApiError, type Env, type Session } from './env';
import { MOJANG_CERTIFICATE_KEYS } from './mojang-keys';

const CHALLENGE_TTL_MS = 2 * 60 * 1000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ELYBY_SESSION_URL = 'https://authserver.ely.by/session/hasJoined';
const NAME_PATTERN = /^[A-Za-z0-9_]{1,16}$/;
const DEVICE_SECRET_PATTERN = /^[a-f0-9]{64}$/;
const MAX_GUEST_NAME_LENGTH = 32;
const UUID_PATTERN = /^[0-9a-f]{32}$/;
const CHALLENGE_SIGNATURE_PREFIX = 'comely-support:';

const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hmac(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
}

export async function sha256(value: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
}

function randomHex(bytes: number): string {
  return toHex(crypto.getRandomValues(new Uint8Array(bytes)).buffer as ArrayBuffer);
}

function equalStrings(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

async function serverIdFor(env: Env, nonce: string, expires: number): Promise<string> {
  return (await hmac(env.SESSION_SECRET, `challenge.${nonce}.${expires}`)).slice(0, 40);
}

export async function createChallenge(env: Env): Promise<{ challenge: string; serverId: string }> {
  const nonce = randomHex(16);
  const expires = Date.now() + CHALLENGE_TTL_MS;
  return { challenge: `${nonce}.${expires}`, serverId: await serverIdFor(env, nonce, expires) };
}

async function signSession(env: Env, session: Session): Promise<string> {
  const payload = btoa(unescape(encodeURIComponent(JSON.stringify(session))));
  return `${payload}.${await hmac(env.SESSION_SECRET, `session.${payload}`)}`;
}

async function sessionResponse(env: Env, session: Session): Promise<Record<string, unknown>> {
  return { token: await signSession(env, session), name: session.name, provider: session.provider, isAdmin: session.admin, expiresAt: session.exp };
}

async function challengeServerId(env: Env, challenge: unknown): Promise<string> {
  if (typeof challenge !== 'string') throw new ApiError(400, 'invalid-input');
  const [nonce, expiresText] = challenge.split('.');
  const expires = Number(expiresText);
  if (!nonce || !Number.isFinite(expires) || expires < Date.now()) throw new ApiError(401, 'challenge-expired');
  return serverIdFor(env, nonce, expires);
}

function fromBase64(value: unknown): Uint8Array {
  if (typeof value !== 'string' || !value) throw new ApiError(400, 'invalid-input');
  try {
    return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  } catch {
    throw new ApiError(400, 'invalid-input');
  }
}

async function verifyRsa(publicKey: Uint8Array, hash: 'SHA-1' | 'SHA-256', signature: Uint8Array, data: Uint8Array): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey('spki', publicKey, { name: 'RSASSA-PKCS1-v1_5', hash }, false, ['verify']);
    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, data);
  } catch {
    return false;
  }
}

function certificatePayload(uuid: string, expiresAt: number, publicKey: Uint8Array): Uint8Array {
  const payload = new Uint8Array(24 + publicKey.length);
  for (let index = 0; index < 16; index++) payload[index] = parseInt(uuid.slice(index * 2, index * 2 + 2), 16);
  new DataView(payload.buffer).setBigInt64(16, BigInt(expiresAt));
  payload.set(publicKey, 24);
  return payload;
}

export async function verifyCertificate(env: Env, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { uuid, name, expiresAt } = body;
  if (typeof uuid !== 'string' || !UUID_PATTERN.test(uuid) || typeof name !== 'string' || !NAME_PATTERN.test(name) || typeof expiresAt !== 'number' || !Number.isSafeInteger(expiresAt)) throw new ApiError(400, 'invalid-input');
  const serverId = await challengeServerId(env, body.challenge);
  if (expiresAt < Date.now()) throw new ApiError(401, 'not-verified');
  const publicKey = fromBase64(body.publicKey);
  const mojangSignature = fromBase64(body.mojangSignature);
  const signed = certificatePayload(uuid, expiresAt, publicKey);
  const mojangKeys = env.MOJANG_KEYS ? env.MOJANG_KEYS.split(',') : MOJANG_CERTIFICATE_KEYS;
  let trusted = false;
  for (const mojangKey of mojangKeys) {
    if (await verifyRsa(fromBase64(mojangKey), 'SHA-1', mojangSignature, signed)) trusted = true;
  }
  if (!trusted) throw new ApiError(401, 'not-verified');
  if (!(await verifyRsa(publicKey, 'SHA-256', fromBase64(body.signature), encoder.encode(`${CHALLENGE_SIGNATURE_PREFIX}${serverId}`)))) throw new ApiError(401, 'not-verified');
  const admin = equalStrings(uuid, env.ADMIN_UUID.toLowerCase());
  return sessionResponse(env, { sub: `microsoft:${uuid}`, name, provider: 'microsoft', admin, exp: Date.now() + SESSION_TTL_MS });
}

export async function verifyElyBy(env: Env, username: unknown, challenge: unknown): Promise<Record<string, unknown>> {
  if (typeof username !== 'string' || !NAME_PATTERN.test(username)) throw new ApiError(400, 'invalid-input');
  const serverId = await challengeServerId(env, challenge);
  const base = env.ELYBY_SESSION_URL ?? ELYBY_SESSION_URL;
  const response = await fetch(`${base}?username=${encodeURIComponent(username)}&serverId=${serverId}`, { headers: { 'User-Agent': 'ComelyLauncher-Support/1.0' } });
  if (response.status !== 200) throw new ApiError(401, 'not-verified');
  const profile = (await response.json()) as { id?: string; name?: string };
  if (!profile.id || !profile.name) throw new ApiError(401, 'not-verified');
  const id = profile.id.replace(/-/g, '').toLowerCase();
  return sessionResponse(env, { sub: `elyby:${id}`, name: profile.name, provider: 'elyby', admin: false, exp: Date.now() + SESSION_TTL_MS });
}

export async function createGuest(env: Env, deviceSecret: unknown, name: unknown): Promise<Record<string, unknown>> {
  if (typeof deviceSecret !== 'string' || !DEVICE_SECRET_PATTERN.test(deviceSecret)) throw new ApiError(400, 'invalid-input');
  const displayName = typeof name === 'string' && name.trim() ? name.trim().slice(0, MAX_GUEST_NAME_LENGTH) : 'Player';
  return sessionResponse(env, { sub: `offline:${await sha256(deviceSecret)}`, name: displayName, provider: 'offline', admin: false, exp: Date.now() + SESSION_TTL_MS });
}

export async function readSession(env: Env, request: Request): Promise<Session> {
  const header = request.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const [payload, signature] = token.split('.');
  if (!payload || !signature) throw new ApiError(401, 'unauthorized');
  if (!equalStrings(signature, await hmac(env.SESSION_SECRET, `session.${payload}`))) throw new ApiError(401, 'unauthorized');
  const session = JSON.parse(decodeURIComponent(escape(atob(payload)))) as Session;
  if (session.exp < Date.now()) throw new ApiError(401, 'unauthorized');
  return session;
}
