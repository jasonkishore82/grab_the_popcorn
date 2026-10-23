import Poster from './Poster';
import Scores from './Scores';
import Icon from './Icon';
import { kindLabel } from '../data';
import { go } from '../router';
import { useStore } from '../store';

export default function TitleCard({ title, index = 0 }) {
  const { library, saveTitle, notify } = useStore();
  const saved = library[title.id];
  const open = () => go(`/title/${title.id}`);

  const quickAdd = (e) => {
    e.stopPropagation();
    if (saveTitle(title.id, { status: 'watchlist' })) notify(`Added “${title.title}” to your watchlist`);
  };

  return (
    <article className="card" style={{ '--i': index % 12 }} onClick={open} onKeyDown={(e) => e.key === 'Enter' && open()} tabIndex={0} aria-label={title.title}>
      <div className="card-poster">
        <Poster title={title} />
        {saved ? (
          <span className={`badge ${saved.status}`}>
            <Icon name={saved.status === 'watched' ? 'check' : 'bookmark'} size={12} strokeWidth={2.4} />
            {saved.status === 'watched' ? 'Watched' : 'Watchlist'}
          </span>
        ) : (
          <button className="quick" onClick={quickAdd} aria-label={`Add ${title.title} to watchlist`} title="Add to watchlist">
            <Icon name="plus" size={16} strokeWidth={2.2} />
          </button>
        )}
      </div>
      <div className="card-meta">
        <h3>{title.title}</h3>
        <div className="card-sub">
          {title.year && <span>{title.year}</span>}
          {title.year && <i className="sep" />}
          <span>{title.genres?.[0] || kindLabel(title)}</span>
        </div>
        <Scores title={title} />
      </div>
    </article>
  );
}
