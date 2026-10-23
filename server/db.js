// The shared database (SQLite, built into Node). One file holds every user's data.
import './env.js';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const root = fileURLToPath(new URL('..', import.meta.url));
export const DB_FILE = resolve(root, process.env.DATABASE_FILE || 'data/popcorn.db');
mkdirSync(dirname(DB_FILE), { recursive: true });

export const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  handle        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_by_user ON sessions (user_id);

-- Every title anyone has searched for or opened, stored once for everybody.
CREATE TABLE IF NOT EXISTS titles (
  id           TEXT PRIMARY KEY,                       -- IMDb id, e.g. tt0816692
  kind         TEXT NOT NULL CHECK (kind IN ('movie', 'show')),
  title        TEXT NOT NULL,
  year         INTEGER,
  poster       TEXT,
  plot         TEXT,
  rated        TEXT,
  released     TEXT,
  runtime      INTEGER,                                -- minutes (per episode for shows)
  genres       TEXT NOT NULL DEFAULT '[]',
  director     TEXT,
  writer       TEXT,
  actors       TEXT NOT NULL DEFAULT '[]',
  language     TEXT,
  country      TEXT,
  awards       TEXT,
  rt           INTEGER,                                -- Rotten Tomatoes critics %
  imdb         REAL,
  imdb_votes   TEXT,
  meta         INTEGER,
  seasons      INTEGER,
  detail_level INTEGER NOT NULL DEFAULT 0,             -- 0 = basic (search result / seed), 1 = full OMDb details
  seeded       INTEGER NOT NULL DEFAULT 0,             -- 1 = one of the built-in starter titles
  created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   INTEGER NOT NULL,
  fetched_at   INTEGER
);
CREATE INDEX IF NOT EXISTS titles_by_name ON titles (title COLLATE NOCASE);

-- If a starter title's IMDb id turned out to be wrong, remember where it moved.
CREATE TABLE IF NOT EXISTS id_aliases (
  old_id TEXT PRIMARY KEY,
  new_id TEXT NOT NULL
);

-- Which searches we have already answered, so the next person's identical search needs no OMDb call.
CREATE TABLE IF NOT EXISTS search_cache (
  query       TEXT NOT NULL,
  kind        TEXT NOT NULL,
  page        INTEGER NOT NULL DEFAULT 1,
  ids         TEXT NOT NULL,
  total       INTEGER NOT NULL DEFAULT 0,
  fetched_at  INTEGER NOT NULL,
  searched_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  hits        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (query, kind, page)
);

-- Everyone's watchlist, watched list, star rating and comment. Ratings and comments are public.
CREATE TABLE IF NOT EXISTS library_entries (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title_id   TEXT    NOT NULL REFERENCES titles(id) ON DELETE CASCADE ON UPDATE CASCADE,
  status     TEXT    NOT NULL CHECK (status IN ('watchlist', 'watched')),
  rating     INTEGER CHECK (rating BETWEEN 1 AND 5),   -- NULL = not rated
  review     TEXT,                                     -- NULL = no comment
  added_at   INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, title_id)
);
CREATE INDEX IF NOT EXISTS library_by_title ON library_entries (title_id, updated_at DESC);
`);

export const now = () => Date.now();

export function tx(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
