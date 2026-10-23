import { useRoute } from './router';
import { useStore } from './store';
import { getUser } from './data';
import Icon, { Logo } from './components/Icon';
import Avatar from './components/Avatar';
import Explore from './pages/Explore';
import TitleDetail from './pages/TitleDetail';
import Library from './pages/Library';
import Friends from './pages/Friends';
import Chat from './pages/Chat';
import Luna from './pages/Luna';

const NAV = [
  { key: '', href: '/', label: 'Explore', icon: 'compass' },
  { key: 'library', href: '/library', label: 'My List', icon: 'bookmark' },
  { key: 'friends', href: '/friends', label: 'Friends', icon: 'users' },
  { key: 'chat', href: '/chat', label: 'Messages', icon: 'message' },
  { key: 'luna', href: '/luna', label: 'Ask Luna', icon: 'moon' },
];

function Brand() {
  return (
    <a href="#/" className="brand" aria-label="Grab the Popcorn home">
      <Logo />
      <span>
        Grab the <em>Popcorn</em>
      </span>
    </a>
  );
}

export default function App() {
  const [page = '', param] = useRoute();
  const { library, friends, toasts } = useStore();
  const listCount = Object.keys(library).length;

  let view;
  if (page === 'title') view = <TitleDetail id={param} />;
  else if (page === 'library') view = <Library />;
  else if (page === 'friends') view = <Friends />;
  else if (page === 'chat') view = <Chat id={param} />;
  else if (page === 'luna') view = <Luna key={param || ''} titleId={param} />;
  else view = <Explore />;

  return (
    <div className="shell">
      <aside className="sidebar">
        <Brand />
        <nav className="side-nav" aria-label="Main">
          {NAV.map((n) => (
            <a key={n.key} href={`#${n.href}`} className={`${page === n.key ? 'active' : ''} ${n.key === 'luna' ? 'is-luna' : ''}`}>
              <Icon name={n.icon} size={18} />
              <span>{n.label}</span>
              {n.key === 'library' && listCount > 0 && <span className="nav-count">{listCount}</span>}
            </a>
          ))}
        </nav>

        {friends.length > 0 && (
          <div className="side-section">
            <span className="side-label">Friends</span>
            {friends.slice(0, 5).map(getUser).map((u) => (
              <a key={u.id} href={`#/chat/${u.id}`} className="side-friend">
                <Avatar user={u} size={24} />
                <span>{u.name}</span>
              </a>
            ))}
          </div>
        )}

        <a href="#/luna" className="luna-card">
          <div className="moon" style={{ '--s': '34px' }} />
          <div>
            <strong>Not sure what to watch?</strong>
            <span>Ask Luna for a pick</span>
          </div>
        </a>
      </aside>

      <header className="mobile-top">
        <Brand />
      </header>

      <main className="content">
        <div className="page" key={`${page}/${param || ''}`}>
          {view}
        </div>
      </main>

      <nav className="tabbar" aria-label="Main">
        {NAV.map((n) => (
          <a key={n.key} href={`#${n.href}`} className={page === n.key ? 'active' : ''}>
            <Icon name={n.icon} size={20} />
            <span>{n.label === 'Ask Luna' ? 'Luna' : n.label}</span>
          </a>
        ))}
      </nav>

      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            <Icon name="check" size={15} strokeWidth={2.4} />
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
