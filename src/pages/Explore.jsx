import { useEffect, useState } from 'react';
import { TITLES, allTitles, hueFor, kindLabel, runtimeLabel } from '../data';
import { useStore } from '../store';
import { searchOmdb } from '../omdb';
import { go } from '../router';
import TitleCard from '../components/TitleCard';
import Row from '../components/Row';
import Poster from '../components/Poster';
import Scores from '../components/Scores';
import Icon from '../components/Icon';
import { Empty, Notice, SearchField, Segmented } from '../components/ui';

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

// A search result from OMDb, shaped like one of our titles.
const fromResult = (r) => ({
  id: r.imdb,
  imdb: r.imdb,
  external: true,
  title: r.title,
  year: r.year,
  type: r.type,
  genres: [],
  synopsis: '',
  runtime: null,
  critics: null,
  audience: null,
  poster: r.poster,
  hue: hueFor(r.imdb),
});

const noticeText = (kind, reason) =>
  kind === 'denied'
    ? `OMDb refused the request (${reason}). Check OMDB_API_KEY in .env, or try again tomorrow if the daily limit was reached.`
    : 'OMDb is not connected, so posters, cast and real ratings are not loading. Add your key as OMDB_API_KEY in .env and restart the server.';

export default function Explore() {
  const { omdb } = useStore();
  const [q, setQ] = useState('');
  const [type, setType] = useState('all');
  const [genre, setGenre] = useState('All');
  const [remote, setRemote] = useState({ state: 'idle', items: [], error: null });
  const filtering = q || type !== 'all' || genre !== 'All';
  const term = q.trim();

  // Search the wider OMDb catalogue once there is something to look for.
  useEffect(() => {
    if (term.length < 3 || genre !== 'All' || omdb.status === 'off') {
      setRemote({ state: 'idle', items: [], error: null });
      return undefined;
    }
    let cancelled = false;
    setRemote((r) => ({ ...r, state: 'loading', error: null }));
    const timer = setTimeout(async () => {
      try {
        const { results } = await searchOmdb(term, type);
        if (!cancelled) setRemote({ state: 'done', items: results, error: null });
      } catch (error) {
        if (!cancelled) setRemote({ state: 'error', items: [], error });
      }
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term, type, genre, omdb.status]);

  const results = allTitles().filter(
    (t) =>
      t.title.toLowerCase().includes(q.toLowerCase()) &&
      (type === 'all' || t.type === type) &&
      (genre === 'All' || t.genres.includes(genre)),
  );
  const known = new Set(allTitles().map((t) => t.imdb).filter(Boolean));
  const more = remote.items.filter((r) => !known.has(r.imdb)).map(fromResult);

  const failed = ['unconfigured', 'denied'].includes(remote.error?.kind) ? remote.error : null;
  const notice = omdb.status === 'off' ? noticeText(omdb.reason === 'unconfigured' ? 'unconfigured' : 'denied', omdb.reason) : failed ? noticeText(failed.kind, failed.message) : null;

  // True while the OMDb section is part of the page.
  const searchingRemote = term.length >= 3 && genre === 'All' && omdb.status !== 'off' && !failed;

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

      {notice && <Notice>{notice}</Notice>}

      {filtering ? (
        <>
          {(results.length > 0 || !searchingRemote) && (
          <section>
            <div className="section-head">
              <h2>Results</h2>
              <p>
                {results.length} {results.length === 1 ? 'title' : 'titles'}
                <button className="link" onClick={reset}>
                  Clear filters
                </button>
              </p>
            </div>
            {results.length ? (
              <div className="grid">
                {results.map((t, i) => (
                  <TitleCard key={t.id} title={t} index={i} />
                ))}
              </div>
            ) : (
              !searchingRemote && (
                <Empty icon="search" title="No matches" text="Try a different title, type or genre." action={<button className="btn btn-secondary" onClick={reset}>Clear filters</button>} />
              )
            )}
          </section>
          )}

          {searchingRemote && (
            <section>
              <div className="section-head">
                <h2>More from OMDb</h2>
                <p>
                  {remote.state === 'loading' ? 'Searching…' : `${more.length} ${more.length === 1 ? 'title' : 'titles'}`}
                  {!results.length && (
                    <button className="link" onClick={reset}>
                      Clear filters
                    </button>
                  )}
                </p>
              </div>
              {more.length > 0 && (
                <div className="grid">
                  {more.map((t, i) => (
                    <TitleCard key={t.id} title={t} index={i} />
                  ))}
                </div>
              )}
              {remote.state === 'done' && more.length === 0 && !results.length && (
                <Empty icon="search" title="No matches" text={`Nothing found for “${term}”.`} action={<button className="btn btn-secondary" onClick={reset}>Clear filters</button>} />
              )}
              {remote.state === 'error' && !failed && <p className="muted small">Could not search OMDb right now.</p>}
            </section>
          )}
        </>
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
