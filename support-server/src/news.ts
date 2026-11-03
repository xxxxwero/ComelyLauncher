import { ApiError, type Env, type Session } from './env';

const MAX_TITLE_LENGTH = 120;
const MAX_TEXT_LENGTH = 4000;
const MAX_LINK_LENGTH = 500;
const MAX_HIDDEN_ID_LENGTH = 128;
const LIST_LIMIT = 30;
const WEB_LINK = /^https?:\/\/\S+$/i;

interface NewsRow {
  id: string;
  title: string;
  text: string;
  link: string | null;
  created_at: number;
}

function ensureAdmin(session: Session): void {
  if (!session.admin) throw new ApiError(403, 'forbidden');
}

function text(value: unknown, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim()) throw new ApiError(400, 'invalid-input');
  return value.trim().slice(0, maxLength);
}

function toItem(row: NewsRow): Record<string, unknown> {
  return { id: row.id, title: row.title, text: row.text, link: row.link, createdAt: row.created_at };
}

export async function listNews(env: Env): Promise<Record<string, unknown>> {
  const [items, hidden] = await Promise.all([
    env.DB.prepare('SELECT id, title, text, link, created_at FROM news ORDER BY created_at DESC LIMIT ?').bind(LIST_LIMIT).all<NewsRow>(),
    env.DB.prepare('SELECT news_id FROM hidden_news').all<{ news_id: string }>()
  ]);
  return { items: items.results.map(toItem), hiddenIds: hidden.results.map((row) => row.news_id) };
}

export async function createNews(env: Env, session: Session, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  ensureAdmin(session);
  const link = typeof body.link === 'string' && body.link.trim() ? body.link.trim() : null;
  if (link && (link.length > MAX_LINK_LENGTH || !WEB_LINK.test(link))) throw new ApiError(400, 'invalid-input');
  const row: NewsRow = { id: crypto.randomUUID(), title: text(body.title, MAX_TITLE_LENGTH), text: text(body.text, MAX_TEXT_LENGTH), link, created_at: Date.now() };
  await env.DB.prepare('INSERT INTO news (id, title, text, link, created_at) VALUES (?, ?, ?, ?, ?)').bind(row.id, row.title, row.text, row.link, row.created_at).run();
  return toItem(row);
}

export async function deleteNews(env: Env, session: Session, newsId: string): Promise<void> {
  ensureAdmin(session);
  await env.DB.prepare('DELETE FROM news WHERE id = ?').bind(newsId).run();
}

export async function hideNews(env: Env, session: Session, body: Record<string, unknown>): Promise<void> {
  ensureAdmin(session);
  const newsId = text(body.id, MAX_HIDDEN_ID_LENGTH);
  await env.DB.prepare('INSERT OR REPLACE INTO hidden_news (news_id, hidden_at) VALUES (?, ?)').bind(newsId, Date.now()).run();
}
