import { useEffect, useRef, useState } from 'react';
import { allTitles, getTitle, getUser, timeAgo } from '../data';
import { useStore } from '../store';
import { go } from '../router';
import Avatar from '../components/Avatar';
import Poster from '../components/Poster';
import Icon from '../components/Icon';
import { Empty, PageHead } from '../components/ui';

const clock = (ts) => new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export default function Chat({ id }) {
  const { friends, chats } = useStore();
  const active = id && friends.includes(id) ? id : null;
  const threads = friends
    .map(getUser)
    .map((u) => ({ u, last: (chats[u.id] || []).at(-1) }))
    .sort((a, b) => (b.last?.ts || 0) - (a.last?.ts || 0));

  return (
    <>
      <PageHead eyebrow="Conversations" title="Messages" subtitle="Talk movies with your friends. Attach any title to a message." />
      {friends.length === 0 ? (
        <Empty icon="message" title="No conversations yet" text="Add friends to start talking about what you’re watching." action={<button className="btn btn-primary" onClick={() => go('/friends')}>Find friends</button>} />
      ) : (
        <div className={`chat-layout ${active ? 'has-active' : ''}`}>
          <ul className="threads">
            {threads.map(({ u, last }) => (
              <li key={u.id}>
                <button className={u.id === active ? 'active' : ''} onClick={() => go(`/chat/${u.id}`)}>
                  <Avatar user={u} size={38} />
                  <div className="grow">
                    <div className="thread-top">
                      <strong>{u.name}</strong>
                      {last && <span className="muted small">{timeAgo(last.ts)}</span>}
                    </div>
                    <p className="muted small ellipsis">{last ? `${last.from === 'me' ? 'You: ' : ''}${last.text}` : 'Start a conversation'}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
          {active ? (
            <Thread friendId={active} />
          ) : (
            <div className="thread thread-empty">
              <Empty icon="message" title="Select a conversation" text="Choose a friend on the left to pick up where you left off." />
            </div>
          )}
        </div>
      )}
    </>
  );
}

function Thread({ friendId }) {
  const { chats, sendMessage, library } = useStore();
  const friend = getUser(friendId);
  const messages = chats[friendId] || [];
  const [text, setText] = useState('');
  const [attach, setAttach] = useState(null);
  const [picking, setPicking] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [messages.length, friendId]);

  const submit = (e) => {
    e.preventDefault();
    if (!text.trim() && !attach) return;
    sendMessage(friendId, text.trim() || 'Check this out', attach || undefined);
    setText('');
    setAttach(null);
  };

  // Saved titles first in the picker.
  const options = allTitles().sort((a, b) => !!library[b.id] - !!library[a.id]);
  const attached = attach && getTitle(attach);

  return (
    <div className="thread">
      <div className="thread-head">
        <button className="btn btn-quiet btn-icon back-mobile" onClick={() => go('/chat')} aria-label="Back to conversations">
          <Icon name="arrowLeft" size={18} />
        </button>
        <Avatar user={friend} size={34} />
        <div>
          <strong>{friend.name}</strong>
          <span className="muted small">@{friend.handle}</span>
        </div>
      </div>

      <div className="messages" ref={box}>
        {messages.length === 0 && <p className="thread-hint">Say hi to {friend.name.split(' ')[0]}, or attach a title to talk about.</p>}
        {messages.map((m, i) => {
          const t = m.titleId && getTitle(m.titleId);
          const mine = m.from === 'me';
          return (
            <div key={i} className={`msg-row ${mine ? 'mine' : ''}`}>
              <div className={`msg ${mine ? 'mine' : ''}`}>
                {t && (
                  <button className="msg-title" onClick={() => go(`/title/${t.id}`)}>
                    <Poster title={t} size="xs" />
                    <span>
                      <strong>{t.title}</strong>
                      <small>{t.year} · {t.genres[0]}</small>
                    </span>
                  </button>
                )}
                {m.text}
              </div>
              <span className="msg-time">{clock(m.ts)}</span>
            </div>
          );
        })}
      </div>

      <form className="composer" onSubmit={submit}>
        {attached && (
          <div className="attached">
            <Poster title={attached} size="xs" />
            <span>{attached.title}</span>
            <button type="button" onClick={() => setAttach(null)} aria-label="Remove attachment">
              <Icon name="x" size={14} />
            </button>
          </div>
        )}
        <div className="composer-row">
          <div className="popover-wrap">
            <button type="button" className="btn btn-quiet btn-icon" onClick={() => setPicking((p) => !p)} aria-label="Attach a title" title="Attach a title">
              <Icon name="film" size={18} />
            </button>
            {picking && (
              <div className="popover popover-up picker">
                <span className="popover-label">Attach a title</span>
                {options.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="popover-item"
                    onClick={() => {
                      setAttach(t.id);
                      setPicking(false);
                    }}
                  >
                    <Poster title={t} size="xs" />
                    <span>{t.title}</span>
                    {library[t.id] && <Icon name="bookmark" size={13} className="muted" />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <input placeholder={`Message ${friend.name.split(' ')[0]}`} value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn btn-primary btn-icon" disabled={!text.trim() && !attach} aria-label="Send">
            <Icon name="send" size={17} />
          </button>
        </div>
      </form>
    </div>
  );
}
