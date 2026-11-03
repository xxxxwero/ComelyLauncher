import { app } from 'electron';
import { LauncherError } from '../../shared/errors';

export interface HttpOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string | URLSearchParams | FormData | Buffer;
  signal?: AbortSignal;
  timeoutMs?: number;
  retries?: number;
}

export function userAgent(): string {
  return `ComelyLauncher/${app.getVersion()} (github.com/comelylauncher)`;
}

function combineSignals(timeoutMs: number, signal?: AbortSignal): AbortSignal | undefined {
  if (timeoutMs <= 0) return signal;
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

function describeFailure(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause as { code?: string; message?: string } | undefined;
  return cause ? `${error.message}: ${cause.code ?? cause.message ?? 'unknown cause'}` : error.message;
}

export async function httpRequest(url: string, options: HttpOptions = {}): Promise<Response> {
  const attempts = (options.retries ?? (options.method && options.method !== 'GET' ? 0 : 2)) + 1;
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (options.signal?.aborted) throw new LauncherError('cancelled');
    try {
      return await fetch(url, {
        method: options.method ?? 'GET',
        headers: { 'User-Agent': userAgent(), ...options.headers },
        body: options.body as RequestInit['body'],
        signal: combineSignals(options.timeoutMs ?? 30000, options.signal)
      });
    } catch (error) {
      lastError = error;
      if (options.signal?.aborted) throw new LauncherError('cancelled');
    }
  }
  throw new LauncherError('network', describeFailure(lastError), { url });
}

async function ensureOk(response: Response, url: string): Promise<Response> {
  if (response.ok) return response;
  const text = await response.text().catch(() => '');
  throw new LauncherError('network', `HTTP ${response.status} ${text.slice(0, 300)}`, { url, status: response.status });
}

export async function fetchJson<T>(url: string, options: HttpOptions = {}): Promise<T> {
  const response = await ensureOk(await httpRequest(url, options), url);
  return (await response.json()) as T;
}

export async function fetchText(url: string, options: HttpOptions = {}): Promise<string> {
  const response = await ensureOk(await httpRequest(url, options), url);
  return response.text();
}

export async function fetchBuffer(url: string, options: HttpOptions = {}): Promise<Buffer> {
  const response = await ensureOk(await httpRequest(url, options), url);
  return Buffer.from(await response.arrayBuffer());
}

export async function postJson<T>(url: string, body: unknown, options: HttpOptions = {}): Promise<{ status: number; data: T }> {
  const response = await httpRequest(url, {
    ...options,
    method: options.method ?? 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...options.headers },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  let data: T;
  try {
    data = (text ? JSON.parse(text) : {}) as T;
  } catch {
    data = { raw: text } as T;
  }
  return { status: response.status, data };
}

export async function toDataUrl(url: string, mime = 'image/png'): Promise<string | null> {
  try {
    const buffer = await fetchBuffer(url, { retries: 1, timeoutMs: 15000 });
    return `data:${mime};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}
