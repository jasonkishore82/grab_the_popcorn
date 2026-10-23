import { Fragment, useEffect, useRef, useState } from 'react';
import { allTitles, getTitle } from '../data';
import { useStore } from '../store';
import { askLuna, isError, splitError } from '../luna';
import { go } from '../router';
import Poster from '../components/Poster';
import Icon from '../components/Icon';

const SUGGESTIONS = [
  { icon: 'clock', text: 'What should I watch tonight?' },
  { icon: 'bookmark', text: 'Recommend something based on my list' },
  { icon: 'tv', text: 'A series I can binge this weekend' },
  { icon: 'users', text: 'Pick something to watch with a friend' },
];

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

export default function Luna({ titleId }) {
  const { luna, setLuna, library, friends } = useStore();
  const about = titleId && getTitle(titleId);
  const [text, setText] = useState(about ? `Is ${about.title} worth watching for me?` : '');
  const [busy, setBusy] = useState(false);
  const box = useRef(null);
  const abort = useRef(null);

  useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [luna]);
  useEffect(() => () => abort.current?.abort(), []);

  const send = async (q) => {
    q = q.trim();
    if (!q || busy) return;
    const history = [...luna, { role: 'user', content: q }];
    setLuna([...history, { role: 'assistant', content: '' }]);
    setText('');
    setBusy(true);
    abort.current = new AbortController();
    await askLuna({
      history,
      context: {
        // Names travel with each entry so Luna also knows titles that came from OMDb.
        library: Object.fromEntries(Object.entries(library).map(([id, v]) => [id, { ...v, title: getTitle(id)?.title, year: getTitle(id)?.year }])),
        friends,
      },
      signal: abort.current.signal,
      onText: (chunk) =>
        setLuna((msgs) => {
          const last = msgs.at(-1);
          return [...msgs.slice(0, -1), { ...last, content: last.content + chunk }];
        }),
    });
    setBusy(false);
  };

  const stop = () => {
    abort.current?.abort();
    setBusy(false);
  };

  return (
    <div className="luna-page">
      <header className="luna-top">
        <div className="luna-id">
          <div className="moon" style={{ '--s': '40px' }} />
          <div>
            <h1>Luna</h1>
            <span className="muted small">Your film & TV assistant · knows your list and your friends’ taste</span>
          </div>
        </div>
        {luna.length > 0 && !busy && (
          <button className="btn btn-quiet btn-sm" onClick={() => setLuna([])}>
            <Icon name="refresh" size={15} /> New chat
          </button>
        )}
      </header>

      <div className="luna">
        <div className="luna-scroll" ref={box}>
          {luna.length === 0 ? (
            <div className="luna-empty">
              <div className="moon" style={{ '--s': '88px' }} />
              <h2 className="display-sm">
                {greeting()}. <em>What are we watching?</em>
              </h2>
              <p className="muted">Ask for recommendations, spoiler-free summaries, or something everyone in the room will like.</p>
              <div className="suggestions">
                {SUGGESTIONS.map((s) => (
                  <button key={s.text} className="suggestion" onClick={() => send(s.text)}>
                    <Icon name={s.icon} size={17} />
                    <span>{s.text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="luna-thread">
              {luna.map((m, i) => (
                <LunaMessage key={i} msg={m} typing={busy && i === luna.length - 1} />
              ))}
            </div>
          )}
        </div>

        <form
          className="luna-composer"
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}
        >
          <div className="luna-input">
            <input placeholder="Ask Luna anything about films and series" value={text} onChange={(e) => setText(e.target.value)} autoFocus />
            {busy ? (
              <button type="button" className="btn btn-secondary btn-icon round" onClick={stop} aria-label="Stop">
                <Icon name="stop" size={14} fill />
              </button>
            ) : (
              <button className="btn btn-luna-solid btn-icon round" disabled={!text.trim()} aria-label="Send">
                <Icon name="send" size={16} />
              </button>
            )}
          </div>
          <p className="fine-print">Luna can make mistakes. Powered by Claude.</p>
        </form>
      </div>
    </div>
  );
}

function LunaMessage({ msg, typing }) {
  if (msg.role === 'user') {
    return (
      <div className="lm lm-user">
        <div className="lm-bubble">{msg.content}</div>
      </div>
    );
  }
  const [body, error] = splitError(msg.content);
  const mentioned = typing
    ? []
    : allTitles().filter((t) => body.includes(t.title)).sort((a, b) => body.indexOf(a.title) - body.indexOf(b.title));
  return (
    <div className={`lm lm-luna ${isError(msg.content) ? 'error' : ''}`}>
      <div className="moon" style={{ '--s': '28px' }} />
      <div className="lm-body">
        {body ? <Markdown text={body} /> : !error && <span className="dots"><i /><i /><i /></span>}
        {error && (
          <p className="lm-error">
            <Icon name="alert" size={15} /> {error}
          </p>
        )}
        {mentioned.length > 0 && (
          <div className="lm-titles">
            {mentioned.map((t) => (
              <button key={t.id} className="lm-title" onClick={() => go(`/title/${t.id}`)}>
                <Poster title={t} size="xs" />
                <span>
                  <strong>{t.title}</strong>
                  <small>{t.year} · {t.genres[0]}</small>
                </span>
                <Icon name="chevronRight" size={15} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Tiny markdown: paragraphs, bullet/numbered lists, **bold**, *italic*, `code`.
function Markdown({ text }) {
  const blocks = [];
  for (const line of text.split('\n')) {
    const item = line.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)/);
    if (item) {
      const last = blocks.at(-1);
      if (last?.type === 'ul') last.items.push(item[1]);
      else blocks.push({ type: 'ul', items: [item[1]] });
    } else if (line.trim()) {
      blocks.push({ type: 'p', text: line.replace(/^#+\s*/, '') });
    }
  }
  return blocks.map((b, i) =>
    b.type === 'ul' ? (
      <ul key={i}>{b.items.map((t, j) => <li key={j}><Inline text={t} /></li>)}</ul>
    ) : (
      <p key={i}><Inline text={b.text} /></p>
    ),
  );
}

function Inline({ text }) {
  return text.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`)/g).map((part, i) => {
    if (/^\*\*.+\*\*$/.test(part)) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (/^\*.+\*$/.test(part)) return <em key={i}>{part.slice(1, -1)}</em>;
    if (/^`.+`$/.test(part)) return <code key={i}>{part.slice(1, -1)}</code>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}
