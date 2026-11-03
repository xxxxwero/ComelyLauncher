import { createChallenge, createGuest, readSession, verifyCertificate, verifyElyBy } from './auth';
import { ApiError, type Env } from './env';
import { createNews, deleteNews, hideNews, listNews } from './news';
import { addMessage, cleanUp, createTicket, listTickets, readLog, readTicket, setAuthorBlocked, setStatus, unreadCount } from './tickets';

const MAX_BODY_BYTES = 512 * 1024;
const NEWS_DELETE_PATH = /^\/v1\/news\/([0-9a-f-]{36})\/delete$/;
const TICKET_PATH = /^\/v1\/tickets\/([0-9a-f-]{36})(\/(messages|status|log|block))?$/;

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) throw new ApiError(413, 'too-large');
  try {
    const parsed: unknown = JSON.parse(raw || '{}');
    if (typeof parsed === 'object' && parsed !== null) return parsed as Record<string, unknown>;
  } catch {
    throw new ApiError(400, 'invalid-input');
  }
  throw new ApiError(400, 'invalid-input');
}

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;
  const { method } = request;

  if (pathname === '/v1/health') return json({ ok: true });
  if (method === 'GET' && pathname === '/v1/news') return json(await listNews(env));
  if (method === 'POST' && pathname === '/v1/auth/challenge') return json(await createChallenge(env));
  if (method === 'POST' && pathname === '/v1/auth/verify') {
    const body = await readBody(request);
    if (body.provider !== 'elyby') throw new ApiError(400, 'invalid-input');
    return json(await verifyElyBy(env, body.username, body.challenge));
  }
  if (method === 'POST' && pathname === '/v1/auth/certificate') return json(await verifyCertificate(env, await readBody(request)));
  if (method === 'POST' && pathname === '/v1/auth/guest') {
    const body = await readBody(request);
    return json(await createGuest(env, body.deviceSecret, body.name));
  }

  const session = await readSession(env, request);
  if (method === 'POST' && pathname === '/v1/news') return json(await createNews(env, session, await readBody(request)), 201);
  if (method === 'POST' && pathname === '/v1/news/hide') {
    await hideNews(env, session, await readBody(request));
    return json({ ok: true });
  }
  const newsDelete = method === 'POST' ? NEWS_DELETE_PATH.exec(pathname) : null;
  if (newsDelete) {
    await deleteNews(env, session, newsDelete[1]);
    return json({ ok: true });
  }
  if (method === 'GET' && pathname === '/v1/unread') return json({ count: await unreadCount(env, session) });
  if (method === 'GET' && pathname === '/v1/tickets') return json(await listTickets(env, session, url.searchParams.get('status')));
  if (method === 'POST' && pathname === '/v1/tickets') return json(await createTicket(env, session, request, await readBody(request)), 201);

  const match = TICKET_PATH.exec(pathname);
  if (!match) throw new ApiError(404, 'not-found');
  const ticketId = match[1];
  const action = match[3];
  if (method === 'GET' && !action) return json(await readTicket(env, session, ticketId));
  if (method === 'GET' && action === 'log') return json({ log: await readLog(env, session, ticketId) });
  if (method === 'POST' && action === 'messages') return json(await addMessage(env, session, ticketId, await readBody(request)));
  if (method === 'POST' && action === 'status') return json(await setStatus(env, session, ticketId, await readBody(request)));
  if (method === 'POST' && action === 'block') return json(await setAuthorBlocked(env, session, ticketId, await readBody(request)));
  throw new ApiError(404, 'not-found');
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await route(request, env);
    } catch (error) {
      if (error instanceof ApiError) return json({ error: error.code }, error.status);
      console.error(error instanceof Error ? error.message : String(error));
      return json({ error: 'server-error' }, 500);
    }
  },
  async scheduled(_event: unknown, env: Env): Promise<void> {
    await cleanUp(env);
  }
};
