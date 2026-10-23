import { useState } from 'react';
import { USERS, getTitle } from '../data';
import { useStore } from '../store';
import { go } from '../router';
import Avatar from '../components/Avatar';
import Poster from '../components/Poster';
import Icon from '../components/Icon';
import { Empty, PageHead, SearchField } from '../components/ui';

// Share of a person's favourite genres that also show up in what you liked.
function tasteMatch(library, user) {
  const mine = new Set(
    Object.entries(library)
      .filter(([, v]) => !(v.rating && v.rating <= 2))
      .flatMap(([id]) => getTitle(id)?.genres || []),
  );
  if (!mine.size) return null;
  const theirs = [...new Set(user.favs.flatMap((id) => getTitle(id)?.genres ?? []))];
  return theirs.length ? Math.round((100 * theirs.filter((g) => mine.has(g)).length) / theirs.length) : null;
}

function PersonCard({ user, index }) {
  const { friends, toggleFriend, library, notify } = useStore();
  const isFriend = friends.includes(user.id);
  const match = tasteMatch(library, user);

  return (
    <article className="person-card" style={{ '--i': index }}>
      <div className="person-top">
        <Avatar user={user} size={46} />
        <div className="grow">
          <h3>{user.name}</h3>
          <span className="handle">@{user.handle}</span>
        </div>
        {match >= 20 && <span className={`match ${match >= 60 ? 'high' : ''}`}>{match}% match</span>}
      </div>
      <p className="bio">{user.bio}</p>
      <div className="fav-strip">
        {user.favs.map(getTitle).filter(Boolean).map((t) => (
          <button key={t.id} onClick={() => go(`/title/${t.id}`)} title={t.title}>
            <Poster title={t} size="sm" />
          </button>
        ))}
        <span className="fav-label">Favourites</span>
      </div>
      <div className="btn-row">
        {isFriend ? (
          <>
            <button className="btn btn-secondary grow" onClick={() => go(`/chat/${user.id}`)}>
              <Icon name="message" size={16} /> Message
            </button>
            <button
              className="btn btn-quiet"
              title="Remove friend"
              onClick={() => {
                toggleFriend(user.id);
                notify(`Removed ${user.name.split(' ')[0]} from friends`);
              }}
            >
              <Icon name="userCheck" size={16} /> Friends
            </button>
          </>
        ) : (
          <button
            className="btn btn-primary grow"
            onClick={() => {
              toggleFriend(user.id);
              notify(`You and ${user.name.split(' ')[0]} are now friends`);
            }}
          >
            <Icon name="userPlus" size={16} /> Add friend
          </button>
        )}
      </div>
    </article>
  );
}

export default function Friends() {
  const { friends } = useStore();
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase().replace(/^@/, '');
  const matches = USERS.filter((u) => u.name.toLowerCase().includes(query) || u.handle.includes(query));
  const mine = matches.filter((u) => friends.includes(u.id));
  const others = matches.filter((u) => !friends.includes(u.id));

  const section = (title, list, offset = 0) =>
    list.length > 0 && (
      <section>
        <div className="section-head">
          <h2>{title}</h2>
          <p>{list.length}</p>
        </div>
        <div className="people-grid">
          {list.map((u, i) => (
            <PersonCard key={u.id} user={u} index={i + offset} />
          ))}
        </div>
      </section>
    );

  return (
    <>
      <PageHead eyebrow="Community" title="Friends" subtitle="Find people, compare taste and start a conversation." />
      <div className="toolbar">
        <SearchField value={q} onChange={setQ} placeholder="Search by name or @handle" />
      </div>
      {section('Your friends', mine)}
      {section(q ? 'Other people' : 'People you may know', others, mine.length)}
      {!matches.length && <Empty icon="users" title="No one found" text={`Nobody matches “${q}”.`} />}
    </>
  );
}
