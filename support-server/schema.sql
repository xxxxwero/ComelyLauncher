CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_provider TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  meta TEXT NOT NULL DEFAULT '{}',
  log TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  author_read_at INTEGER NOT NULL,
  admin_read_at INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS tickets_author ON tickets (author_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS tickets_status ON tickets (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id TEXT NOT NULL REFERENCES tickets (id) ON DELETE CASCADE,
  from_admin INTEGER NOT NULL,
  author_name TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS messages_ticket ON messages (ticket_id, id);

CREATE TABLE IF NOT EXISTS rate_events (
  key TEXT NOT NULL,
  at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS rate_events_key ON rate_events (key, at);

CREATE TABLE IF NOT EXISTS news (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  text TEXT NOT NULL,
  link TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS news_created ON news (created_at DESC);

CREATE TABLE IF NOT EXISTS hidden_news (
  news_id TEXT PRIMARY KEY,
  hidden_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS blocked_authors (
  author_id TEXT PRIMARY KEY,
  blocked_at INTEGER NOT NULL
);
