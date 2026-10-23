import { useEffect, useRef, useState } from 'react';
import { allTitles, getTitle, getUser, hueFor, isImdbId, kindLabel, timeAgo } from '../data';
import { useDetails, useStore } from '../store';
import { go } from '../router';
import Poster from '../components/Poster';
import Scores from '../components/Scores';
import Stars, { RATING_LABELS } from '../components/Stars';
import Icon from '../components/Icon';
import Avatar from '../components/Avatar';
import Row from '../components/Row';
import { Empty } from '../components/ui';

const hm = (min) => `${Math.floor(min / 60)}h ${min % 60}m`;

export default function TitleDetail({ id }) {
  const { library, saveTitle, adoptTitle, removeTitle, friends, sendMessage, notify, ensureDetails, loading } = useStore();
  // A link to an OMDb title we have not seen yet (e.g. opened from search): start from a stub, details fill it in.
  const title =
    getTitle(id) ??
    (isImdbId(id)
      ? { id, imdb: id, external: true, title: 'Loading…', year: null, type: 'movie', genres: [], synopsis: '', runtime: null, critics: null, audience: null, poster: null, hue: hueFor(id) }
      : undefined);
  const d = useDetails(id);
  const [sharing, setSharing] = useState(false);
  const pop = useRef(null);

  useEffect(() => {
    if (title) ensureDetails(title);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, ensureDetails]);

  useEffect(() => {
    if (!sharing) return;
    const close = (e) => (e.key === 'Escape' || (e.type === 'mousedown' && !pop.current?.contains(e.target))) && setSharing(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [sharing]);

  if (!title) {
    return <Empty icon="film" title="Title not found" action={<button className="btn btn-secondary" onClick={() => go('/')}>Back to Explore</button>} />;
  }

  const saved = library[id];
  const watched = saved?.status === 'watched';
  const fans = friends.map(getUser).filter((u) => u.favs.includes(id));
  const genres = title.genres?.length ? title.genres : d?.genres || [];
  const synopsis = d?.plot || title.synopsis;
  const isShow = (d?.type || title.type) === 'show';
  const minutes = d?.runtime ?? title.runtime;
  const waiting = loading[id] && !d;
  const similar = allTitles()
    .filter((t) => t.id !== id)
    .map((t) => ({ t, n: (t.genres || []).filter((g) => genres.includes(g)).length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n || (b.t.critics || 0) - (a.t.critics || 0))
    .slice(0, 8)
    .map((x) => x.t);

  const credits = d
    ? [
        d.director && ['Directed by', d.director],
        d.writer && [isShow ? 'Created by' : 'Written by', d.writer],
        d.actors.length > 0 && ['Starring', d.actors.join(', ')],
        d.released && ['Released', d.released],
        (d.country || d.language) && ['Country & language', [d.country, d.language].filter(Boolean).join(' · ')],
        d.awards && ['Awards', d.awards],
      ].filter(Boolean)
    : [];

  // Titles that came from OMDb search must be remembered before they can be saved.
  const save = (patch) => {
    adoptTitle(title);
    saveTitle(id, patch);
  };

  const setStatus = (status) => {
    if (saved?.status === status) return;
    save({ status });
    notify(status === 'watched' ? `Marked “${title.title}” as watched` : `Added “${title.title}” to your watchlist`);
  };

  const discuss = (friendId) => {
    sendMessage(friendId, `What did you think of ${title.title}?`, id);
    go(`/chat/${friendId}`);
  };

  return (
    <div className="detail" style={{ '--h': title.hue }}>
      <div className="detail-backdrop" />
      <button className="btn btn-quiet btn-sm back" onClick={() => (history.length > 1 ? history.back() : go('/'))}>
        <Icon name="arrowLeft" size={16} /> Back
      </button>

      <div className="detail-grid">
        <Poster title={title} size="lg" />
        <div className="detail-info">
          <div className="meta-row">
            <span className="tag">{kindLabel({ type: isShow ? 'show' : 'movie' })}</span>
            {title.year && <span>{title.year}</span>}
            {d?.rated && <span className="tag tag-outline tag-sm">{d.rated}</span>}
            {minutes && (
              <>
                <i className="sep" />
                <span>{isShow ? `${minutes} min episodes` : hm(minutes)}</span>
              </>
            )}
            {isShow && d?.seasons && (
              <>
                <i className="sep" />
                <span>
                  {d.seasons} season{d.seasons > 1 ? 's' : ''}
                </span>
              </>
            )}
          </div>
          <h1 className="display">{title.title}</h1>
          <div className="genre-tags">
            {genres.map((g) => (
              <span key={g} className="tag tag-outline">{g}</span>
            ))}
          </div>
          <Scores title={title} variant="large" />
          {synopsis ? <p className="synopsis">{synopsis}</p> : waiting && <div className="shimmer" aria-label="Loading details"><i /><i /><i /></div>}

          {credits.length > 0 && (
            <dl className="credits">
              {credits.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          )}

          <div className="btn-row">
            <button className={`btn ${watched ? 'btn-selected' : 'btn-primary'}`} onClick={() => setStatus('watched')}>
              <Icon name={watched ? 'check' : 'eye'} size={16} /> {watched ? 'Watched' : 'Mark as watched'}
            </button>
            <button className={`btn ${saved?.status === 'watchlist' ? 'btn-selected' : 'btn-secondary'}`} onClick={() => setStatus('watchlist')}>
              <Icon name="bookmark" size={16} /> {saved?.status === 'watchlist' ? 'On watchlist' : 'Watchlist'}
            </button>
            <div className="popover-wrap" ref={pop}>
              <button className="btn btn-secondary" onClick={() => setSharing((s) => !s)} aria-expanded={sharing}>
                <Icon name="message" size={16} /> Discuss
              </button>
              {sharing && (
                <div className="popover" role="menu">
                  <span className="popover-label">Start a conversation with</span>
                  {friends.length ? (
                    friends.map(getUser).map((u) => (
                      <button key={u.id} role="menuitem" className="popover-item" onClick={() => discuss(u.id)}>
                        <Avatar user={u} size={26} />
                        <span>{u.name}</span>
                      </button>
                    ))
                  ) : (
                    <button className="popover-item" onClick={() => go('/friends')}>
                      <Icon name="userPlus" size={16} /> Find friends first
                    </button>
                  )}
                </div>
              )}
            </div>
            <button className="btn btn-luna" onClick={() => go(`/luna/${id}`)}>
              <Icon name="moon" size={16} /> Ask Luna
            </button>
            {saved && (
              <button
                className="btn btn-quiet btn-icon"
                title="Remove from My List"
                aria-label="Remove from My List"
                onClick={() => {
                  removeTitle(id);
                  notify('Removed from My List');
                }}
              >
                <Icon name="trash" size={16} />
              </button>
            )}
          </div>

          {fans.length > 0 && (
            <div className="fans">
              <div className="avatar-stack">
                {fans.map((u) => (
                  <Avatar key={u.id} user={u} size={28} />
                ))}
              </div>
              <span>
                <Icon name="heart" size={13} fill strokeWidth={0} /> A favourite of {fans.map((u) => u.name.split(' ')[0]).join(' and ')}
              </span>
            </div>
          )}
        </div>
      </div>

      <section className="panel review-panel">
        <div className="panel-head">
          <div>
            <h2>Your review</h2>
            <p>{saved ? `Added ${timeAgo(saved.addedAt)}` : 'Rate it to add it to your watched list.'}</p>
          </div>
          {(saved?.rating > 0 || saved?.review) && (
            <span className="saved-hint">
              <Icon name="check" size={14} strokeWidth={2.4} /> Saved
            </span>
          )}
        </div>
        <div className="rate-row">
          <Stars
            value={saved?.rating || 0}
            size={28}
            onChange={(rating) => save({ rating, status: 'watched' })}
          />
          <span className="rate-label">{RATING_LABELS[saved?.rating || 0] || 'Tap a star'}</span>
        </div>
        <textarea
          placeholder="What did you think? Your friends will see this."
          value={saved?.review || ''}
          onChange={(e) => save({ review: e.target.value, status: saved?.status || 'watched' })}
          rows={4}
        />
      </section>

      {similar.length > 0 && <Row title="More like this" items={similar} />}
    </div>
  );
}
