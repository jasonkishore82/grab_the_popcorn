import Poster from './Poster';
import Scores from './Scores';
import { go } from '../router';
import { useStore } from '../store';

export default function TitleCard({ title }) {
  const { library } = useStore();
  const saved = library[title.id];
  return (
    <div className="card" onClick={() => go(`/title/${title.id}`)}>
      <Poster title={title} />
      {saved && <span className="badge">{saved.status === 'watched' ? '✓ Watched' : '+ List'}</span>}
      <div className="card-meta">
        <strong>{title.title}</strong>
        <small>
          {title.year} · {title.type === 'show' ? 'Series' : 'Film'}
        </small>
        <Scores title={title} />
      </div>
    </div>
  );
}
