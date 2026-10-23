import { useEffect, useState } from 'react';
import { allTitles, kindLabel, runtimeLabel } from '../data';
import { useStore } from '../store';
import { api } from '../api';
import { go } from '../router';
import TitleCard from '../components/TitleCard';
import Row from '../components/Row';
import Poster from '../components/Poster';
import Scores from '../components/Scores';
import Icon from '../components/Icon';
import { Empty, Notice, SearchField, Segmented } from '../components/ui';

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
          {title.genres.length > 0 && (
            <>
              <i className="sep" />
              <span>{title.genres.slice(0, 3).join(' / ')}</span>
            </>
          )}
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
              onClick={() => saveTitle(title.id, { status: 'watchlist' }) && notify(`Added “${title.title}” to your watchlist`)}
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

const IDLE = { state: 'idle', items: [], source: null, omdb: null, added: 0 };
const dayPick = (list) => list[Math.floor(Date.now() / 864e5) % list.length];
const score = (t) => t.rt ?? (t.imdb != null ? t.imdb * 10 : 0);
const byScore = (a, b) => score(b) - score(a);

function noticeText(omdbConfigured, remoteOmdb) {
  if (remoteOmdb === 'denied') return 'OMDb refused the request (the key was rejected or the daily limit was reached), so only titles already in the shared catalogue are shown.';
  if (remoteOmdb === 'throttled') return 'You are searching a lot at the moment. Showing titles already in the shared catalogue; new lookups will work again in a few minutes.';
  if (remoteOmdb === 'unavailable') return 'OMDb did not answer, so only titles already in the shared catalogue are shown.';
  if (omdbConfigured === false || remoteOmdb === 'unconfigured') {
    return 'OMDb is not connected on this server, so only the starter titles and titles members have already added are available. Add OMDB_API_KEY to .env and restart to search the full IMDb catalogue.';
  }
  return null;
}

export default function Explore() {
  const { omdb, loadCatalog, addTitles } = useStore();
  const [q, setQ] = useState('');
  const [type, setType] = useState('all');
  const [genre, setGenre] = useState('All');
  const [remote, setRemote] = useState(IDLE);
  const term = q.trim();
  const filtering = Boolean(q) || type !== 'all' || genre !== 'All';

  useEffect(() => {
    loadCatalog(); // pick up titles other members have added since the last visit
  }, [loadCatalog]);

  // Search the shared catalogue; the server asks OMDb only for searches nobody has made before.
  useEffect(() => {
    if (term.length < 3 || genre !== 'All') {
      setRemote(IDLE);
      return undefined;
    }
    const ctl = new AbortController();
    setRemote((r) => ({ ...r, state: 'loading' }));
    const timer = setTimeout(async () => {
      try {
        const data = await api(`/search?q=${encodeURIComponent(term)}&kind=${type}`, { signal: ctl.signal });
        addTitles(data.results);
        setRemote({ state: 'done', items: data.results, source: data.source, omdb: data.omdb, added: data.added });
      } catch (e) {
        if (e.name !== 'AbortError') setRemote({ ...IDLE, state: 'error' });
      }
    }, 600);
    return () => {
      ctl.abort();
      clearTimeout(timer);
    };
  }, [term, type, genre, addTitles]);

  const titles = allTitles();
  const genres = ['All', ...[...new Set(titles.flatMap((t) => t.genres))].sort()];
  const local = titles.filter(
    (t) => t.title.toLowerCase().includes(q.trim().toLowerCase()) && (type === 'all' || t.type === type) && (genre === 'All' || t.genres.includes(genre)),
  );
  const results = remote.state === 'done' ? remote.items : local;
  const notice = noticeText(omdb, remote.omdb);

  const reset = () => {
    setQ('');
    setType('all');
    setGenre('All');
  };

  // Rows for the home view
  const featuredPool = titles.filter((t) => t.detailed && t.poster);
  const featured = dayPick(featuredPool.length ? featuredPool : titles);
  const critics = titles.filter((t) => t.rt != null).sort(byScore);
  const shows = titles.filter((t) => t.type === 'show').sort(byScore);
  const loved = titles.filter((t) => t.stats?.ratingCount > 0).sort((a, b) => b.stats.ratingAvg - a.stats.ratingAvg || b.stats.ratingCount - a.stats.ratingCount);
  const fresh = titles.filter((t) => !t.starter && !t.seeded).sort((a, b) => b.addedAt - a.addedAt);

  return (
    <>
      {!filtering && featured && <Hero title={featured} />}

      <div className="toolbar">
        <SearchField value={q} onChange={setQ} placeholder="Search any movie or series" />
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
        {genres.map((g) => (
          <button key={g} className={`chip ${genre === g ? 'on' : ''}`} onClick={() => setGenre(g)}>
            {g}
          </button>
        ))}
      </div>

      {notice && <Notice>{notice}</Notice>}

      {filtering ? (
        <section>
          <div className="section-head">
            <h2>Results</h2>
            <p>
              {remote.state === 'loading' ? 'Searching…' : `${results.length} ${results.length === 1 ? 'title' : 'titles'}`}
              {remote.state === 'done' && (
                <span className="source-tag">{remote.added > 0 ? `${remote.added} new saved for everyone` : remote.source === 'database' ? 'from the shared catalogue' : ''}</span>
              )}
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
            remote.state !== 'loading' && (
              <Empty icon="search" title="No matches" text={term ? `Nothing found for “${term}”.` : 'Try a different title, type or genre.'} action={<button className="btn btn-secondary" onClick={reset}>Clear filters</button>} />
            )
          )}
        </section>
      ) : (
        <>
          {loved.length > 0 && <Row title="Loved by members" subtitle="Highest average rating from people on Grab the Popcorn" items={loved.slice(0, 10)} />}
          {critics.length >= 3 && <Row title="Critics’ picks" subtitle="Highest on Rotten Tomatoes" items={critics.slice(0, 10)} />}
          {shows.length > 0 && <Row title="Series worth the binge" subtitle="Top-rated shows" items={shows.slice(0, 10)} />}
          {fresh.length > 0 && <Row title="Just added by members" subtitle="Titles someone searched for and saved to the shared catalogue" items={fresh.slice(0, 12)} />}
          <section>
            <div className="section-head">
              <h2>Browse everything</h2>
              <p>{titles.length} titles</p>
            </div>
            <div className="grid">
              {titles.map((t, i) => (
                <TitleCard key={t.id} title={t} index={i} />
              ))}
            </div>
          </section>
        </>
      )}
    </>
  );
}
