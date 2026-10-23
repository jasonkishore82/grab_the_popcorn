import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { REPLIES, getTitle, hueFor, registerTitle } from './data';
import { fetchDetails } from './omdb';

const KEY = 'popcorn-state-v1';
const DAY = 864e5;
// details: OMDb data by title id. extra: titles found through OMDb search (not in the built-in catalog).
const initial = { library: {}, friends: ['u1'], chats: {}, luna: [], details: {}, extra: {} };

function load() {
  let state = initial;
  try {
    state = { ...initial, ...JSON.parse(localStorage.getItem(KEY)) };
  } catch {
    /* first visit or storage unavailable */
  }
  // Titles added from OMDb must be known before the first render.
  Object.values(state.extra || {}).forEach(registerTitle);
  return state;
}

// Build the app's title object for something that came from OMDb.
function fromDetails(title, d) {
  return {
    ...title,
    external: true,
    imdb: d.imdbID || title.imdb,
    title: d.title || title.title,
    year: d.year || title.year,
    type: d.type,
    genres: d.genres.length ? d.genres : title.genres || [],
    synopsis: d.plot || title.synopsis || '',
    runtime: d.type === 'movie' ? d.runtime : null,
    critics: d.rt,
    audience: null,
    poster: d.poster || title.poster || null,
    hue: title.hue ?? hueFor(title.id),
  };
}

const Store = createContext(null);

export function StoreProvider({ children }) {
  const [state, setState] = useState(load);
  const [toasts, setToasts] = useState([]);
  const [loading, setLoading] = useState({});
  const [omdb, setOmdb] = useState({ status: 'unknown', reason: '' }); // unknown | ok | off
  const live = useRef(state);
  live.current = state;
  const inflight = useRef(new Set());
  const off = useRef(false);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable */
    }
  }, [state]);

  // Fill in a title's details (poster, plot, cast, ratings...) from OMDb, once, and remember them.
  const ensureDetails = useCallback(async (title) => {
    if (!title || off.current) return;
    const cur = live.current.details[title.id];
    const ttl = cur?.missing ? DAY : 30 * DAY;
    if ((cur && Date.now() - cur.fetchedAt < ttl) || inflight.current.has(title.id)) return;

    inflight.current.add(title.id);
    setLoading((l) => ({ ...l, [title.id]: true }));
    try {
      const d = await fetchDetails(title);
      setOmdb({ status: 'ok', reason: '' });
      setState((s) => {
        const next = { ...s, details: { ...s.details, [title.id]: d } };
        if (title.external || s.extra[title.id]) {
          const t = fromDetails(s.extra[title.id] || title, d);
          registerTitle(t);
          next.extra = { ...s.extra, [title.id]: t };
        }
        return next;
      });
    } catch (e) {
      if (e.kind === 'unconfigured' || e.kind === 'denied') {
        off.current = true;
        setOmdb({ status: 'off', reason: e.kind === 'denied' ? e.message : 'unconfigured' });
      } else if (e.kind === 'not-found') {
        setState((s) => ({ ...s, details: { ...s.details, [title.id]: { missing: true, fetchedAt: Date.now() } } }));
      }
      // 'unavailable' (network hiccup): nothing is cached, so the next visit tries again
    } finally {
      inflight.current.delete(title.id);
      setLoading((l) => {
        const { [title.id]: _done, ...rest } = l;
        return rest;
      });
    }
  }, []);

  // Fetch for a list a few at a time, so opening the app doesn't fire everything at once.
  const ensureMany = useCallback(
    async (titles, parallel = 3) => {
      const queue = [...titles];
      await Promise.all(
        Array.from({ length: parallel }, async () => {
          while (queue.length && !off.current) await ensureDetails(queue.shift());
        }),
      );
    },
    [ensureDetails],
  );

  const api = {
    ...state,
    toasts,
    loading,
    omdb,
    ensureDetails,
    ensureMany,
    notify(text) {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t.slice(-2), { id, text }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
    },
    // Keep a title that came from an OMDb search so lists, chats and links can find it later.
    adoptTitle(t) {
      if (!t?.external || live.current.extra[t.id]) return;
      registerTitle(t);
      setState((s) => ({ ...s, extra: { ...s.extra, [t.id]: t } }));
      ensureDetails(t);
    },
    saveTitle(id, patch) {
      setState((s) => ({
        ...s,
        library: { ...s.library, [id]: { status: 'watchlist', rating: 0, review: '', addedAt: Date.now(), ...s.library[id], ...patch } },
      }));
    },
    removeTitle(id) {
      setState((s) => {
        const library = { ...s.library };
        delete library[id];
        return { ...s, library };
      });
    },
    toggleFriend(id) {
      setState((s) => ({
        ...s,
        friends: s.friends.includes(id) ? s.friends.filter((f) => f !== id) : [...s.friends, id],
      }));
    },
    setLuna(update) {
      setState((s) => ({ ...s, luna: typeof update === 'function' ? update(s.luna) : update }));
    },
    sendMessage(friendId, text, titleId) {
      const msg = { from: 'me', text, titleId, ts: Date.now() };
      setState((s) => ({ ...s, chats: { ...s.chats, [friendId]: [...(s.chats[friendId] || []), msg] } }));
      // Fake reply so the chat feels alive until there's a backend.
      setTimeout(() => {
        const reply = { from: friendId, text: REPLIES[Math.floor(Math.random() * REPLIES.length)], ts: Date.now() };
        setState((s) => ({ ...s, chats: { ...s.chats, [friendId]: [...(s.chats[friendId] || []), reply] } }));
      }, 1200);
    },
  };

  return <Store.Provider value={api}>{children}</Store.Provider>;
}

export const useStore = () => useContext(Store);

// OMDb details for one title, or null while they are missing or not found.
export function useDetails(id) {
  const { details } = useStore();
  const d = details[id];
  return d && !d.missing ? d : null;
}

export { getTitle };
