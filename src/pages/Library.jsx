import { useState } from 'react';
import { getTitle, kindLabel, timeAgo } from '../data';
import { useStore } from '../store';
import { go } from '../router';
import Poster from '../components/Poster';
import Stars from '../components/Stars';
import Icon from '../components/Icon';
import { Empty, PageHead, Segmented } from '../components/ui';

export default function Library() {
  const { library, user, ready, openAuth } = useStore();
  const [tab, setTab] = useState('watched');

  const all = Object.entries(library)
    .map(([id, v]) => ({ ...getTitle(id), ...v }))
    .filter((t) => t.title);
  const watched = all.filter((t) => t.status === 'watched');
  const rated = watched.filter((t) => t.rating > 0);
  const minutes = watched.filter((t) => t.type === 'movie').reduce((m, t) => m + (t.runtime || 0), 0);
  const items = all.filter((t) => t.status === tab).sort((a, b) => b.addedAt - a.addedAt);

  const stats = [
    { label: 'Watched', value: watched.length, icon: 'eye' },
    { label: 'Watchlist', value: all.length - watched.length, icon: 'bookmark' },
    { label: 'Avg. rating', value: rated.length ? (rated.reduce((s, t) => s + t.rating, 0) / rated.length).toFixed(1) : '–', icon: 'star' },
    { label: 'Hours of film', value: Math.round(minutes / 60), icon: 'clock' },
  ];

  if (ready && !user) {
    return (
      <>
        <PageHead eyebrow="Your collection" title="My List" subtitle="Everything you’ve watched, rated and saved for later." />
        <Empty
          icon="user"
          title="Sign in to see your list"
          text="Your watchlist, watched titles, ratings and reviews are saved to your account, so they follow you to any device."
          action={
            <div className="btn-row center">
              <button className="btn btn-primary" onClick={() => openAuth('Sign in to see and build your list.')}>Sign in</button>
              <button className="btn btn-secondary" onClick={() => openAuth('Create an account to save titles, rate and review them.', 'signup')}>Create account</button>
            </div>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHead eyebrow="Your collection" title="My List" subtitle="Everything you’ve watched, rated and saved for later." />

      <div className="stats">
        {stats.map((s) => (
          <div key={s.label} className="stat">
            <Icon name={s.icon} size={16} />
            <strong>{s.value}</strong>
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'watched', label: 'Watched', count: watched.length },
          { value: 'watchlist', label: 'Watchlist', count: all.length - watched.length },
        ]}
      />

      {items.length ? (
        <ul className="entries">
          {items.map((t, i) => (
            <li key={t.id} style={{ '--i': i % 12 }}>
              <button className="entry" onClick={() => go(`/title/${t.id}`)}>
                <Poster title={t} size="sm" />
                <div className="entry-main">
                  <h3>{t.title}</h3>
                  <div className="card-sub">
                    <span>{t.year}</span>
                    <i className="sep" />
                    <span>{kindLabel(t)}</span>
                    <i className="sep hide-sm" />
                    <span className="hide-sm">{t.genres.join(', ')}</span>
                  </div>
                  {t.review && <p className="entry-review">“{t.review}”</p>}
                </div>
                <div className="entry-side">
                  {t.status === 'watched' ? (
                    t.rating ? <Stars value={t.rating} size={14} /> : <span className="muted small">Not rated</span>
                  ) : null}
                  {t.status === 'watched' && t.timesWatched > 1 && <span className="muted small">Watched {t.timesWatched}×</span>}
                  <span className="muted small">{timeAgo(t.addedAt)}</span>
                </div>
                <Icon name="chevronRight" size={18} className="entry-chevron" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <Empty
          icon={tab === 'watched' ? 'eye' : 'bookmark'}
          title={tab === 'watched' ? 'Nothing watched yet' : 'Your watchlist is empty'}
          text={tab === 'watched' ? 'Mark titles as watched and rate them to build your diary.' : 'Save titles you want to see and they’ll wait for you here.'}
          action={<button className="btn btn-primary" onClick={() => go('/')}>Explore titles</button>}
        />
      )}
    </>
  );
}
