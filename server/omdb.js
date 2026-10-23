// OMDb proxy: adds the API key on the server so it never reaches the browser.
// https://www.omdbapi.com/  (GET /?apikey=...&i=imdbID | t=title&y=year | s=search&page=n)
import './env.js';

const BASE = process.env.OMDB_BASE_URL || 'https://www.omdbapi.com/';
const ALLOWED = new Set(['i', 't', 's', 'y', 'type', 'page', 'plot']);
const TTL = 24 * 60 * 60 * 1000;
const MAX_CACHE = 500;
const cache = new Map(); // query string -> { at, body }

const send = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
};

export async function handleOmdb(req, res) {
  if (req.method !== 'GET') return send(res, 405, { Response: 'False', Error: 'Method not allowed' });

  const key = process.env.OMDB_API_KEY;
  if (!key) {
    return send(res, 503, { Response: 'False', Error: 'OMDB_API_KEY is not set on the server. Add it to .env and restart.' });
  }

  // Only pass through known parameters, each trimmed and length-limited.
  const incoming = new URL(req.url, 'http://x').searchParams;
  const params = new URLSearchParams();
  for (const name of [...ALLOWED].sort()) {
    const v = incoming.get(name);
    if (v && v.trim()) params.set(name, v.trim().slice(0, 120));
  }
  if (!params.has('i') && !params.has('t') && !params.has('s')) {
    return send(res, 400, { Response: 'False', Error: 'Provide i, t or s' });
  }

  const cacheKey = params.toString();
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL) return send(res, 200, hit.body);

  try {
    const upstream = await fetch(`${BASE}?${params}&apikey=${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(8000) });
    const body = await upstream.json();

    // OMDb answers 401 for a bad key or when the daily limit is reached.
    if (upstream.status === 401) {
      return send(res, 401, { Response: 'False', Error: body?.Error || 'OMDb rejected the API key' });
    }
    if (!upstream.ok) return send(res, 502, { Response: 'False', Error: 'OMDb is unavailable right now' });

    // "Movie not found!" and friends are valid answers worth caching too.
    if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
    cache.set(cacheKey, { at: Date.now(), body });
    return send(res, 200, body);
  } catch (err) {
    console.error('[omdb]', err?.name, err?.message);
    return send(res, 502, { Response: 'False', Error: 'Could not reach OMDb' });
  }
}
