// All API routes (mounted at /api). One shared database serves every user.
import { HttpError, clientIp, json, limiter, readJson, sameOrigin } from './http.js';
import { currentUser, forgotPassword, login, logout, register, requireUser, resendVerification, resetPassword, verifyEmailToken } from './auth.js';
import { addFriend, conversations, listFriends, messagesWith, profile, removeFriend, searchPeople, sendMessage, updateProfile } from './social.js';
import { emailConfigured } from './email.js';
import { catalog, deleteEntry, getTitleFull, idAliases, libraryFor, pruneOldSearches, putEntry, search, seedStarterTitles, warmStarterTitles } from './titles.js';
import { omdbConfigured } from './omdb.js';

seedStarterTitles();

const authLimit = limiter(12, 10 * 60 * 1000); // sign-in and sign-up attempts per address
const omdbSearchLimit = limiter(30, 10 * 60 * 1000); // lookups that would spend OMDb requests, per address
const chatLimit = limiter(60, 60 * 1000); // messages per user per minute
const peopleLimit = limiter(60, 60 * 1000);
const resendLimit = limiter(3, 60 * 60 * 1000);

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
    if (path === '/auth/me' && method === 'GET') return json(res, 200, { user: currentUser(req), omdb: omdbConfigured(), email: emailConfigured() });
    if (path === '/auth/verify' && method === 'POST') {
      verifyEmailToken((await readJson(req)).token);
      return json(res, 200, { ok: true });
    }
    if (path === '/auth/forgot' && method === 'POST') {
      if (!authLimit(clientIp(req))) throw new HttpError(429, 'Too many attempts. Try again in a few minutes.');
      await forgotPassword(req, (await readJson(req)).email).catch((e) => console.error('[email]', e.message));
      return json(res, 200, { ok: true }); // same answer whether or not the address exists
    }
    if (path === '/auth/reset' && method === 'POST') {
      if (!authLimit(clientIp(req))) throw new HttpError(429, 'Too many attempts. Try again in a few minutes.');
      const body = await readJson(req);
      resetPassword(body.token, body.password);
      return json(res, 200, { ok: true });
    }
    if (path === '/auth/resend' && method === 'POST') {
      const user = requireUser(req);
      if (!resendLimit(`u${user.id}`)) throw new HttpError(429, 'Please wait before asking for another email');
      await resendVerification(req, user);
      return json(res, 200, { ok: true });
    }

    // --- people, friends, chat ---
    if (path === '/users' && method === 'GET') {
      if (!peopleLimit(clientIp(req))) throw new HttpError(429, 'Slow down a little');
      return json(res, 200, { people: searchPeople(currentUser(req), q.get('q')) });
    }
    if ((m = path.match(/^\/users\/([A-Za-z0-9_]{3,20})$/)) && method === 'GET') return json(res, 200, profile(currentUser(req), m[1]));
    if (path === '/me/profile' && method === 'PUT') return json(res, 200, updateProfile(requireUser(req).id, await readJson(req, 300_000)));
    if (path === '/friends' && method === 'GET') return json(res, 200, listFriends(requireUser(req).id));
    if ((m = path.match(/^\/friends\/([A-Za-z0-9_]{3,20})$/))) {
      const user = requireUser(req);
      if (method === 'POST') return json(res, 200, addFriend(user.id, m[1]));
      if (method === 'DELETE') return json(res, 200, removeFriend(user.id, m[1]));
    }
    if (path === '/chats' && method === 'GET') return json(res, 200, conversations(requireUser(req).id));
    if ((m = path.match(/^\/chats\/([A-Za-z0-9_]{3,20})$/))) {
      const user = requireUser(req);
      if (method === 'GET') return json(res, 200, messagesWith(user.id, m[1], Number(q.get('after')) || 0));
      if (method === 'POST') {
        if (!chatLimit(`u${user.id}`)) throw new HttpError(429, 'You are sending messages very quickly. Wait a moment.');
        return json(res, 201, sendMessage(user.id, m[1], await readJson(req)));
      }
    }

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

    throw new HttpError(404, 'Not found');
  } catch (e) {
    if (e instanceof HttpError) return json(res, e.status, { error: e.message, ...e.extra });
    console.error('[api]', req.method, req.url?.split('?')[0], e);
    return json(res, 500, { error: 'Something went wrong' });
  }
}
