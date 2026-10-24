// Small HTTP helpers shared by the API routes.

export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export function json(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(body));
}

export async function readJson(req, limit = 100_000) {
  const type = req.headers['content-type'] || '';
  if (!type.includes('application/json')) throw new HttpError(415, 'Send JSON');
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > limit) throw new HttpError(413, 'Request too large');
  }
  try {
    const data = JSON.parse(body || '{}');
    if (data === null || typeof data !== 'object' || Array.isArray(data)) throw new Error('not an object');
    return data;
  } catch {
    throw new HttpError(400, 'Invalid JSON');
  }
}

export function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function serializeCookie(name, value, { maxAge, secure }) {
  return [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
    secure ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');
}

// Behind a reverse proxy, set TRUST_PROXY=1 so the real client address and protocol are used.
const trustProxy = () => process.env.TRUST_PROXY === '1';

export const clientIp = (req) =>
  (trustProxy() && req.headers['x-forwarded-for']?.split(',')[0].trim()) || req.socket.remoteAddress || 'unknown';

export const isHttps = (req) => Boolean(req.socket.encrypted) || (trustProxy() && req.headers['x-forwarded-proto'] === 'https');

// Browsers send Origin on cross-site writes; refuse the ones that do not come from this site.
export function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

// In-memory limiter: at most `max` hits per `windowMs` for each key.
export function limiter(max, windowMs) {
  const hits = new Map();
  return (key) => {
    const t = Date.now();
    if (hits.size > 5000) for (const [k, v] of hits) if (v.resetAt < t) hits.delete(k);
    const cur = hits.get(key);
    if (!cur || cur.resetAt < t) {
      hits.set(key, { count: 1, resetAt: t + windowMs });
      return true;
    }
    cur.count += 1;
    return cur.count <= max;
  };
}
