import { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState } from 'react';
import { canonicalId, getTitle, registerAliases, registerTitles } from './data';
import { api } from './api';

const KEY = 'popcorn-state-v1';
const LEGACY_KEY = 'popcorn-legacy-library';
const NO_SOCIAL = { friends: [], incoming: [], outgoing: [] };
const NO_CHAT = { conversations: [], unread: 0 };

// Everything lives on the server. This only keeps aside a list saved by an earlier single-user version.
function loadLocal() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY)) || {};
    // A list saved by an earlier, single-user version: keep it aside so it can be imported after sign-in.
    if (s.library && Object.keys(s.library).length && !localStorage.getItem(LEGACY_KEY)) {
      localStorage.setItem(LEGACY_KEY, JSON.stringify(s.library));
    }
    return {};
  } catch {
    return {};
  }
}

const Store = createContext(null);

export function StoreProvider({ children }) {
  const [local, setLocal] = useState(loadLocal);
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false); // true once we know whether someone is signed in
  const [library, setLibrary] = useState({}); // the signed-in user's entries, by title id
  const [omdb, setOmdb] = useState(null); // does the server have an OMDb key?
  const [emailOn, setEmailOn] = useState(false); // can the server send email?
  const [social, setSocial] = useState(NO_SOCIAL); // friends and friend requests
  const [chat, setChat] = useState(NO_CHAT); // conversation list and unread count
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

  // Friends, requests, conversations and the unread count.
  const refreshSocial = useCallback(async () => {
    try {
      const [f, c] = await Promise.all([api('/friends'), api('/chats')]);
      setSocial(f);
      setChat(c);
    } catch {
      /* try again on the next poll */
    }
  }, []);

  const refreshMe = useCallback(async () => {
    const { user: me, omdb: configured, email } = await api('/auth/me');
    setUser(me);
    setOmdb(configured);
    setEmailOn(Boolean(email));
    return me;
  }, []);

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
        const me = await refreshMe();
        if (me) await loadLibrary();
      } catch {
        /* server unavailable: browse the starter titles only */
      } finally {
        setReady(true);
      }
      loadCatalog();
    })();
  }, [refreshMe, loadLibrary, loadCatalog]);

  // While signed in, keep friends and the unread count fresh.
  useEffect(() => {
    if (!user) {
      setSocial(NO_SOCIAL);
      setChat(NO_CHAT);
      return undefined;
    }
    refreshSocial();
    const timer = setInterval(() => !document.hidden && refreshSocial(), 10000);
    return () => clearInterval(timer);
  }, [user?.id, refreshSocial]); // eslint-disable-line react-hooks/exhaustive-deps

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
        setLibrary((l) => (l[id] ? { ...l, [id]: { ...l[id], status: entry.status, timesWatched: entry.timesWatched, addedAt: entry.addedAt } } : l));
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

  const value = {
    ...local,
    user,
    ready,
    library,
    omdb,
    emailOn,
    social,
    chat,
    toasts,
    authDialog,
    saved,
    notify,
    openAuth,
    closeAuth: () => setAuthDialog(null),
    loadCatalog,
    addTitles,
    refreshSocial,
    refreshMe,

    async login(handle, password) {
      const { user: me } = await api('/auth/login', { method: 'POST', body: { handle, password } });
      await afterSignIn(me, 'Welcome back');
    },
    async register(handle, name, email, password) {
      const { user: me } = await api('/auth/register', { method: 'POST', body: { handle, name, email, password } });
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

    // Watchlist / watched / rating / comment / times watched for the signed-in user.
    // Shows at once, saves to the server a moment later.
    saveTitle(rawId, patch) {
      if (!user) {
        openAuth('Sign in to save titles, rate them and write reviews.');
        return false;
      }
      const id = canonicalId(rawId);
      const applied = { ...patch };
      if (applied.rating > 0 && (applied.status ?? library[id]?.status ?? 'watchlist') === 'watchlist') applied.status = 'watched';
      setLibrary((l) => {
        const cur = l[id];
        const status = applied.status ?? cur?.status ?? 'watchlist';
        const times = status === 'watched' ? applied.timesWatched ?? (cur?.status === 'watched' ? cur.timesWatched : 1) : 0;
        return { ...l, [id]: { rating: 0, review: '', addedAt: Date.now(), ...cur, ...applied, status, timesWatched: times } };
      });
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

    // People
    async addFriend(handle) {
      if (!user) return openAuth('Sign in to add friends.');
      const { relation } = await api(`/friends/${handle}`, { method: 'POST' });
      await refreshSocial();
      return relation;
    },
    async removeFriend(handle) {
      await api(`/friends/${handle}`, { method: 'DELETE' });
      await refreshSocial();
    },
    async sendChat(handle, text, titleId) {
      const { message } = await api(`/chats/${handle}`, { method: 'POST', body: { text, titleId } });
      refreshSocial();
      return message;
    },
  };

  return <Store.Provider value={value}>{children}</Store.Provider>;
}

export const useStore = () => useContext(Store);
export { getTitle };
