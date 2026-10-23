import Icon from './Icon';

export function Tomato({ size = 14, fresh = true }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="9" r="6.2" fill={fresh ? 'var(--tomato)' : 'var(--rotten)'} />
      <path d="M8 3.2c-.6-1.2-1.8-1.6-2.8-1.4.6.5 1 1 1.2 1.7-1-.2-2 .1-2.6.8 1.2.2 2.4.5 4.2.2 1.8.3 3-.1 4.2-.4-.6-.6-1.6-.9-2.6-.6.2-.7.6-1.2 1.2-1.6C9.8 1.7 8.6 2 8 3.2z" fill="#6aa84f" />
    </svg>
  );
}

const metaTone = (n) => (n >= 61 ? 'good' : n >= 40 ? 'mixed' : 'bad');

// The scores we can show: the community's own rating first, then Rotten Tomatoes, IMDb and Metacritic.
function scoreList(title) {
  const out = [];
  const st = title.stats;
  if (st?.ratingCount > 0) {
    const n = st.ratingCount;
    out.push({ key: 'community', icon: 'star', value: st.ratingAvg.toFixed(1), label: `Community · ${n} rating${n > 1 ? 's' : ''}`, tip: 'Average of our members’ ratings, out of 5' });
  }
  if (title.rt != null) out.push({ key: 'rt', icon: 'tomato', value: `${title.rt}%`, label: 'Critics', fresh: title.rt >= 60, tip: 'Rotten Tomatoes critics score' });
  if (title.imdb != null) out.push({ key: 'imdb', icon: 'imdb', value: title.imdb.toFixed(1), label: title.imdbVotes ? `IMDb · ${title.imdbVotes} votes` : 'IMDb', tip: 'IMDb rating out of 10' });
  if (title.meta != null) out.push({ key: 'meta', icon: 'meta', value: String(title.meta), label: 'Metascore', tone: metaTone(title.meta), tip: 'Metacritic score' });
  return out;
}

function Mark({ s, size }) {
  if (s.icon === 'star') return <span className="mark-star"><Icon name="star" size={size * 0.95} fill strokeWidth={0} /></span>;
  if (s.icon === 'tomato') return <Tomato size={size} fresh={s.fresh} />;
  if (s.icon === 'imdb') return <span className="mark mark-imdb" style={{ fontSize: size * 0.68 }}>IMDb</span>;
  return <span className={`mark mark-meta ${s.tone}`} style={{ fontSize: size * 0.58 }}>M</span>;
}

export default function Scores({ title, variant = 'inline' }) {
  const scores = scoreList(title);
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
