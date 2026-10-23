import { createContext, useContext, useEffect, useState } from 'react';
import { REPLIES } from './data';

const KEY = 'popcorn-state-v1';
const initial = { library: {}, friends: ['u1'], chats: {} };

function load() {
  try {
    return { ...initial, ...JSON.parse(localStorage.getItem(KEY)) };
  } catch {
    return initial;
  }
}

const Store = createContext(null);

export function StoreProvider({ children }) {
  const [state, setState] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable */
    }
  }, [state]);

  const api = {
    ...state,
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
