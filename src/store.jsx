import { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState } from 'react';
import { REPLIES, canonicalId, getTitle, registerAliases, registerTitles } from './data';
import { api } from './api';

const KEY = 'popcorn-state-v1';
const LEGACY_KEY = 'popcorn-legacy-library';

// Friends, chats and the Luna conversation still live in this browser (sample people for now).
// Everything about titles, ratings, comments and lists is on the server.
function loadLocal() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY)) || {};
    // A list saved by an earlier, single-user version: keep it aside so it can be imported after sign-in.
    if (s.library && Object.keys(s.library).length && !localStorage.getItem(LEGACY_KEY)) {
      localStorage.setItem(LEGACY_KEY, JSON.stringify(s.library));
    }
    return { friends: s.friends ?? ['u1'], chats: s.chats ?? {}, luna: s.luna ?? [] };
  } catch {
    return { friends: ['u1'], chats: {}, luna: [] };
  }
}

const Store = createContext(null);

export function StoreProvider({ children }) {
  const [local, setLocal] = useState(loadLocal);
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false); // true once we know whether someone is signed in
  const [library, setLibrary] = useState({}); // the signed-in user's entries, by title id
  const [omdb, setOmdb] = useState(null); // does the server have an OMDb key?
  const [toasts, setToasts] = useState([]);
  const [authDialog, setAuthDialog] = useState(null); // null | { reason, mode }
  const [saved, setSaved] = useState({ id: null, at: 0 }); // bumps after each successful save so pages can refresh
  const [, bump] = useReducer((n) => n + 1, 0); // the title registry lives outside React; this re-renders after it changes
  const queue = useRef(new Map());

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(local));
    } catch {
      /* storage unavailable */
    }
  }, [local]);

  const notify = useCallback((text) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
  }, []);

  const addTitles = useCallback((titles, opts) => {
    registerTitles(titles, opts);
    bump();
  }, []);

  const loadLibrary = useCallback(async () => {
    const { entries } = await api('/me/library');
    addTitles(entries.map((e) => e.title));
    const next = Object.fromEntries(entries.map((e) => [e.title.id, e.entry]));
    setLibrary(next);
    return next;
  }, [addTitles]);

  const loadCatalog = useCallback(async () => {
    try {
      const { titles, aliases, omdb: configured } = await api('/catalog');
      registerAliases(aliases || {});
      addTitles(titles, { replaceStarters: true });
      setOmdb(configured);
    } catch {
      /* the starter titles built into the app keep working */
    }
  }, [addTitles]);

  // Bring in a list that an earlier version kept in this browser, without touching entries the account already has.
  const importLegacy = useCallback(
    async (existing) => {
      let old = null;
      try {
        old = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null');
      } catch {
        /* ignore */
      }
      if (!old) return;
      localStorage.removeItem(LEGACY_KEY); // once only
      let count = 0;
      for (const [oldId, v] of Object.entries(old)) {
        const id = canonicalId(oldId);
        if (existing[id]) continue;
        try {
          await api(`/titles/${id}`); // makes sure the title is in the shared catalogue
          await api(`/titles/${id}/entry`, { method: 'PUT', body: { status: v.status, rating: v.rating || 0, review: v.review || '' } });
          count += 1;
        } catch {
          /* skip titles that cannot be looked up */
        }
      }
      if (count) {
        await loadLibrary();
        notify(`Imported ${count} title${count > 1 ? 's' : ''} saved in this browser`);
      }
    },
    [loadLibrary, notify],
  );

  useEffect(() => {
    (async () => {
      try {
        const { user: me, omdb: configured } = await api('/auth/me');
        setOmdb(configured);
        if (me) {
          setUser(me);
          await loadLibrary();
        }
      } catch {
        /* server unavailable: browse the starter titles only */
      } finally {
        setReady(true);
      }
      loadCatalog();
    })();
  }, [loadLibrary, loadCatalog]);

  const openAuth = useCallback((reason, mode = 'signin') => setAuthDialog({ reason, mode }), []);

  const afterSignIn = useCallback(
    async (me, greeting) => {
      setUser(me);
      setAuthDialog(null);
      const entries = await loadLibrary();
      notify(`${greeting}, ${me.name.split(' ')[0]}`);
      importLegacy(entries);
    },
    [loadLibrary, importLegacy, notify],
  );

  // Send the queued changes for one title to the server.
  const flush = useCallback(
    async (id) => {
      const item = queue.current.get(id);
      if (!item) return;
      queue.current.delete(id);
      try {
        const { entry, title } = await api(`/titles/${id}/entry`, { method: 'PUT', body: item.patch });
        addTitles([title]);
        setLibrary((l) => (l[id] ? { ...l, [id]: { ...l[id], status: entry.status, addedAt: entry.addedAt } } : l));
        setSaved({ id, at: Date.now() });
      } catch (e) {
        if (e.status === 401) {
          setUser(null);
          setLibrary({});
          openAuth('Your session ended. Sign in again to save.');
        } else {
          notify('Could not save that. Please try again.');
        }
      }
    },
    [addTitles, notify, openAuth],
  );

  const api2 = {
    ...local,
    user,
    ready,
    library,
    omdb,
    toasts,
    authDialog,
    saved,
    notify,
    openAuth,
    closeAuth: () => setAuthDialog(null),
    loadCatalog,
    addTitles,

    async login(handle, password) {
      const { user: me } = await api('/auth/login', { method: 'POST', body: { handle, password } });
      await afterSignIn(me, 'Welcome back');
    },
    async register(handle, name, password) {
      const { user: me } = await api('/auth/register', { method: 'POST', body: { handle, name, password } });
      await afterSignIn(me, 'Welcome');
    },
    async logout() {
      try {
        await api('/auth/logout', { method: 'POST' });
      } catch {
        /* the cookie is cleared server-side on a best-effort basis */
      }
      setUser(null);
      setLibrary({});
      notify('Signed out');
    },

    // Full title (with every member's reviews) from the shared catalogue; remembers it for the rest of the app.
    async loadTitle(id) {
      const data = await api(`/titles/${id}`);
      addTitles([data.title]);
      return data;
    },

    // Watchlist / watched / rating / comment for the signed-in user. Shows at once, saves to the server a moment later.
    saveTitle(rawId, patch) {
      if (!user) {
        openAuth('Sign in to save titles, rate them and write reviews.');
        return false;
      }
      const id = canonicalId(rawId);
      const applied = { ...patch };
      if (applied.rating > 0 && (applied.status ?? library[id]?.status ?? 'watchlist') === 'watchlist') applied.status = 'watched';
      setLibrary((l) => ({ ...l, [id]: { status: 'watchlist', rating: 0, review: '', addedAt: Date.now(), ...l[id], ...applied } }));
      const cur = queue.current.get(id);
      clearTimeout(cur?.timer);
      queue.current.set(id, { patch: { ...cur?.patch, ...applied }, timer: setTimeout(() => flush(id), 'review' in patch ? 600 : 40) });
      return true;
    },
    async removeTitle(rawId) {
      const id = canonicalId(rawId);
      const before = library[id];
      setLibrary((l) => {
        const { [id]: _gone, ...rest } = l;
        return rest;
      });
      try {
        const { title } = await api(`/titles/${id}/entry`, { method: 'DELETE' });
        if (title) addTitles([title]);
        setSaved({ id, at: Date.now() });
      } catch {
        setLibrary((l) => ({ ...l, [id]: before }));
        notify('Could not remove that. Please try again.');
      }
    },

    toggleFriend(id) {
      setLocal((s) => ({ ...s, friends: s.friends.includes(id) ? s.friends.filter((f) => f !== id) : [...s.friends, id] }));
    },
    setLuna(update) {
      setLocal((s) => ({ ...s, luna: typeof update === 'function' ? update(s.luna) : update }));
    },
    sendMessage(friendId, text, titleId) {
      const msg = { from: 'me', text, titleId, ts: Date.now() };
      setLocal((s) => ({ ...s, chats: { ...s.chats, [friendId]: [...(s.chats[friendId] || []), msg] } }));
      // Fake reply so the chat feels alive until friends are real people.
      setTimeout(() => {
        const reply = { from: friendId, text: REPLIES[Math.floor(Math.random() * REPLIES.length)], ts: Date.now() };
        setLocal((s) => ({ ...s, chats: { ...s.chats, [friendId]: [...(s.chats[friendId] || []), reply] } }));
      }, 1200);
    },
  };

  return <Store.Provider value={api2}>{children}</Store.Provider>;
}

export const useStore = () => useContext(Store);
export { getTitle };
