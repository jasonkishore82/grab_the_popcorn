import { useEffect, useState } from 'react';
import FriendsDome from '../components/FriendsDome';
import DomeSheet from '../components/DomeSheet';
import { kindLabel, shapeTitle } from '../data';
import { useStore } from '../store';
import { api } from '../api';
import { go } from '../router';
import ProfileLanyard from '../components/ProfileLanyard';
import EditProfile from '../components/EditProfile';
import PersonCard from '../components/PersonCard';
import Poster from '../components/Poster';
import Stars from '../components/Stars';
import Icon from '../components/Icon';
import { Empty } from '../components/ui';

// A generated portrait for people who have not added a photo.
function portrait(user) {
  const hue = [...user.handle].reduce((a, c) => a + c.charCodeAt(0) * 37, 0) % 360;
  const initials = user.name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='500'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='hsl(${hue} 50% 52%)'/><stop offset='1' stop-color='hsl(${(hue + 50) % 360} 55% 18%)'/></linearGradient></defs><rect width='400' height='500' fill='url(#g)'/><text x='200' y='235' font-family='Georgia,serif' font-size='150' fill='white' fill-opacity='.9' text-anchor='middle'>${initials}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const when = (ts) => new Date(ts).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

// One "post": a watched title, big.
function Post({ item, onClose }) {
  const { title, entry } = item;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal post-modal" role="dialog" aria-modal="true" aria-label={title.title}>
        <button className="btn btn-quiet btn-icon modal-close" onClick={onClose} aria-label="Close">
          <Icon name="x" size={18} />
        </button>
        <div className="post-poster">
          <Poster title={title} size="lg" />
        </div>
        <div className="post-body">
          <h2>{title.title}</h2>
          <p className="muted small">
            {title.year} · {kindLabel(title)}
            {title.genres[0] ? ` · ${title.genres.slice(0, 2).join(', ')}` : ''}
          </p>
          {entry.rating > 0 && <Stars value={entry.rating} size={20} />}
          <p className="post-times">
            <Icon name="refresh" size={14} /> {entry.timesWatched > 1 ? `Watched ${entry.timesWatched} times` : 'Watched once'}
          </p>
          {entry.review ? <p className="post-review">“{entry.review}”</p> : <p className="muted small">No review written.</p>}
          <button className="btn btn-primary" onClick={() => go(`/title/${title.id}`)}>
            Open title <Icon name="chevronRight" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

// An Instagram-style page for what someone has watched: their card, numbers, and a grid.
export default function Showcase({ handle }) {
  const { user, ready, openAuth, library, addTitles, saved, social } = useStore();
  const who = handle || user?.handle;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('grid');
  const [open, setOpen] = useState(null);
  const [editing, setEditing] = useState(false);
  const [reload, setReload] = useState(0);
  const [dome, setDome] = useState(null);
  const [domeEditing, setDomeEditing] = useState(false);

  useEffect(() => {
    if (tab !== 'dome' || !who) return;
    api(`/users/${who}/dome`).then(setDome).catch(() => setDome({ members: [] }));
  }, [tab, who]);

  useEffect(() => {
    if (!who) return undefined;
    let cancelled = false;
    setError(null);
    api(`/users/${who}`)
      .then((d) => {
        if (cancelled) return;
        addTitles(d.watchcase.map((w) => w.title));
        setData({ ...d, watchcase: d.watchcase.map((w) => ({ ...w, title: shapeTitle(w.title) })) });
      })
      .catch((e) => !cancelled && setError(e));
    return () => {
      cancelled = true;
    };
  }, [who, saved.at, social.friends.length, social.outgoing.length, social.incoming.length, user?.id, reload, addTitles]);

  if (!who) {
    return ready ? (
      <Empty icon="film" title="Your showcase" text="Sign in to build your own showcase of everything you've watched, with a card to share." action={<button className="btn btn-primary" onClick={() => openAuth('Sign in to create your showcase.')}>Sign in</button>} />
    ) : null;
  }
  if (error) return <Empty icon="user" title="Person not found" text={`There is nobody with the username @${who}.`} action={<button className="btn btn-secondary" onClick={() => go('/friends')}>Find friends</button>} />;
  if (!data) return <div className="shimmer detail-loading"><i /><i /><i /></div>;

  const { user: owner, stats, isMe, relation } = data;
  const items = data.watchcase;
  const reviews = items.filter((i) => i.entry.review);
  const first = owner.name.split(' ')[0];

  const numbers = [
    [stats.titlesWatched, 'watched'],
    [stats.totalWatches, 'watches'],
    [stats.friends, 'friends'],
    [stats.averageRating ?? '–', 'avg rating'],
  ];

  return (
    <>
      <div className="showcase-head">
        <div className="showcase-lanyard">
          <ProfileLanyard person={{ avatar: owner.avatar || portrait(owner), name: owner.name, handle: owner.handle }} anchor="left" size={0.3} strapLength={1} cardColor="#8f9a8f" />
        </div>
        <div className="showcase-info">
          <div className="showcase-name">
            <h1>@{owner.handle}</h1>
            {isMe ? (
              <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
                <Icon name="pen" size={14} /> Edit profile
              </button>
            ) : (
              user && <PersonCard bare person={owner} relation={relation} onChange={() => setReload((n) => n + 1)} />
            )}
          </div>
          <ul className="showcase-numbers">
            {numbers.map(([n, label]) => (
              <li key={label}>
                <strong>{n}</strong> {label}
              </li>
            ))}
          </ul>
          <p className="showcase-bio">
            <strong>{owner.name}</strong>
            {owner.bio ? ` · ${owner.bio}` : ''}
          </p>
          <span className="muted small">Joined {when(owner.joinedAt)}</span>
          {!user && <span className="muted small">Sign in to add {first} as a friend.</span>}
        </div>
      </div>

      <div className="ig-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'grid'} className={tab === 'grid' ? 'on' : ''} onClick={() => setTab('grid')}>
          <Icon name="film" size={15} /> Watched
        </button>
        <button role="tab" aria-selected={tab === 'reviews'} className={tab === 'reviews' ? 'on' : ''} onClick={() => setTab('reviews')}>
          <Icon name="pen" size={15} /> Reviews <span className="count">{reviews.length}</span>
        </button>
        <button role="tab" aria-selected={tab === 'dome'} className={tab === 'dome' ? 'on' : ''} onClick={() => setTab('dome')}>
          <Icon name="users" size={15} /> Dome
        </button>
      </div>

      {tab === 'grid' &&
        (items.length ? (
          <div className="ig-grid">
            {items.map((item) => (
              <button key={item.title.id} className="ig-tile" onClick={() => setOpen(item)} aria-label={item.title.title}>
                <Poster title={item.title} />
                {item.entry.timesWatched > 1 && <span className="times-badge">×{item.entry.timesWatched}</span>}
                {!isMe && library[item.title.id]?.status === 'watched' && <span className="you-too" title="You've watched this too"><Icon name="check" size={12} strokeWidth={2.6} /></span>}
                <span className="ig-hover">
                  <strong>{item.title.title}</strong>
                  {item.entry.rating > 0 && <Stars value={item.entry.rating} size={13} />}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <Empty icon="eye" title="Nothing here yet" text={isMe ? 'Mark titles as watched and they will appear in your showcase.' : `${first} has not marked anything as watched yet.`} />
        ))}

      {tab === 'reviews' &&
        (reviews.length ? (
          <ul className="reviews showcase-reviews">
            {reviews.map(({ title, entry }) => (
              <li key={title.id}>
                <button className="rv-poster" onClick={() => go(`/title/${title.id}`)} aria-label={title.title}>
                  <Poster title={title} size="sm" />
                </button>
                <div className="review-body">
                  <div className="review-head">
                    <a href={`#/title/${title.id}`}><strong>{title.title}</strong></a>
                    <span className="muted small">{title.year}</span>
                  </div>
                  {entry.rating > 0 && <Stars value={entry.rating} size={14} />}
                  <p>{entry.review}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty icon="pen" title="No reviews yet" text={`${isMe ? 'Write' : `${first} has not written`} a comment on a watched title and it will show here.`} />
        ))}

      {tab === 'dome' &&
        (!dome ? null : dome.members.length ? (
          <>
            <div className="dome-stage"><FriendsDome members={dome.members} /></div>
            <div className="dome-foot">
              <span className="muted small">{dome.members.length} friend{dome.members.length === 1 ? '' : 's'}. Drag to turn, tap a picture to enlarge.</span>
              {isMe && <button className="btn btn-secondary btn-sm" onClick={() => setDomeEditing(true)}>Edit dome</button>}
            </div>
          </>
        ) : (
          <Empty
            icon="users"
            title="No friends in the dome"
            text={isMe ? 'Choose friends to show here.' : `${first} has not added anyone yet.`}
            action={isMe ? <button className="btn btn-primary" onClick={() => setDomeEditing(true)}>Choose friends</button> : undefined}
          />
        ))}

      {domeEditing && <DomeSheet members={dome?.members ?? []} onChange={setDome} onClose={() => setDomeEditing(false)} />}
      {open && <Post item={open} onClose={() => setOpen(null)} />}
      {editing && <EditProfile user={owner} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); setReload((n) => n + 1); }} />}
    </>
  );
}
