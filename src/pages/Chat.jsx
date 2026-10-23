import { useEffect, useRef, useState } from 'react';
import { allTitles, getTitle, timeAgo } from '../data';
import { useStore } from '../store';
import { api } from '../api';
import { go } from '../router';
import Avatar from '../components/Avatar';
import Poster from '../components/Poster';
import Icon from '../components/Icon';
import { Empty, PageHead } from '../components/ui';

const clock = (ts) => new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export default function Chat({ id }) {
  const { user, ready, openAuth, chat, social } = useStore();
  const active = id && social.friends.some((f) => f.handle === id) ? id : null;
  const { refreshSocial } = useStore();
  useEffect(() => {
    if (user) refreshSocial();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (ready && !user) {
    return (
      <>
        <PageHead eyebrow="Conversations" title="Messages" subtitle="Talk movies with your friends." />
        <Empty icon="message" title="Sign in to chat" text="Create an account, add friends and talk about what you watch." action={<button className="btn btn-primary" onClick={() => openAuth('Sign in to chat with friends.')}>Sign in</button>} />
      </>
    );
  }

  return (
    <>
      <PageHead eyebrow="Conversations" title="Messages" subtitle="Talk movies with your friends. Attach any title to a message." />
      {chat.conversations.length === 0 ? (
        <Empty icon="message" title="No conversations yet" text="You can chat with people once you are friends. Search for a username to get started." action={<button className="btn btn-primary" onClick={() => go('/friends')}>Find friends</button>} />
      ) : (
        <div className={`chat-layout ${active ? 'has-active' : ''}`}>
          <ul className="threads">
            {chat.conversations.map((c) => (
              <li key={c.handle}>
                <button className={c.handle === active ? 'active' : ''} onClick={() => go(`/chat/${c.handle}`)}>
                  <Avatar user={c} size={38} />
                  <div className="grow">
                    <div className="thread-top">
                      <strong>{c.name}</strong>
                      {c.last && <span className="muted small">{timeAgo(c.last.ts)}</span>}
                    </div>
                    <p className={`small ellipsis ${c.unread ? 'unread-text' : 'muted'}`}>{c.last ? `${c.last.mine ? 'You: ' : ''}${c.last.text}` : 'Start a conversation'}</p>
                  </div>
                  {c.unread > 0 && <span className="nav-count unread">{c.unread}</span>}
                </button>
              </li>
            ))}
          </ul>
          {active ? (
            <Thread key={active} friend={social.friends.find((f) => f.handle === active)} />
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

function Thread({ friend }) {
  const { library, sendChat, loadTitle, notify } = useStore();
  const [messages, setMessages] = useState(null);
  const [text, setText] = useState('');
  const [attach, setAttach] = useState(null);
  const [picking, setPicking] = useState(false);
  const box = useRef(null);
  const lastId = useRef(0);
  const asked = useRef(new Set());

  // Load the conversation, then check for new messages every few seconds.
  useEffect(() => {
    let stop = false;
    const pull = async () => {
      if (document.hidden && lastId.current) return;
      try {
        const { messages: fresh } = await api(`/chats/${friend.handle}${lastId.current ? `?after=${lastId.current}` : ''}`);
        if (stop) return;
        if (fresh.length) {
          lastId.current = fresh.at(-1).id;
          setMessages((m) => [...(m || []), ...fresh.filter((f) => !(m || []).some((x) => x.id === f.id))]);
        } else setMessages((m) => m || []);
      } catch {
        /* keep trying */
      }
    };
    pull();
    const timer = setInterval(pull, 3000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [friend.handle]);

  useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight;
    // Titles a friend attached that this browser has not seen yet
    for (const m of messages || []) {
      if (m.titleId && !getTitle(m.titleId) && !asked.current.has(m.titleId)) {
        asked.current.add(m.titleId);
        loadTitle(m.titleId).catch(() => {});
      }
    }
  }, [messages, loadTitle]);

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim() && !attach) return;
    try {
      const message = await sendChat(friend.handle, text.trim(), attach || undefined);
      lastId.current = Math.max(lastId.current, message.id);
      setMessages((m) => [...(m || []), message]);
      setText('');
      setAttach(null);
    } catch (err) {
      notify(err.message || 'Could not send that');
    }
  };

  // Titles from your list first, then the rest of the catalogue.
  const options = allTitles().sort((a, b) => !!library[b.id] - !!library[a.id]).slice(0, 80);
  const attached = attach && getTitle(attach);

  return (
    <div className="thread">
      <div className="thread-head">
        <button className="btn btn-quiet btn-icon back-mobile" onClick={() => go('/chat')} aria-label="Back to conversations">
          <Icon name="arrowLeft" size={18} />
        </button>
        <Avatar user={friend} size={34} />
        <div className="grow">
          <strong>{friend.name}</strong>
          <span className="muted small">@{friend.handle}</span>
        </div>
        <a className="btn btn-quiet btn-sm" href={`#/showcase/${friend.handle}`}>
          <Icon name="film" size={15} /> Showcase
        </a>
      </div>

      <div className="messages" ref={box}>
        {messages && messages.length === 0 && <p className="thread-hint">Say hi to {friend.name.split(' ')[0]}, or attach a title to talk about.</p>}
        {(messages || []).map((m) => {
          const t = m.titleId && getTitle(m.titleId);
          return (
            <div key={m.id} className={`msg-row ${m.mine ? 'mine' : ''}`}>
              <div className={`msg ${m.mine ? 'mine' : ''}`}>
                {t && (
                  <button className="msg-title" onClick={() => go(`/title/${t.id}`)}>
                    <Poster title={t} size="xs" />
                    <span>
                      <strong>{t.title}</strong>
                      <small>{t.year} · {t.genres[0] || t.type}</small>
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
                  <button key={t.id} type="button" className="popover-item" onClick={() => { setAttach(t.id); setPicking(false); }}>
                    <Poster title={t} size="xs" />
                    <span>{t.title}</span>
                    {library[t.id] && <Icon name="bookmark" size={13} className="muted" />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <input placeholder={`Message ${friend.name.split(' ')[0]}`} value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} />
          <button className="btn btn-primary btn-icon" disabled={!text.trim() && !attach} aria-label="Send">
            <Icon name="send" size={17} />
          </button>
        </div>
      </form>
    </div>
  );
}
