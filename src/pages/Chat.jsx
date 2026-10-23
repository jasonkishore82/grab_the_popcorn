import { useEffect, useRef, useState } from 'react';
import { getTitle, getUser, TITLES } from '../data';
import { useStore } from '../store';
import { go } from '../router';
import Avatar from '../components/Avatar';
import Poster from '../components/Poster';

export default function Chat({ id }) {
  const { friends, chats } = useStore();
  const active = id && friends.includes(id) ? id : null;

  return (
    <section>
      <h1>Chats</h1>
      <div className={`chat-layout ${active ? 'has-active' : ''}`}>
        <ul className="threads">
          {friends.map(getUser).map((u) => {
            const last = (chats[u.id] || []).at(-1);
            return (
              <li key={u.id} className={u.id === active ? 'active' : ''} onClick={() => go(`/chat/${u.id}`)}>
                <Avatar user={u} size={34} />
                <div className="grow">
                  <strong>{u.name}</strong>
                  <p className="muted small ellipsis">{last ? last.text : 'Say hi 👋'}</p>
                </div>
              </li>
            );
          })}
          {!friends.length && (
            <p className="muted small">
              No friends yet. <button className="link" onClick={() => go('/friends')}>Find some →</button>
            </p>
          )}
        </ul>
        {active ? <Thread friendId={active} /> : <div className="thread empty muted">Pick a conversation</div>}
      </div>
    </section>
  );
}

function Thread({ friendId }) {
  const { chats, sendMessage, library } = useStore();
  const friend = getUser(friendId);
  const messages = chats[friendId] || [];
  const [text, setText] = useState('');
  const [attach, setAttach] = useState('');
  const end = useRef(null);

  useEffect(() => {
    const box = end.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [messages.length, friendId]);

  const submit = (e) => {
    e.preventDefault();
    if (!text.trim() && !attach) return;
    sendMessage(friendId, text.trim() || 'Check this out 👇', attach || undefined);
    setText('');
    setAttach('');
  };

  // Put the user's saved titles first in the share picker.
  const options = [...TITLES].sort((a, b) => !!library[b.id] - !!library[a.id]);

  return (
    <div className="thread">
      <div className="thread-head">
        <button className="link back" onClick={() => go('/chat')}>←</button>
        <Avatar user={friend} size={28} /> <strong>{friend.name}</strong>
      </div>
      <div className="messages" ref={end}>
        {messages.map((m, i) => {
          const t = m.titleId && getTitle(m.titleId);
          return (
            <div key={i} className={`msg ${m.from === 'me' ? 'mine' : ''}`}>
              {t && (
                <div className="msg-title" onClick={() => go(`/title/${t.id}`)}>
                  <Poster title={t} size="xs" />
                  <span>{t.title}</span>
                </div>
              )}
              {m.text}
            </div>
          );
        })}
      </div>
      <form className="composer" onSubmit={submit}>
        <select value={attach} onChange={(e) => setAttach(e.target.value)} title="Attach a title">
          <option value="">🎬</option>
          {options.map((t) => (
            <option key={t.id} value={t.id}>{t.title}</option>
          ))}
        </select>
        <input placeholder={`Message ${friend.name.split(' ')[0]}…`} value={text} onChange={(e) => setText(e.target.value)} />
        <button className="primary">Send</button>
      </form>
    </div>
  );
}
