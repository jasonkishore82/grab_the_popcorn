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

export default function Scores({ title, variant = 'inline' }) {
  const fresh = title.critics >= 60;
  if (variant === 'large') {
    return (
      <div className="scores-lg">
        <div className="score-block">
          <Tomato size={30} fresh={fresh} />
          <div>
            <strong>{title.critics}%</strong>
            <span>Critics</span>
          </div>
        </div>
        <div className="score-block">
          <Bucket size={30} />
          <div>
            <strong>{title.audience}%</strong>
            <span>Audience</span>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="scores">
      <span className="score" title="Critics score">
        <Tomato fresh={fresh} /> {title.critics}%
      </span>
      <span className="score" title="Audience score">
        <Bucket /> {title.audience}%
      </span>
    </div>
  );
}
