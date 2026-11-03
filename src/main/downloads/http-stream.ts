import http, { type IncomingMessage } from 'node:http';
import https from 'node:https';
import { LauncherError } from '../../shared/errors';
import { userAgent } from '../core/http';

const MAX_REDIRECTS = 6;
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 24 });
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 24 });

function request(url: string, signal: AbortSignal): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const secure = target.protocol === 'https:';
    const client = secure ? https : http;
    const outgoing = client.get(target, { agent: secure ? httpsAgent : httpAgent, headers: { 'User-Agent': userAgent() }, signal }, resolve);
    outgoing.on('error', reject);
  });
}

export async function openHttpStream(url: string, signal: AbortSignal): Promise<IncomingMessage> {
  let current = url;
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
    const response = await request(current, signal);
    const status = response.statusCode ?? 0;
    if (status >= 300 && status < 400 && response.headers.location) {
      response.resume();
      current = new URL(response.headers.location, current).toString();
      continue;
    }
    if (status < 200 || status >= 300) {
      response.resume();
      throw new LauncherError('network', `HTTP ${status}`, { url: current, status });
    }
    return response;
  }
  throw new LauncherError('network', 'Too many redirects', { url });
}
