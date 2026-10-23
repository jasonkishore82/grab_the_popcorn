import { useEffect, useRef, useState } from 'react';
import { allTitles, canonicalId, getTitle, kindLabel, timeAgo } from '../data';
import { useStore } from '../store';
import { go } from '../router';
import Poster from '../components/Poster';
import Scores from '../components/Scores';
import Stars, { RATING_LABELS } from '../components/Stars';
import Icon from '../components/Icon';
import Avatar from '../components/Avatar';
import Row from '../components/Row';
import { Empty, Notice } from '../components/ui';

const hm = (min) => `${Math.floor(min / 60)}h ${min % 60}m`;

// What everyone on the site thinks: the average, and every member's rating and comment.
function Community({ title, reviews, total, me }) {
  const st = title.stats;
  return (
    <section className="panel community">
      <div className="panel-head">
        <div>
          <h2>What members think</h2>
          <p>
            {st.ratingCount > 0
              ? `${st.ratingCount} rating${st.ratingCount > 1 ? 's' : ''} from members. Everyone can see these.`
              : 'No ratings yet. Be the first to rate it.'}
          </p>
        </div>
        {st.ratingCount > 0 && (
          <div className="community-avg" aria-label={`Average ${st.ratingAvg} out of 5`}>
            <strong>{st.ratingAvg.toFixed(1)}</strong>
            <Stars value={Math.round(st.ratingAvg)} size={16} />
          </div>
        )}
      </div>

      {reviews.length > 0 && (
        <ul className="reviews">
          {reviews.map((r) => (
            <li key={r.user.handle}>
              <Avatar user={r.user} size={36} />
              <div className="review-body">
                <div className="review-head">
                  <a href={`#/u/${r.user.handle}`}><strong>{r.user.name}</strong></a>
                  <span className="muted small">@{r.user.handle}</span>
                  {me?.handle === r.user.handle && <span className="tag tag-sm">You</span>}
                  <span className="muted small review-time">{timeAgo(r.updatedAt)}</span>
                </div>
                {r.rating > 0 && <Stars value={r.rating} size={14} />}
                {r.review && <p>{r.review}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {total > reviews.length && <p className="muted small">Showing the latest {reviews.length} of {total}.</p>}
    </section>
  );
}

export default function TitleDetail({ id }) {
  const { user, library, saveTitle, removeTitle, openAuth, social, sendChat, notify, loadTitle, saved } = useStore();
  const wanted = canonicalId(id);
  const title = getTitle(wanted);
  const [data, setData] = useState(null); // { reviews, reviewTotal, degraded } from the server
  const [error, setError] = useState(null);
  const [sharing, setSharing] = useState(false);
  const pop = useRef(null);
  const shownFor = useRef(null);

  // Load this title (and everyone's reviews) from the shared catalogue; load again after we save something.
  const tick = saved.id === wanted ? saved.at : 0;
  useEffect(() => {
    let cancelled = false;
    if (shownFor.current !== wanted) {
      setData(null);
      setError(null);
      shownFor.current = wanted;
    }
    loadTitle(wanted)
      .then((d) => {
        if (cancelled) return;
        if (d.title.id !== wanted) window.location.replace(`#/title/${d.title.id}`); // the starter title's id was corrected
        setData(d);
      })
      .catch((e) => !cancelled && setError(e));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted, tick, user?.id]);

  useEffect(() => {
    if (!sharing) return undefined;
    const close = (e) => (e.key === 'Escape' || (e.type === 'mousedown' && !pop.current?.contains(e.target))) && setSharing(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [sharing]);

  if (!title) {
    if (!error) return <div className="shimmer detail-loading" aria-label="Loading"><i /><i /><i /></div>;
    return <Empty icon="film" title="Title not found" text={error.status === 503 ? error.message : 'We could not find that title.'} action={<button className="btn btn-secondary" onClick={() => go('/')}>Back to Explore</button>} />;
  }

  const entry = library[title.id];
  const watched = entry?.status === 'watched';
  const isShow = title.type === 'show';
  const similar = allTitles()
    .filter((t) => t.id !== title.id)
    .map((t) => ({ t, n: t.genres.filter((g) => title.genres.includes(g)).length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n || (b.t.rt || 0) - (a.t.rt || 0))
    .slice(0, 8)
    .map((x) => x.t);

  const credits = title.detailed
    ? [
        title.director && ['Directed by', title.director],
        title.writer && [isShow ? 'Created by' : 'Written by', title.writer],
        title.actors.length > 0 && ['Starring', title.actors.join(', ')],
        title.released && ['Released', title.released],
        (title.country || title.language) && ['Country & language', [title.country, title.language].filter(Boolean).join(' · ')],
        title.awards && ['Awards', title.awards],
      ].filter(Boolean)
    : [];

  const setStatus = (status) => {
    if (entry?.status === status) return;
    if (saveTitle(title.id, { status })) notify(status === 'watched' ? `Marked “${title.title}” as watched` : `Added “${title.title}” to your watchlist`);
  };

  const discuss = async (handle) => {
    try {
      await sendChat(handle, `What did you think of ${title.title}?`, title.id);
      go(`/chat/${handle}`);
    } catch (e) {
      notify(e.message || 'Could not send that');
    }
  };

  const needAccount = () => !user && openAuth('Sign in to rate this and write a review. Everyone can see it.');

  return (
    <div className="detail" style={{ '--h': title.hue }}>
      <div className="detail-backdrop" />
      <button className="btn btn-quiet btn-sm back" onClick={() => (history.length > 1 ? history.back() : go('/'))}>
        <Icon name="arrowLeft" size={16} /> Back
      </button>

      {data?.degraded && <Notice>Full details could not be fetched from OMDb just now, so this is what the shared catalogue already has.</Notice>}

      <div className="detail-grid">
        <Poster title={title} size="lg" />
        <div className="detail-info">
          <div className="meta-row">
            <span className="tag">{kindLabel(title)}</span>
            {title.year && <span>{title.year}</span>}
            {title.rated && <span className="tag tag-outline tag-sm">{title.rated}</span>}
            {title.runtime && (
              <>
                <i className="sep" />
                <span>{isShow ? `${title.runtime} min episodes` : hm(title.runtime)}</span>
              </>
            )}
            {isShow && title.seasons && (
              <>
                <i className="sep" />
                <span>
                  {title.seasons} season{title.seasons > 1 ? 's' : ''}
                </span>
              </>
            )}
          </div>
          <h1 className="display">{title.title}</h1>
          <div className="genre-tags">
            {title.genres.map((g) => (
              <span key={g} className="tag tag-outline">{g}</span>
            ))}
          </div>
          <Scores title={title} variant="large" />
          {title.synopsis ? <p className="synopsis">{title.synopsis}</p> : !data && <div className="shimmer" aria-label="Loading details"><i /><i /><i /></div>}

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
            <button className={`btn ${entry?.status === 'watchlist' ? 'btn-selected' : 'btn-secondary'}`} onClick={() => setStatus('watchlist')}>
              <Icon name="bookmark" size={16} /> {entry?.status === 'watchlist' ? 'On watchlist' : 'Watchlist'}
            </button>
            <div className="popover-wrap" ref={pop}>
              <button className="btn btn-secondary" onClick={() => setSharing((s) => !s)} aria-expanded={sharing}>
                <Icon name="message" size={16} /> Discuss
              </button>
              {sharing && (
                <div className="popover" role="menu">
                  <span className="popover-label">Start a conversation with</span>
                  {social.friends.length ? (
                    social.friends.map((u) => (
                      <button key={u.handle} role="menuitem" className="popover-item" onClick={() => discuss(u.handle)}>
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
            {entry && (
              <button
                className="btn btn-quiet btn-icon"
                title="Remove from My List"
                aria-label="Remove from My List"
                onClick={() => {
                  removeTitle(title.id);
                  notify('Removed from My List');
                }}
              >
                <Icon name="trash" size={16} />
              </button>
            )}
          </div>

          {entry?.status === 'watched' && (
            <div className="watch-count">
              <span>You have watched this</span>
              <div className="stepper">
                <button aria-label="Fewer times" disabled={entry.timesWatched <= 1} onClick={() => saveTitle(title.id, { timesWatched: entry.timesWatched - 1 })}>−</button>
                <strong>{entry.timesWatched}</strong>
                <button aria-label="One more time" disabled={entry.timesWatched >= 999} onClick={() => saveTitle(title.id, { timesWatched: entry.timesWatched + 1 })}>+</button>
              </div>
              <span>{entry.timesWatched === 1 ? 'time' : 'times'}</span>
            </div>
          )}
        </div>
      </div>

      <section className="panel review-panel">
        <div className="panel-head">
          <div>
            <h2>Your review</h2>
            <p>{user ? (entry ? `Added ${timeAgo(entry.addedAt)}. Your rating and comment are public.` : 'Rate it to add it to your watched list. Your rating and comment are public.') : 'Sign in to rate this and write a review.'}</p>
          </div>
          {(entry?.rating > 0 || entry?.review) && (
            <span className="saved-hint">
              <Icon name="check" size={14} strokeWidth={2.4} /> Saved
            </span>
          )}
        </div>
        <div className="rate-row">
          <Stars value={entry?.rating || 0} size={28} onChange={(rating) => saveTitle(title.id, { rating, status: 'watched' })} />
          <span className="rate-label">{RATING_LABELS[entry?.rating || 0] || 'Tap a star'}</span>
        </div>
        <textarea
          placeholder={user ? 'What did you think? Everyone on ClapBoxes can read this.' : 'Sign in to write a review.'}
          value={entry?.review || ''}
          readOnly={!user}
          onFocus={needAccount}
          maxLength={2000}
          onChange={(e) => saveTitle(title.id, { review: e.target.value, status: entry?.status || 'watched' })}
          rows={4}
        />
        {!user && (
          <button className="btn btn-primary" onClick={needAccount}>
            Sign in to rate and review
          </button>
        )}
      </section>

      {data ? <Community title={title} reviews={data.reviews} total={data.reviewTotal} me={user} /> : !error && <div className="shimmer" aria-label="Loading reviews"><i /><i /></div>}

      {similar.length > 0 && <Row title="More like this" items={similar} />}
    </div>
  );
}
