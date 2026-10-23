import { useState } from 'react';
import { USERS, getTitle } from '../data';
import { useStore } from '../store';
import { go } from '../router';
import Avatar from '../components/Avatar';

export default function Friends() {
  const { friends, toggleFriend } = useStore();
  const [q, setQ] = useState('');
  const query = q.toLowerCase();
  const people = USERS.filter((u) => u.name.toLowerCase().includes(query) || u.handle.includes(query));
  const shown = q ? people : people.filter((u) => friends.includes(u.id)).concat(people.filter((u) => !friends.includes(u.id)));

  return (
    <section>
      <h1>Friends</h1>
      <input className="search" placeholder="Search people by name or @handle…" value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="list">
        {shown.map((u) => {
          const isFriend = friends.includes(u.id);
          return (
            <li key={u.id} className="person">
              <Avatar user={u} />
              <div className="grow">
                <strong>{u.name}</strong> <small className="muted">@{u.handle}</small>
                <p className="muted small">{u.bio}</p>
                <p className="small">Favs: {u.favs.map((id) => getTitle(id).title).join(' · ')}</p>
              </div>
              <div className="stack">
                <button className={isFriend ? '' : 'primary'} onClick={() => toggleFriend(u.id)}>
                  {isFriend ? 'Friends ✓' : '+ Add'}
                </button>
                {isFriend && <button onClick={() => go(`/chat/${u.id}`)}>Chat</button>}
              </div>
            </li>
          );
        })}
        {!shown.length && <p className="muted">No one found.</p>}
      </ul>
    </section>
  );
}
