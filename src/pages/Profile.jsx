import { useEffect, useState } from 'react';
import { kindLabel } from '../data';
import { useStore } from '../store';
import { api } from '../api';
import { go } from '../router';
import Avatar from '../components/Avatar';
import Poster from '../components/Poster';
import Stars from '../components/Stars';
import Icon from '../components/Icon';
import PersonCard from '../components/PersonCard';
import { Empty, PageHead, Segmented } from '../components/ui';

const joined = (ts) => new Date(ts).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

const SORTS = {
  recent: () => 0,
  times: (a, b) => b.entry.timesWatched - a.entry.timesWatched,
  rating: (a, b) => b.entry.rating - a.entry.rating,
};

// A person's page: who they are and their Watchcase, every title they have watched and how many times.
export default function Profile({ handle }) {
  const { user, library, social, addTitles, saved } = useStore();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [sort, setSort] = useState('recent');

  useEffect(() => {
    let cancelled = false;
    setError(null);
    api(`/users/${handle}`)
      .then((d) => {
        if (cancelled) return;
        addTitles(d.watchcase.map((w) => w.title));
        setData(d);
      })
      .catch((e) => !cancelled && setError(e));
    return () => {
      cancelled = true;
    };
  }, [handle, saved.at, social.friends.length, social.outgoing.length, social.incoming.length, user?.id, addTitles]);

  if (error) {
    return <Empty icon="user" title="Person not found" text={`There is nobody with the username @${handle}.`} action={<button className="btn btn-secondary" onClick={() => go('/friends')}>Find friends</button>} />;
  }
  if (!data) return <div className="shimmer detail-loading"><i /><i /><i /></div>;

  const { stats } = data;
  const items = [...data.watchcase].sort(SORTS[sort]);
  const statCards = [
    { label: 'Titles watched', value: stats.titlesWatched, icon: 'eye' },
    { label: 'Total watches', value: stats.totalWatches, icon: 'refresh' },
    { label: 'Average rating', value: stats.averageRating ?? '–', icon: 'star' },
    { label: 'Reviews', value: stats.reviews, icon: 'pen' },
  ];

  return (
    <>
      <PageHead eyebrow={data.isMe ? 'Your profile' : 'Profile'} title={data.user.name} subtitle={`@${data.user.handle} · joined ${joined(data.user.joinedAt)}`}>
        <Avatar user={data.user} size={64} />
      </PageHead>

      {!data.isMe && user && (
        <div className="profile-actions">
          <div className="profile-card">
            <PersonCard bare person={data.user} relation={data.relation} onChange={() => {}} />
          </div>
        </div>
      )}
      {!user && <p className="muted">Sign in to add {data.user.name.split(' ')[0]} as a friend.</p>}

      <div className="stats">
        {statCards.map((s) => (
          <div key={s.label} className="stat">
            <Icon name={s.icon} size={16} />
            <strong>{s.value}</strong>
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      <div className="section-head">
        <h2>Watchcase</h2>
        <Segmented
          value={sort}
          onChange={setSort}
          options={[
            { value: 'recent', label: 'Recent' },
            { value: 'times', label: 'Rewatched' },
            { value: 'rating', label: 'Top' },
          ]}
        />
      </div>

      {items.length ? (
        <div className="case-grid">
          {items.map(({ title, entry }, i) => (
            <article key={title.id} className="case-item card" style={{ '--i': i % 12 }} onClick={() => go(`/title/${title.id}`)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && go(`/title/${title.id}`)}>
              <div className="card-poster">
                <Poster title={title} />
                {entry.timesWatched > 1 && <span className="times-badge">×{entry.timesWatched}</span>}
                {library[title.id]?.status === 'watched' && !data.isMe && <span className="badge watched"><Icon name="check" size={12} strokeWidth={2.4} /> You too</span>}
              </div>
              <div className="card-meta">
                <h3>{title.title}</h3>
                <div className="card-sub">
                  {title.year && <span>{title.year}</span>}
                  {title.year && <i className="sep" />}
                  <span>{kindLabel(title)}</span>
                </div>
                {entry.rating > 0 && <Stars value={entry.rating} size={13} />}
                <span className="muted small">{entry.timesWatched > 1 ? `Watched ${entry.timesWatched} times` : 'Watched once'}</span>
                {entry.review && <p className="case-review">“{entry.review}”</p>}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty icon="eye" title="Nothing in the Watchcase yet" text={data.isMe ? 'Mark titles as watched and they will appear here for your friends to see.' : `${data.user.name.split(' ')[0]} has not marked anything as watched yet.`} />
      )}
    </>
  );
}
