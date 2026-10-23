import { useEffect, useRef, useState } from 'react';
import { useRoute } from './router';
import { useTheme } from './theme';
import { useStore } from './store';
import { api } from './api';
import Icon from './components/Icon';
import Avatar from './components/Avatar';
import AuthDialog from './components/AuthDialog';
import Explore from './pages/Explore';
import TitleDetail from './pages/TitleDetail';
import Library from './pages/Library';
import Friends from './pages/Friends';
import Chat from './pages/Chat';
import Showcase from './pages/Showcase';
import { ResetPassword, VerifyEmail } from './pages/Account';
import { Notice } from './components/ui';
import Luna from './pages/Luna';

const NAV = [
  { key: '', href: '/', label: 'Explore', icon: 'compass' },
  { key: 'library', href: '/library', label: 'My List', icon: 'bookmark' },
  { key: 'showcase', href: '/showcase', label: 'Showcase', icon: 'film' },
  { key: 'friends', href: '/friends', label: 'Friends', icon: 'users' },
  { key: 'chat', href: '/chat', label: 'Messages', icon: 'message' },
  { key: 'luna', href: '/luna', label: 'Ask Luna', icon: 'moon' },
];

function Brand({ compact = false }) {
  if (!compact) {
    return (
      <a href="#/" className="brand brand-full" aria-label="Grab the Popcorn home">
        <img src="/logo.png" alt="Grab the Popcorn" width="530" height="640" />
      </a>
    );
  }
  return (
    <a href="#/" className="brand" aria-label="Grab the Popcorn home">
      <img src="/logo.png" alt="" width="530" height="640" />
      <span>
        Grab the <em>Popcorn</em>
      </span>
    </a>
  );
}

export default function App() {
  const [page = '', param] = useRoute();
  const { user, library, social, chat, emailOn, notify, toasts, openAuth, closeAuth, logout } = useStore();

  // Moving to another page (for example by opening an email link) closes the sign-in dialog.
  useEffect(() => {
    closeAuth();
  }, [page, param]); // eslint-disable-line react-hooks/exhaustive-deps
  const [theme, setTheme] = useTheme();
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menu) return undefined;
    const close = (e) => (e.key === 'Escape' || (e.type === 'mousedown' && !menuRef.current?.contains(e.target))) && setMenu(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [menu]);

  const listCount = Object.keys(library).length;

  let view;
  if (page === 'title') view = <TitleDetail id={param} />;
  else if (page === 'library') view = <Library />;
  else if (page === 'friends') view = <Friends />;
  else if (page === 'chat') view = <Chat id={param} />;
  else if (page === 'u' || page === 'showcase') view = <Showcase key={param || user?.handle || ''} handle={param} />;
  else if (page === 'verify') view = <VerifyEmail token={param} />;
  else if (page === 'reset') view = <ResetPassword token={param} />;
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
              {n.key === 'chat' && chat.unread > 0 && <span className="nav-count unread">{chat.unread}</span>}
              {n.key === 'friends' && social.incoming.length > 0 && <span className="nav-count unread">{social.incoming.length}</span>}
            </a>
          ))}
        </nav>

        {social.friends.length > 0 && (
          <div className="side-section">
            <span className="side-label">Friends</span>
            {social.friends.slice(0, 5).map((u) => (
              <a key={u.handle} href={`#/chat/${u.handle}`} className="side-friend">
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

        {user ? (
          <div className="account-card">
            <a href="#/showcase" className="account-link" title="Your showcase">
              <Avatar user={user} size={34} />
              <div className="grow">
                <strong className="ellipsis">{user.name}</strong>
                <span className="muted small ellipsis">@{user.handle}</span>
              </div>
            </a>
            <button className="btn btn-quiet btn-icon" onClick={logout} aria-label="Sign out" title="Sign out">
              <Icon name="logout" size={17} />
            </button>
          </div>
        ) : (
          <div className="account-card guest">
            <p>Join to rate, review and save titles. Everyone can see your ratings.</p>
            <div className="btn-row">
              <button className="btn btn-primary btn-sm" onClick={() => openAuth()}>Sign in</button>
              <button className="btn btn-secondary btn-sm" onClick={() => openAuth(undefined, 'signup')}>Create account</button>
            </div>
          </div>
        )}

        <div className="theme-switch" role="group" aria-label="Colour theme">
          <button className={theme === 'light' ? 'on' : ''} onClick={() => setTheme('light')} aria-pressed={theme === 'light'}>
            <Icon name="sun" size={15} /> Light
          </button>
          <button className={theme === 'dark' ? 'on' : ''} onClick={() => setTheme('dark')} aria-pressed={theme === 'dark'}>
            <Icon name="contrast" size={15} /> Dark
          </button>
        </div>
      </aside>

      <header className="mobile-top">
        <Brand compact />
        <button
          className="btn btn-quiet btn-icon"
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          title={theme === 'light' ? 'Dark mode' : 'Light mode'}
        >
          <Icon name={theme === 'light' ? 'contrast' : 'sun'} size={19} />
        </button>
        {user ? (
          <div className="popover-wrap" ref={menuRef}>
            <button className="account-btn" onClick={() => setMenu((m) => !m)} aria-label="Account" aria-expanded={menu}>
              <Avatar user={user} size={30} />
            </button>
            {menu && (
              <div className="popover popover-right" role="menu">
                <a className="popover-user" href="#/showcase" onClick={() => setMenu(false)}>
                  <strong>{user.name}</strong>
                  <span className="muted small">@{user.handle} · your showcase</span>
                </a>
                <button
                  className="popover-item"
                  role="menuitem"
                  onClick={() => {
                    setMenu(false);
                    logout();
                  }}
                >
                  <Icon name="logout" size={16} /> Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          <button className="btn btn-primary btn-sm" onClick={() => openAuth()}>
            Sign in
          </button>
        )}
      </header>

      <main className="content">
        <div className="page" key={`${page}/${param || ''}`}>
          {user && emailOn && user.email && !user.emailVerified && page !== 'verify' && (
            <Notice>
              Confirm your email address ({user.email}) so you can reset your password later. We sent you a link.{' '}
              <button
                className="link"
                onClick={() =>
                  api('/auth/resend', { method: 'POST' })
                    .then(() => notify('Confirmation email sent'))
                    .catch((e) => notify(e.message))
                }
              >
                Send it again
              </button>
            </Notice>
          )}
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

      <AuthDialog />

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
