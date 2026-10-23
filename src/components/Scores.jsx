import { useDetails } from '../store';

export function Tomato({ size = 14, fresh = true }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="9" r="6.2" fill={fresh ? 'var(--tomato)' : 'var(--rotten)'} />
      <path d="M8 3.2c-.6-1.2-1.8-1.6-2.8-1.4.6.5 1 1 1.2 1.7-1-.2-2 .1-2.6.8 1.2.2 2.4.5 4.2.2 1.8.3 3-.1 4.2-.4-.6-.6-1.6-.9-2.6-.6.2-.7.6-1.2 1.2-1.6C9.8 1.7 8.6 2 8 3.2z" fill="#6aa84f" />
    </svg>
  );
}

export function Bucket({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="5.2" cy="5" r="2.2" fill="#fff4dc" />
      <circle cx="8" cy="3.8" r="2.5" fill="#fff4dc" />
      <circle cx="10.8" cy="5" r="2.2" fill="#fff4dc" />
      <path d="M3 6.5h10l-1.2 8a1 1 0 0 1-1 .8H5.2a1 1 0 0 1-1-.8z" fill="var(--accent)" />
      <path d="M6.6 7v8M9.4 7v8" stroke="#1a1206" strokeWidth=".9" opacity=".5" />
    </svg>
  );
}

const metaTone = (n) => (n >= 61 ? 'good' : n >= 40 ? 'mixed' : 'bad');

// Which scores to show. With OMDb data: Rotten Tomatoes critics, IMDb and Metacritic.
// Without it, the built-in sample scores.
function scoreList(title, d) {
  const out = [];
  if (d) {
    if (d.rt != null) out.push({ key: 'rt', icon: 'tomato', value: `${d.rt}%`, label: 'Critics', fresh: d.rt >= 60, tip: 'Rotten Tomatoes critics score' });
    if (d.imdb != null) out.push({ key: 'imdb', icon: 'imdb', value: d.imdb.toFixed(1), label: d.imdbVotes ? `IMDb · ${d.imdbVotes} votes` : 'IMDb', tip: 'IMDb rating out of 10' });
    if (d.meta != null) out.push({ key: 'meta', icon: 'meta', value: String(d.meta), label: 'Metascore', tone: metaTone(d.meta), tip: 'Metacritic score' });
  }
  if (!out.length) {
    if (title.critics != null) out.push({ key: 'c', icon: 'tomato', value: `${title.critics}%`, label: 'Critics', fresh: title.critics >= 60, tip: 'Critics score' });
    if (title.audience != null) out.push({ key: 'a', icon: 'bucket', value: `${title.audience}%`, label: 'Audience', tip: 'Audience score' });
  }
  return out;
}

function Mark({ s, size }) {
  if (s.icon === 'tomato') return <Tomato size={size} fresh={s.fresh} />;
  if (s.icon === 'bucket') return <Bucket size={size} />;
  if (s.icon === 'imdb') return <span className="mark mark-imdb" style={{ fontSize: size * 0.68 }}>IMDb</span>;
  return <span className={`mark mark-meta ${s.tone}`} style={{ fontSize: size * 0.58 }}>M</span>;
}

export default function Scores({ title, variant = 'inline' }) {
  const d = useDetails(title.id);
  const scores = scoreList(title, d);
  if (!scores.length) return null;

  if (variant === 'large') {
    return (
      <div className="scores-lg">
        {scores.map((s) => (
          <div key={s.key} className="score-block" title={s.tip}>
            <Mark s={s} size={30} />
            <div>
              <strong>{s.value}</strong>
              <span>{s.label}</span>
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="scores">
      {scores.slice(0, 2).map((s) => (
        <span key={s.key} className="score" title={s.tip}>
          <Mark s={s} size={14} /> {s.value}
        </span>
      ))}
    </div>
  );
}
