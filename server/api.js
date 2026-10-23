// All API routes (mounted at /api). One shared database serves every user.
import { HttpError, clientIp, json, limiter, readJson, sameOrigin } from './http.js';
import { currentUser, login, logout, register, requireUser } from './auth.js';
import { catalog, deleteEntry, getTitleFull, idAliases, libraryFor, pruneOldSearches, putEntry, search, seedStarterTitles, warmStarterTitles } from './titles.js';
import { handleLuna } from './luna.js';
import { omdbConfigured } from './omdb.js';

seedStarterTitles();

const authLimit = limiter(12, 10 * 60 * 1000); // sign-in and sign-up attempts per address
const omdbSearchLimit = limiter(30, 10 * 60 * 1000); // lookups that would spend OMDb requests, per address
const lunaLimit = limiter(30, 10 * 60 * 1000); // questions per user

export const startBackgroundWork = () => {
  pruneOldSearches();
  warmStarterTitles().catch((e) => console.error('[warm]', e?.message));
};

const KINDS = new Set(['all', 'movie', 'show']);

export async function handleApi(req, res) {
  try {
    const url = new URL(req.url, 'http://x');
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const method = req.method;
    if (method !== 'GET' && !sameOrigin(req)) throw new HttpError(403, 'Cross-site request blocked');
    const q = url.searchParams;
    let m;

    if (method === 'GET' && path === '/health') return json(res, 200, { ok: true, omdb: omdbConfigured() });

    // --- accounts ---
    if (path === '/auth/register' && method === 'POST') {
      if (!authLimit(clientIp(req))) throw new HttpError(429, 'Too many attempts. Try again in a few minutes.');
      return json(res, 201, { user: register(req, res, await readJson(req)) });
    }
    if (path === '/auth/login' && method === 'POST') {
      if (!authLimit(clientIp(req))) throw new HttpError(429, 'Too many attempts. Try again in a few minutes.');
      return json(res, 200, { user: login(req, res, await readJson(req)) });
    }
    if (path === '/auth/logout' && method === 'POST') {
      logout(req, res);
      return json(res, 200, { ok: true });
    }
    if (path === '/auth/me' && method === 'GET') return json(res, 200, { user: currentUser(req), omdb: omdbConfigured() });

    // --- the shared catalogue (anyone can read) ---
    if (path === '/catalog' && method === 'GET') {
      return json(res, 200, { titles: catalog(Number(q.get('limit')) || 200, Number(q.get('offset')) || 0), aliases: idAliases(), omdb: omdbConfigured() });
    }
    if (path === '/search' && method === 'GET') {
      const kind = q.get('kind') || 'all';
      if (!KINDS.has(kind)) throw new HttpError(400, 'kind must be all, movie or show');
      const user = currentUser(req);
      const allowOmdb = omdbSearchLimit(user ? `u${user.id}` : clientIp(req));
      return json(res, 200, await search(q.get('q') || '', kind, { userId: user?.id ?? null, allowOmdb }));
    }
    if ((m = path.match(/^\/titles\/([A-Za-z0-9]+)$/)) && method === 'GET') {
      return json(res, 200, { ...(await getTitleFull(m[1], currentUser(req))), requestedId: m[1] });
    }

    // --- your own entries: watchlist, watched, rating, comment ---
    if ((m = path.match(/^\/titles\/([A-Za-z0-9]+)\/entry$/))) {
      const user = requireUser(req);
      if (method === 'PUT') return json(res, 200, putEntry(user.id, m[1], await readJson(req)));
      if (method === 'DELETE') return json(res, 200, deleteEntry(user.id, m[1]));
    }
    if (path === '/me/library' && method === 'GET') return json(res, 200, { entries: libraryFor(requireUser(req).id) });

    // --- Luna (signed-in users only, so strangers cannot spend the AI budget) ---
    if (path === '/luna' && method === 'POST') {
      const user = requireUser(req);
      if (!lunaLimit(`u${user.id}`)) throw new HttpError(429, 'Luna needs a short break. Try again in a few minutes.');
      return handleLuna(req, res);
    }

    throw new HttpError(404, 'Not found');
  } catch (e) {
    if (e instanceof HttpError) return json(res, e.status, { error: e.message, ...e.extra });
    console.error('[api]', req.method, req.url?.split('?')[0], e);
    return json(res, 500, { error: 'Something went wrong' });
  }
}
