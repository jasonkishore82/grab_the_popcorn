"""The shared database (SQLite). One file holds every user's data.

The file and schema are the same ones the old Node server used, so existing data carries over.
"""
import os
import sqlite3
import threading
import time
from contextlib import contextmanager

from .config import ROOT

DB_FILE = (ROOT / os.environ.get("DATABASE_FILE", "data/popcorn.db")).resolve()
DB_FILE.parent.mkdir(parents=True, exist_ok=True)

_local = threading.local()


def now():
    return int(time.time() * 1000)


def _connect():
    c = sqlite3.connect(DB_FILE, isolation_level=None, check_same_thread=False, timeout=5)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA journal_mode = WAL")
    c.execute("PRAGMA foreign_keys = ON")
    c.execute("PRAGMA busy_timeout = 5000")
    return c


def conn():
    c = getattr(_local, "conn", None)
    if c is None:
        c = _local.conn = _connect()
    return c


def one(sql, *args):
    row = conn().execute(sql, args).fetchone()
    return dict(row) if row else None


def many(sql, *args):
    return [dict(r) for r in conn().execute(sql, args).fetchall()]


def run(sql, *args):
    return conn().execute(sql, args)


def scalar(sql, *args):
    row = conn().execute(sql, args).fetchone()
    return row[0] if row else None


@contextmanager
def tx():
    c = conn()
    c.execute("BEGIN IMMEDIATE")
    try:
        yield
        c.execute("COMMIT")
    except BaseException:
        c.execute("ROLLBACK")
        raise


SCHEMA = """
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
  id           TEXT PRIMARY KEY,
  kind         TEXT NOT NULL CHECK (kind IN ('movie', 'show')),
  title        TEXT NOT NULL,
  year         INTEGER,
  poster       TEXT,
  plot         TEXT,
  rated        TEXT,
  released     TEXT,
  runtime      INTEGER,
  genres       TEXT NOT NULL DEFAULT '[]',
  director     TEXT,
  writer       TEXT,
  actors       TEXT NOT NULL DEFAULT '[]',
  language     TEXT,
  country      TEXT,
  awards       TEXT,
  rt           INTEGER,
  imdb         REAL,
  imdb_votes   TEXT,
  meta         INTEGER,
  seasons      INTEGER,
  detail_level INTEGER NOT NULL DEFAULT 0,
  seeded       INTEGER NOT NULL DEFAULT 0,
  created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   INTEGER NOT NULL,
  fetched_at   INTEGER
);
CREATE INDEX IF NOT EXISTS titles_by_name ON titles (title COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS id_aliases (
  old_id TEXT PRIMARY KEY,
  new_id TEXT NOT NULL
);

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

CREATE TABLE IF NOT EXISTS library_entries (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title_id   TEXT    NOT NULL REFERENCES titles(id) ON DELETE CASCADE ON UPDATE CASCADE,
  status     TEXT    NOT NULL CHECK (status IN ('watchlist', 'watched')),
  rating     INTEGER CHECK (rating BETWEEN 1 AND 5),
  review     TEXT,
  added_at   INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, title_id)
);
CREATE INDEX IF NOT EXISTS library_by_title ON library_entries (title_id, updated_at DESC);
"""

SCHEMA_2 = """
CREATE UNIQUE INDEX IF NOT EXISTS users_by_email ON users (email COLLATE NOCASE) WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS email_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK (kind IN ('verify', 'reset')),
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS friendships (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status     TEXT NOT NULL CHECK (status IN ('pending', 'accepted')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, friend_id),
  CHECK (user_id <> friend_id)
);
CREATE INDEX IF NOT EXISTS friendships_by_friend ON friendships (friend_id);

CREATE TABLE IF NOT EXISTS dome_members (
  owner_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  added_at  INTEGER NOT NULL,
  PRIMARY KEY (owner_id, member_id),
  CHECK (owner_id <> member_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body         TEXT NOT NULL,
  title_id     TEXT REFERENCES titles(id) ON DELETE SET NULL ON UPDATE CASCADE,
  created_at   INTEGER NOT NULL,
  read_at      INTEGER
);
CREATE INDEX IF NOT EXISTS messages_pair ON messages (sender_id, recipient_id, id);
CREATE INDEX IF NOT EXISTS messages_inbox ON messages (recipient_id, read_at);
"""


def _columns(table):
    return [r["name"] for r in many(f"PRAGMA table_info({table})")]


def init():
    c = conn()
    c.executescript(SCHEMA)
    # Later additions (safe to run on an existing database)
    if "email" not in _columns("users"):
        c.execute("ALTER TABLE users ADD COLUMN email TEXT")
        c.execute("ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0")
    if "times_watched" not in _columns("library_entries"):
        c.execute("ALTER TABLE library_entries ADD COLUMN times_watched INTEGER NOT NULL DEFAULT 1")
    if "bio" not in _columns("users"):
        c.execute("ALTER TABLE users ADD COLUMN bio TEXT")
        c.execute("ALTER TABLE users ADD COLUMN avatar TEXT")
    c.executescript(SCHEMA_2)
