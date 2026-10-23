import { useState } from 'react';
import { getTitle, getUser } from '../data';
import { useStore } from '../store';
import { go } from '../router';
import Poster from '../components/Poster';
import Scores from '../components/Scores';
import Stars from '../components/Stars';

export default function TitleDetail({ id }) {
  const title = getTitle(id);
  const { library, saveTitle, removeTitle, friends, sendMessage } = useStore();
  const [sharing, setSharing] = useState(false);
  if (!title) return <p className="muted">Title not found.</p>;

  const saved = library[id];
  const friendFans = friends.map(getUser).filter((u) => u.favs.includes(id));

  const share = (friendId) => {
    sendMessage(friendId, `What did you think of ${title.title}?`, id);
    go(`/chat/${friendId}`);
  };

  return (
    <section className="detail">
      <button className="link" onClick={() => history.back()}>← Back</button>
      <div className="detail-head">
        <Poster title={title} size="lg" />
        <div>
          <h1>{title.title}</h1>
          <p className="muted">
            {title.year} · {title.type === 'show' ? 'Series' : 'Film'} · {title.genres.join(', ')}
          </p>
          <Scores title={title} />
          <p>{title.synopsis}</p>

          <div className="actions">
            <button
              className={saved?.status === 'watchlist' ? 'primary' : ''}
              onClick={() => saveTitle(id, { status: 'watchlist' })}
            >
              + Watchlist
            </button>
            <button
              className={saved?.status === 'watched' ? 'primary' : ''}
              onClick={() => saveTitle(id, { status: 'watched' })}
            >
              ✓ Watched
            </button>
            {saved && <button className="link" onClick={() => removeTitle(id)}>Remove</button>}
            <button onClick={() => setSharing(!sharing)}>💬 Discuss</button>
          </div>

          {sharing && (
            <div className="share">
              {friends.length ? (
                friends.map(getUser).map((u) => (
                  <button key={u.id} className="chip" onClick={() => share(u.id)}>
                    {u.name}
                  </button>
                ))
              ) : (
                <span className="muted">Add friends first.</span>
              )}
            </div>
          )}

          {friendFans.length > 0 && (
            <p className="muted small">❤️ Loved by {friendFans.map((u) => u.name.split(' ')[0]).join(', ')}</p>
          )}
        </div>
      </div>

      {saved && (
        <div className="panel">
          <h3>Your review</h3>
          <Stars value={saved.rating} onChange={(rating) => saveTitle(id, { rating, status: 'watched' })} />
          <textarea
            placeholder="What did you think?"
            value={saved.review}
            onChange={(e) => saveTitle(id, { review: e.target.value })}
          />
        </div>
      )}
    </section>
  );
}
