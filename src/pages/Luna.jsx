import { Fragment, useEffect, useRef, useState } from 'react';
import { TITLES, getTitle } from '../data';
import { useStore } from '../store';
import { askLuna, isError } from '../luna';
import { go } from '../router';
import Poster from '../components/Poster';

const SUGGESTIONS = [
  'What should I watch tonight?',
  'Recommend something based on my list',
  'A show I can binge this weekend',
  'Pick something to watch with a friend',
];

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
      context: { library, friends },
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
    <section>
      <div className="luna-head">
        <div>
          <h1>✨ Ask Luna</h1>
          <p className="muted">Your movie & TV assistant. Knows your list and your friends' taste.</p>
        </div>
        {luna.length > 0 && !busy && (
          <button className="link" onClick={() => setLuna([])}>New chat</button>
        )}
      </div>

      <div className="luna">
        <div className="messages" ref={box}>
          {luna.length === 0 && (
            <div className="luna-empty">
              <div className="luna-orb">✨</div>
              <p className="muted">Ask for recommendations, spoiler-free summaries, or what to watch with friends.</p>
              <div className="filters center">
                {SUGGESTIONS.map((s) => (
                  <button key={s} className="chip" onClick={() => send(s)}>{s}</button>
                ))}
              </div>
            </div>
          )}
          {luna.map((m, i) => (
            <LunaMessage key={i} msg={m} typing={busy && i === luna.length - 1} />
          ))}
        </div>
        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}
        >
          <input placeholder="Ask Luna anything about movies & shows…" value={text} onChange={(e) => setText(e.target.value)} autoFocus />
          {busy ? (
            <button type="button" onClick={stop}>Stop</button>
          ) : (
            <button className="primary" disabled={!text.trim()}>Ask</button>
          )}
        </form>
      </div>
    </section>
  );
}

function LunaMessage({ msg, typing }) {
  if (msg.role === 'user') return <div className="msg mine">{msg.content}</div>;
  const mentioned = typing
    ? []
    : TITLES.filter((t) => msg.content.includes(t.title)).sort((a, b) => msg.content.indexOf(a.title) - msg.content.indexOf(b.title));
  return (
    <div className={`msg luna-msg ${isError(msg.content) ? 'error' : ''}`}>
      {msg.content ? <Markdown text={msg.content} /> : <span className="dots"><i /><i /><i /></span>}
      {mentioned.length > 0 && (
        <div className="luna-titles">
          {mentioned.map((t) => (
            <button key={t.id} className="luna-title" onClick={() => go(`/title/${t.id}`)}>
              <Poster title={t} size="xs" />
              <span>{t.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Tiny markdown: paragraphs, bullet/numbered lists, **bold**, *italic*.
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
