import { kindLabel } from '../data';

// Generated key art: each title gets its own hue and one of three compositions.
const variant = (id) => [...id].reduce((a, c) => a + c.charCodeAt(0), 0) % 3;

export default function Poster({ title, size = 'md' }) {
  const withText = size === 'md' || size === 'lg';
  return (
    <div className={`poster poster-${size} pv${variant(title.id)}`} style={{ '--h': title.hue }}>
      {withText && (
        <div className="poster-text">
          <span className="poster-kicker">
            {kindLabel(title)} · {title.year}
          </span>
          <span className="poster-title">{title.title}</span>
        </div>
      )}
    </div>
  );
}
