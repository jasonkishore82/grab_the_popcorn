// Accounts: handle + password, with a session cookie. Passwords are hashed with scrypt.
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { db, now } from './db.js';
import { HttpError, isHttps, parseCookies, serializeCookie } from './http.js';
import { resetEmail, sendMail, verifyEmail } from './email.js';

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
const selfUser = (u) => ({ ...publicUser(u), email: u.email ?? null, emailVerified: Boolean(u.email_verified) });

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateSignup({ handle, name, password, email }) {
  const h = String(handle ?? '').trim();
  const e = String(email ?? '').trim().toLowerCase();
  const n = String(name ?? '').trim();
  const p = String(password ?? '');
  if (!/^[A-Za-z0-9_]{3,20}$/.test(h)) throw new HttpError(400, 'Handle must be 3 to 20 letters, numbers or underscores');
  if (n.length < 1 || n.length > 40) throw new HttpError(400, 'Enter a display name (up to 40 characters)');
  if (p.length < 8 || p.length > 200) throw new HttpError(400, 'Password must be at least 8 characters');
  if (e.length > 254 || !EMAIL.test(e)) throw new HttpError(400, 'Enter a valid email address');
  return { handle: h, name: n, password: p, email: e };
}

function startSession(req, res, userId) {
  const token = randomBytes(32).toString('base64url');
  const t = now();
  db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(sha(token), userId, t, t + SESSION_MS);
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(t);
  res.setHeader('Set-Cookie', serializeCookie(COOKIE, token, { maxAge: SESSION_MS / 1000, secure: isHttps(req) }));
}

// ---- links sent by email (confirm address, reset password) ----
const HOUR = 3600 * 1000;

function createToken(userId, kind, ttl) {
  const token = randomBytes(32).toString('base64url');
  db.prepare('DELETE FROM email_tokens WHERE user_id = ? AND kind = ?').run(userId, kind);
  db.prepare('INSERT INTO email_tokens (token_hash, user_id, kind, expires_at) VALUES (?, ?, ?, ?)').run(sha(token), userId, kind, now() + ttl);
  return token;
}

function useToken(token, kind) {
  const row = db.prepare('SELECT * FROM email_tokens WHERE token_hash = ? AND kind = ? AND expires_at > ?').get(sha(String(token ?? '')), kind, now());
  if (!row) throw new HttpError(400, 'This link is invalid or has expired');
  db.prepare('DELETE FROM email_tokens WHERE token_hash = ?').run(row.token_hash);
  return row.user_id;
}

export const appUrl = (req) => (process.env.APP_URL || `${isHttps(req) ? 'https' : 'http'}://${req.headers.host}`).replace(/\/+$/, '');

async function sendVerification(req, user) {
  const url = `${appUrl(req)}/#/verify/${createToken(user.id, 'verify', 24 * HOUR)}`;
  const { html, text } = verifyEmail(user.name, url);
  await sendMail({ to: user.email, subject: 'Confirm your email for ClapBoxes', html, text });
}

export function register(req, res, input) {
  const { handle, name, password, email } = validateSignup(input);
  if (db.prepare('SELECT 1 FROM users WHERE handle = ?').get(handle)) throw new HttpError(409, 'That handle is taken');
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) throw new HttpError(409, 'That email is already registered');
  const info = db.prepare('INSERT INTO users (handle, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)').run(handle, name, email, hashPassword(password), now());
  const user = { id: Number(info.lastInsertRowid), handle, name, email, email_verified: 0 };
  startSession(req, res, user.id);
  sendVerification(req, user).catch((e) => console.error('[email]', e.message)); // never block sign-up on email
  return selfUser(user);
}

export async function resendVerification(req, user) {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  if (!row.email) throw new HttpError(400, 'Add an email address first');
  if (row.email_verified) return;
  await sendVerification(req, row);
}

export function verifyEmailToken(token) {
  db.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').run(useToken(token, 'verify'));
}

export async function forgotPassword(req, email) {
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email ?? '').trim().toLowerCase());
  if (!row) return; // the caller answers the same way either way, so addresses cannot be probed
  const url = `${appUrl(req)}/#/reset/${createToken(row.id, 'reset', HOUR)}`;
  const { html, text } = resetEmail(row.name, url);
  await sendMail({ to: row.email, subject: 'Reset your ClapBoxes password', html, text });
}

export function resetPassword(token, password) {
  const p = String(password ?? '');
  if (p.length < 8 || p.length > 200) throw new HttpError(400, 'Password must be at least 8 characters');
  const userId = useToken(token, 'reset');
  db.prepare('UPDATE users SET password_hash = ?, email_verified = 1 WHERE id = ?').run(hashPassword(p), userId); // reading the email proves the address
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId); // sign out everywhere
}

export function login(req, res, { handle, password }) {
  const row = db.prepare('SELECT * FROM users WHERE handle = ?').get(String(handle ?? '').trim());
  const ok = checkPassword(String(password ?? ''), row ? row.password_hash : DUMMY);
  if (!row || !ok) throw new HttpError(401, 'Wrong handle or password');
  startSession(req, res, row.id);
  return selfUser(row);
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
    .prepare('SELECT u.id, u.handle, u.name, u.email, u.email_verified FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?')
    .get(sha(token), now());
  return row ? selfUser(row) : null;
}

export function requireUser(req) {
  const user = currentUser(req);
  if (!user) throw new HttpError(401, 'Sign in first');
  return user;
}
