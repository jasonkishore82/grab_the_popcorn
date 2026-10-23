import { useRoute } from './router';
import Explore from './pages/Explore';
import TitleDetail from './pages/TitleDetail';
import Library from './pages/Library';
import Friends from './pages/Friends';
import Chat from './pages/Chat';

const NAV = [
  ['/', 'Explore', ''],
  ['/library', 'My List', 'library'],
  ['/friends', 'Friends', 'friends'],
  ['/chat', 'Chats', 'chat'],
];

export default function App() {
  const [page, param] = useRoute();

  let view;
  if (page === 'title') view = <TitleDetail id={param} />;
  else if (page === 'library') view = <Library />;
  else if (page === 'friends') view = <Friends />;
  else if (page === 'chat') view = <Chat id={param} />;
  else view = <Explore />;

  return (
    <>
      <header className="topbar">
        <a href="#/" className="logo">🍿 Grab the Popcorn</a>
        <nav>
          {NAV.map(([href, label, key]) => (
            <a key={href} href={`#${href}`} className={(page || '') === key ? 'active' : ''}>
              {label}
            </a>
          ))}
        </nav>
      </header>
      <main>{view}</main>
    </>
  );
}
