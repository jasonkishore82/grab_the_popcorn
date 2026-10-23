import { useEffect, useRef, useState } from 'react';
import { TITLES, getTitle, getUser, kindLabel, runtimeLabel, timeAgo } from '../data';
import { useStore } from '../store';
import { go } from '../router';
import Poster from '../components/Poster';
import Scores from '../components/Scores';
import Stars, { RATING_LABELS } from '../components/Stars';
import Icon from '../components/Icon';
import Avatar from '../components/Avatar';
import Row from '../components/Row';
import { Empty } from '../components/ui';

export default function TitleDetail({ id }) {
  const title = getTitle(id);
  const { library, saveTitle, removeTitle, friends, sendMessage, notify } = useStore();
  const [sharing, setSharing] = useState(false);
  const pop = useRef(null);

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
  const similar = TITLES.filter((t) => t.id !== id)
    .map((t) => ({ t, n: t.genres.filter((g) => title.genres.includes(g)).length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n || b.t.critics - a.t.critics)
    .slice(0, 8)
    .map((x) => x.t);

  const setStatus = (status) => {
    if (saved?.status === status) return;
    saveTitle(id, { status });
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
            <span className="tag">{kindLabel(title)}</span>
            <span>{title.year}</span>
            {title.runtime && (
              <>
                <i className="sep" />
                <span>{runtimeLabel(title)}</span>
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
          <p className="synopsis">{title.synopsis}</p>

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
          <Stars value={saved?.rating || 0} size={28} onChange={(rating) => saveTitle(id, { rating, status: 'watched' })} />
          <span className="rate-label">{RATING_LABELS[saved?.rating || 0] || 'Tap a star'}</span>
        </div>
        <textarea
          placeholder="What did you think? Your friends will see this."
          value={saved?.review || ''}
          onChange={(e) => saveTitle(id, { review: e.target.value, status: saved?.status || 'watched' })}
          rows={4}
        />
      </section>

      {similar.length > 0 && <Row title="More like this" items={similar} />}
    </div>
  );
}
