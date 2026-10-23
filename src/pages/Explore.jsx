import { useState } from 'react';
import { TITLES, kindLabel, runtimeLabel } from '../data';
import { useStore } from '../store';
import { go } from '../router';
import TitleCard from '../components/TitleCard';
import Row from '../components/Row';
import Poster from '../components/Poster';
import Scores from '../components/Scores';
import Icon from '../components/Icon';
import { Empty, SearchField, Segmented } from '../components/ui';

const GENRES = ['All', ...[...new Set(TITLES.flatMap((t) => t.genres))].sort()];
const byCritics = [...TITLES].sort((a, b) => b.critics - a.critics);
const series = TITLES.filter((t) => t.type === 'show').sort((a, b) => b.audience - a.audience);
// Featured title rotates daily.
const featured = TITLES[Math.floor(Date.now() / 864e5) % TITLES.length];

function Hero({ title }) {
  const { library, saveTitle, notify } = useStore();
  const saved = library[title.id];
  return (
    <section className="hero" style={{ '--h': title.hue }}>
      <div className="hero-bg" />
      <div className="hero-content">
        <span className="eyebrow">
          <Icon name="sparkles" size={13} /> Featured tonight
        </span>
        <h1 className="display">{title.title}</h1>
        <div className="meta-row">
          <span>{kindLabel(title)}</span>
          <i className="sep" />
          <span>{title.year}</span>
          {title.runtime && (
            <>
              <i className="sep" />
              <span>{runtimeLabel(title)}</span>
            </>
          )}
          <i className="sep" />
          <span>{title.genres.join(' / ')}</span>
        </div>
        <p className="hero-synopsis">{title.synopsis}</p>
        <Scores title={title} />
        <div className="btn-row">
          <button className="btn btn-primary" onClick={() => go(`/title/${title.id}`)}>
            View details <Icon name="chevronRight" size={16} />
          </button>
          {saved ? (
            <button className="btn btn-selected" onClick={() => go('/library')}>
              <Icon name="check" size={16} /> In your list
            </button>
          ) : (
            <button
              className="btn btn-secondary"
              onClick={() => {
                saveTitle(title.id, { status: 'watchlist' });
                notify(`Added “${title.title}” to your watchlist`);
              }}
            >
              <Icon name="bookmark" size={16} /> Add to watchlist
            </button>
          )}
        </div>
      </div>
      <div className="hero-poster">
        <Poster title={title} size="lg" />
      </div>
    </section>
  );
}

export default function Explore() {
  const [q, setQ] = useState('');
  const [type, setType] = useState('all');
  const [genre, setGenre] = useState('All');
  const filtering = q || type !== 'all' || genre !== 'All';

  const results = TITLES.filter(
    (t) =>
      t.title.toLowerCase().includes(q.toLowerCase()) &&
      (type === 'all' || t.type === type) &&
      (genre === 'All' || t.genres.includes(genre)),
  );

  const reset = () => {
    setQ('');
    setType('all');
    setGenre('All');
  };

  return (
    <>
      {!filtering && <Hero title={featured} />}

      <div className="toolbar">
        <SearchField value={q} onChange={setQ} placeholder="Search movies and series" />
        <Segmented
          value={type}
          onChange={setType}
          options={[
            { value: 'all', label: 'All' },
            { value: 'movie', label: 'Films' },
            { value: 'show', label: 'Series' },
          ]}
        />
      </div>
      <div className="genre-row">
        {GENRES.map((g) => (
          <button key={g} className={`chip ${genre === g ? 'on' : ''}`} onClick={() => setGenre(g)}>
            {g}
          </button>
        ))}
      </div>

      {filtering ? (
        <section>
          <div className="section-head">
            <h2>Results</h2>
            <p>
              {results.length} {results.length === 1 ? 'title' : 'titles'}
              {filtering && (
                <button className="link" onClick={reset}>
                  Clear filters
                </button>
              )}
            </p>
          </div>
          {results.length ? (
            <div className="grid">
              {results.map((t, i) => (
                <TitleCard key={t.id} title={t} index={i} />
              ))}
            </div>
          ) : (
            <Empty icon="search" title="No matches" text="Try a different title, type or genre." action={<button className="btn btn-secondary" onClick={reset}>Clear filters</button>} />
          )}
        </section>
      ) : (
        <>
          <Row title="Critics’ picks" subtitle="The highest-rated titles right now" items={byCritics.slice(0, 10)} />
          <Row title="Series worth the binge" subtitle="Audience favourites" items={series} />
          <section>
            <div className="section-head">
              <h2>Browse everything</h2>
              <p>{TITLES.length} titles</p>
            </div>
            <div className="grid">
              {TITLES.map((t, i) => (
                <TitleCard key={t.id} title={t} index={i} />
              ))}
            </div>
          </section>
        </>
      )}
    </>
  );
}
