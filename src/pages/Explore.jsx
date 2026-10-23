import { useState } from 'react';
import { TITLES } from '../data';
import TitleCard from '../components/TitleCard';

const GENRES = ['All', ...new Set(TITLES.flatMap((t) => t.genres))];

export default function Explore() {
  const [q, setQ] = useState('');
  const [type, setType] = useState('all');
  const [genre, setGenre] = useState('All');

  const results = TITLES.filter(
    (t) =>
      t.title.toLowerCase().includes(q.toLowerCase()) &&
      (type === 'all' || t.type === type) &&
      (genre === 'All' || t.genres.includes(genre)),
  );

  return (
    <section>
      <h1>Explore</h1>
      <input className="search" placeholder="Search movies and shows…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="filters">
        {['all', 'movie', 'show'].map((t) => (
          <button key={t} className={`chip ${type === t ? 'active' : ''}`} onClick={() => setType(t)}>
            {t === 'all' ? 'All' : t === 'movie' ? 'Movies' : 'Shows'}
          </button>
        ))}
        <select value={genre} onChange={(e) => setGenre(e.target.value)}>
          {GENRES.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
      </div>
      {results.length ? (
        <div className="grid">
          {results.map((t) => (
            <TitleCard key={t.id} title={t} />
          ))}
        </div>
      ) : (
        <p className="muted">Nothing matches “{q}”.</p>
      )}
    </section>
  );
}
