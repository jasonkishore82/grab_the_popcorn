import { useEffect, useState } from 'react';
import { kindLabel } from '../data';

// Real poster (from OMDb, stored in the shared catalogue) when there is one; generated key art underneath as the fallback.
const variant = (id) => [...id].reduce((a, c) => a + c.charCodeAt(0), 0) % 3;

export default function Poster({ title, size = 'md' }) {
  const src = title.poster || null;
  const [state, setState] = useState('idle'); // idle | loaded | failed
  useEffect(() => setState('idle'), [src]);

  const showImg = src && state !== 'failed';
  const loaded = showImg && state === 'loaded';
  const withText = (size === 'md' || size === 'lg') && !loaded;

  return (
    <div className={`poster poster-${size} pv${variant(title.id)} ${loaded ? 'has-img' : ''}`} style={{ '--h': title.hue }}>
      {showImg && (
        <img className="poster-img" src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onLoad={() => setState('loaded')} onError={() => setState('failed')} />
      )}
      {withText && (
        <div className="poster-text">
          <span className="poster-kicker">
            {kindLabel(title)}
            {title.year ? ` · ${title.year}` : ''}
          </span>
          <span className="poster-title">{title.title}</span>
        </div>
      )}
    </div>
  );
}
