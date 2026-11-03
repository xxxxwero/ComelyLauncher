import { sha256 } from './auth';
import { ApiError, type Env, type Session } from './env';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const MAX_SUBJECT_LENGTH = 120;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_LOG_LENGTH = 300 * 1024;
const MAX_META_LENGTH = 2000;
const LIST_LIMIT = 100;
const LOG_RETENTION_MS = 90 * DAY_MS;

const TICKET_LIMITS = { offline: 3, verified: 10, perAddress: 8 };
const MESSAGE_LIMITS = { offline: 20, verified: 60 };

interface TicketRow {
  id: string;
  author_id: string;
  author_name: string;
  author_provider: string;
  subject: string;
  status: string;
  meta: string;
  has_log: number;
  created_at: number;
  updated_at: number;
  author_read_at: number;
  admin_read_at: number;
  last_from_admin: number | null;
  author_blocked: number;
}

const TICKET_COLUMNS = `t.id, t.author_id, t.author_name, t.author_provider, t.subject, t.status, t.meta, t.log IS NOT NULL AS has_log,
  t.created_at, t.updated_at, t.author_read_at, t.admin_read_at,
  (SELECT from_admin FROM messages m WHERE m.ticket_id = t.id ORDER BY m.id DESC LIMIT 1) AS last_from_admin,
  EXISTS (SELECT 1 FROM blocked_authors b WHERE b.author_id = t.author_id) AS author_blocked`;

function text(value: unknown, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim()) throw new ApiError(400, 'invalid-input');
  return value.trim().slice(0, maxLength);
}

function toTicket(row: TicketRow, session: Session): Record<string, unknown> {
  const readAt = session.admin ? row.admin_read_at : row.author_read_at;
  const waitingForReader = session.admin ? row.last_from_admin === 0 : row.last_from_admin === 1;
  return {
    id: row.id,
    authorName: row.author_name,
    authorProvider: row.author_provider,
    subject: row.subject,
    status: row.status,
    hasLog: row.has_log === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    unread: waitingForReader && row.updated_at > readAt,
    authorBlocked: session.admin ? row.author_blocked === 1 : false
  };
}

async function ensureNotBlocked(env: Env, session: Session): Promise<void> {
  const row = await env.DB.prepare('SELECT 1 AS found FROM blocked_authors WHERE author_id = ?').bind(session.sub).first();
  if (row) throw new ApiError(403, 'blocked');
}

async function consume(env: Env, key: string, limit: number, windowMs: number): Promise<void> {
  const now = Date.now();
  const row = await env.DB.prepare('SELECT COUNT(*) AS count FROM rate_events WHERE key = ? AND at > ?').bind(key, now - windowMs).first<{ count: number }>();
  if ((row?.count ?? 0) >= limit) throw new ApiError(429, 'rate-limited');
  await env.DB.prepare('INSERT INTO rate_events (key, at) VALUES (?, ?)').bind(key, now).run();
}

async function loadTicket(env: Env, session: Session, ticketId: string): Promise<TicketRow> {
  const row = await env.DB.prepare(`SELECT ${TICKET_COLUMNS} FROM tickets t WHERE t.id = ?`).bind(ticketId).first<TicketRow>();
  if (!row || (!session.admin && row.author_id !== session.sub)) throw new ApiError(404, 'not-found');
  return row;
}

export async function listTickets(env: Env, session: Session, status: string | null): Promise<Record<string, unknown>[]> {
  const wanted = status === 'closed' ? 'closed' : 'open';
  const query = session.admin
    ? env.DB.prepare(`SELECT ${TICKET_COLUMNS} FROM tickets t WHERE t.status = ? ORDER BY t.updated_at DESC LIMIT ?`).bind(wanted, LIST_LIMIT)
    : env.DB.prepare(`SELECT ${TICKET_COLUMNS} FROM tickets t WHERE t.author_id = ? AND t.status = ? ORDER BY t.updated_at DESC LIMIT ?`).bind(session.sub, wanted, LIST_LIMIT);
  const { results } = await query.all<TicketRow>();
  return results.map((row) => toTicket(row, session));
}

export async function unreadCount(env: Env, session: Session): Promise<number> {
  const scope = session.admin ? "t.status = 'open' AND t.updated_at > t.admin_read_at" : 't.author_id = ? AND t.updated_at > t.author_read_at';
  const sender = session.admin ? 0 : 1;
  const sql = `SELECT COUNT(*) AS count FROM tickets t WHERE ${scope} AND (SELECT from_admin FROM messages m WHERE m.ticket_id = t.id ORDER BY m.id DESC LIMIT 1) = ${sender}`;
  const statement = session.admin ? env.DB.prepare(sql) : env.DB.prepare(sql).bind(session.sub);
  return (await statement.first<{ count: number }>())?.count ?? 0;
}

export async function createTicket(env: Env, session: Session, request: Request, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  await ensureNotBlocked(env, session);
  const subject = text(body.subject, MAX_SUBJECT_LENGTH);
  const message = text(body.message, MAX_MESSAGE_LENGTH);
  const log = typeof body.log === 'string' && body.log ? body.log.slice(-MAX_LOG_LENGTH) : null;
  const meta = JSON.stringify(typeof body.meta === 'object' && body.meta ? body.meta : {}).slice(0, MAX_META_LENGTH);
  if (!session.admin) {
    const verified = session.provider !== 'offline';
    await consume(env, `ticket:${session.sub}`, verified ? TICKET_LIMITS.verified : TICKET_LIMITS.offline, DAY_MS);
    const address = await sha256(`${env.SESSION_SECRET}.${request.headers.get('CF-Connecting-IP') ?? 'unknown'}`);
    await consume(env, `address:${address}`, TICKET_LIMITS.perAddress, DAY_MS);
  }
  const id = crypto.randomUUID();
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO tickets (id, author_id, author_name, author_provider, subject, meta, log, created_at, updated_at, author_read_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, session.sub, session.name, session.provider, subject, meta, log, now, now, now),
    env.DB.prepare('INSERT INTO messages (ticket_id, from_admin, author_name, text, created_at) VALUES (?, ?, ?, ?, ?)').bind(id, session.admin ? 1 : 0, session.name, message, now)
  ]);
  return toTicket(await loadTicket(env, session, id), session);
}

export async function readTicket(env: Env, session: Session, ticketId: string): Promise<Record<string, unknown>> {
  const row = await loadTicket(env, session, ticketId);
  const { results } = await env.DB.prepare('SELECT id, from_admin, author_name, text, created_at FROM messages WHERE ticket_id = ? ORDER BY id')
    .bind(ticketId)
    .all<{ id: number; from_admin: number; author_name: string; text: string; created_at: number }>();
  const column = session.admin ? 'admin_read_at' : 'author_read_at';
  await env.DB.prepare(`UPDATE tickets SET ${column} = ? WHERE id = ?`).bind(Date.now(), ticketId).run();
  return {
    ticket: { ...toTicket(row, session), unread: false },
    meta: session.admin ? JSON.parse(row.meta) : {},
    messages: results.map((message) => ({ id: message.id, fromAdmin: message.from_admin === 1, authorName: message.author_name, text: message.text, createdAt: message.created_at }))
  };
}

export async function addMessage(env: Env, session: Session, ticketId: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  await ensureNotBlocked(env, session);
  const row = await loadTicket(env, session, ticketId);
  if (row.status === 'closed' && !session.admin) throw new ApiError(409, 'ticket-closed');
  const message = text(body.text, MAX_MESSAGE_LENGTH);
  if (!session.admin) await consume(env, `message:${session.sub}`, session.provider === 'offline' ? MESSAGE_LIMITS.offline : MESSAGE_LIMITS.verified, HOUR_MS);
  const now = Date.now();
  const column = session.admin ? 'admin_read_at' : 'author_read_at';
  await env.DB.batch([
    env.DB.prepare('INSERT INTO messages (ticket_id, from_admin, author_name, text, created_at) VALUES (?, ?, ?, ?, ?)').bind(ticketId, session.admin ? 1 : 0, session.name, message, now),
    env.DB.prepare(`UPDATE tickets SET updated_at = ?, ${column} = ? WHERE id = ?`).bind(now, now, ticketId)
  ]);
  return readTicket(env, session, ticketId);
}

export async function setStatus(env: Env, session: Session, ticketId: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  await loadTicket(env, session, ticketId);
  if (body.status !== 'open' && body.status !== 'closed') throw new ApiError(400, 'invalid-input');
  if (body.status === 'open' && !session.admin) throw new ApiError(403, 'forbidden');
  await env.DB.prepare('UPDATE tickets SET status = ? WHERE id = ?').bind(body.status, ticketId).run();
  return readTicket(env, session, ticketId);
}

export async function readLog(env: Env, session: Session, ticketId: string): Promise<string> {
  await loadTicket(env, session, ticketId);
  const row = await env.DB.prepare('SELECT log FROM tickets WHERE id = ?').bind(ticketId).first<{ log: string | null }>();
  if (!row?.log) throw new ApiError(404, 'not-found');
  return row.log;
}

export async function setAuthorBlocked(env: Env, session: Session, ticketId: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!session.admin) throw new ApiError(403, 'forbidden');
  const row = await loadTicket(env, session, ticketId);
  if (body.blocked === true) await env.DB.prepare('INSERT OR REPLACE INTO blocked_authors (author_id, blocked_at) VALUES (?, ?)').bind(row.author_id, Date.now()).run();
  else await env.DB.prepare('DELETE FROM blocked_authors WHERE author_id = ?').bind(row.author_id).run();
  return readTicket(env, session, ticketId);
}

export async function cleanUp(env: Env): Promise<void> {
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM rate_events WHERE at < ?').bind(now - 2 * DAY_MS),
    env.DB.prepare('UPDATE tickets SET log = NULL WHERE log IS NOT NULL AND updated_at < ?').bind(now - LOG_RETENTION_MS)
  ]);
}
