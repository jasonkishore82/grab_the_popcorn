// Accounts: handle + password, with a session cookie. Passwords are hashed with scrypt.
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { db, now } from './db.js';
import { HttpError, isHttps, parseCookies, serializeCookie } from './http.js';

const COOKIE = 'popcorn_sid';
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const sha = (s) => createHash('sha256').update(s).digest('hex');

function hashPassword(password) {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString('hex')}$${scryptSync(password, salt, 64).toString('hex')}`;
}

function checkPassword(password, stored) {
  const [scheme, saltHex, hashHex] = String(stored).split('$');
  if (scheme !== 'scrypt') return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(actual, expected);
}

const DUMMY = hashPassword('not-a-real-password'); // so unknown handles cost the same time as wrong passwords

export const publicUser = (u) => ({ id: u.id, handle: u.handle, name: u.name });

export function validateSignup({ handle, name, password }) {
  const h = String(handle ?? '').trim();
  const n = String(name ?? '').trim();
  const p = String(password ?? '');
  if (!/^[A-Za-z0-9_]{3,20}$/.test(h)) throw new HttpError(400, 'Handle must be 3 to 20 letters, numbers or underscores');
  if (n.length < 1 || n.length > 40) throw new HttpError(400, 'Enter a display name (up to 40 characters)');
  if (p.length < 8 || p.length > 200) throw new HttpError(400, 'Password must be at least 8 characters');
  return { handle: h, name: n, password: p };
}

function startSession(req, res, userId) {
  const token = randomBytes(32).toString('base64url');
  const t = now();
  db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(sha(token), userId, t, t + SESSION_MS);
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(t);
  res.setHeader('Set-Cookie', serializeCookie(COOKIE, token, { maxAge: SESSION_MS / 1000, secure: isHttps(req) }));
}

export function register(req, res, input) {
  const { handle, name, password } = validateSignup(input);
  if (db.prepare('SELECT 1 FROM users WHERE handle = ?').get(handle)) throw new HttpError(409, 'That handle is taken');
  const info = db.prepare('INSERT INTO users (handle, name, password_hash, created_at) VALUES (?, ?, ?, ?)').run(handle, name, hashPassword(password), now());
  const user = { id: Number(info.lastInsertRowid), handle, name };
  startSession(req, res, user.id);
  return user;
}

export function login(req, res, { handle, password }) {
  const row = db.prepare('SELECT * FROM users WHERE handle = ?').get(String(handle ?? '').trim());
  const ok = checkPassword(String(password ?? ''), row ? row.password_hash : DUMMY);
  if (!row || !ok) throw new HttpError(401, 'Wrong handle or password');
  startSession(req, res, row.id);
  return publicUser(row);
}

export function logout(req, res) {
  const token = parseCookies(req)[COOKIE];
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha(token));
  res.setHeader('Set-Cookie', serializeCookie(COOKIE, '', { maxAge: 0, secure: isHttps(req) }));
}

export function currentUser(req) {
  const token = parseCookies(req)[COOKIE];
  if (!token) return null;
  const row = db
    .prepare('SELECT u.id, u.handle, u.name FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?')
    .get(sha(token), now());
  return row ? publicUser(row) : null;
}

export function requireUser(req) {
  const user = currentUser(req);
  if (!user) throw new HttpError(401, 'Sign in first');
  return user;
}
