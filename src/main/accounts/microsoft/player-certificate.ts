import { createPrivateKey, sign } from 'node:crypto';
import { LauncherError } from '../../../shared/errors';
import { httpRequest } from '../../core/http';

const CERTIFICATES_URL = 'https://api.minecraftservices.com/player/certificates';
const PEM_ARMOR = /-----[^-]+-----|\s/g;

export interface PlayerCertificateResponse {
  keyPair?: { privateKey?: string; publicKey?: string };
  publicKeySignatureV2?: string;
  expiresAt?: string;
}

export interface PlayerIdentityProof {
  uuid: string;
  publicKey: string;
  expiresAt: number;
  mojangSignature: string;
  signature: string;
}

function pemBody(pem: string): string {
  return pem.replace(PEM_ARMOR, '');
}

function epochMillis(timestamp: string): number {
  return Date.parse(timestamp.replace(/(\.\d{3})\d+/, '$1'));
}

export function buildIdentityProof(certificate: PlayerCertificateResponse, uuid: string, message: string): PlayerIdentityProof {
  const { keyPair, publicKeySignatureV2, expiresAt } = certificate;
  if (!keyPair?.privateKey || !keyPair.publicKey || !publicKeySignatureV2 || !expiresAt) throw new LauncherError('support-unavailable', 'Player certificate is incomplete');
  const privateKey = createPrivateKey({ key: Buffer.from(pemBody(keyPair.privateKey), 'base64'), format: 'der', type: 'pkcs8' });
  return {
    uuid: uuid.replace(/-/g, '').toLowerCase(),
    publicKey: pemBody(keyPair.publicKey),
    expiresAt: epochMillis(expiresAt),
    mojangSignature: publicKeySignatureV2,
    signature: sign('sha256', Buffer.from(message, 'utf8'), privateKey).toString('base64')
  };
}

export async function signWithPlayerCertificate(accessToken: string, uuid: string, message: string): Promise<PlayerIdentityProof> {
  const response = await httpRequest(CERTIFICATES_URL, { method: 'POST', retries: 1, headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new LauncherError('support-unavailable', `Player certificate request failed (${response.status})`);
  return buildIdentityProof((await response.json()) as PlayerCertificateResponse, uuid, message);
}
