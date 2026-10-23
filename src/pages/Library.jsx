import { useState } from 'react';
import { getTitle } from '../data';
import { useStore } from '../store';
import { go } from '../router';
import Poster from '../components/Poster';
import Stars from '../components/Stars';

export default function Library() {
  const { library } = useStore();
  const [tab, setTab] = useState('watched');

  const items = Object.entries(library)
    .filter(([, v]) => v.status === tab)
    .sort((a, b) => b[1].addedAt - a[1].addedAt)
    .map(([id, v]) => ({ ...getTitle(id), ...v }));

  return (
    <section>
      <h1>My List</h1>
      <div className="filters">
        {['watched', 'watchlist'].map((t) => (
          <button key={t} className={`chip ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'watched' ? 'Watched' : 'Watchlist'} ({Object.values(library).filter((v) => v.status === t).length})
          </button>
        ))}
      </div>
      {items.length ? (
        <ul className="list">
          {items.map((t) => (
            <li key={t.id} onClick={() => go(`/title/${t.id}`)}>
              <Poster title={t} size="sm" />
              <div>
                <strong>{t.title}</strong> <small className="muted">{t.year}</small>
                {t.status === 'watched' && <Stars value={t.rating} />}
                {t.review && <p className="muted small">“{t.review}”</p>}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">
          Nothing here yet. <button className="link" onClick={() => go('/')}>Explore titles →</button>
        </p>
      )}
    </section>
  );
}
