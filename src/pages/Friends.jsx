import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { api } from '../api';
import PersonCard from '../components/PersonCard';
import { Empty, PageHead, SearchField } from '../components/ui';

export default function Friends() {
  const { user, ready, openAuth, social, refreshSocial } = useStore();
  const [q, setQ] = useState('');
  const [found, setFound] = useState({ q: '', people: [], loading: false });

  useEffect(() => {
    if (user) refreshSocial(); // requests may have arrived since the last check
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const term = q.trim().replace(/^@/, '');

  // Find people by username or name.
  const search = async (text, signal) => {
    setFound((f) => ({ ...f, loading: true }));
    try {
      const { people } = await api(`/users?q=${encodeURIComponent(text)}`, { signal });
      setFound({ q: text, people, loading: false });
    } catch (e) {
      if (e.name !== 'AbortError') setFound({ q: text, people: [], loading: false });
    }
  };
  useEffect(() => {
    if (term.length < 2) {
      setFound({ q: '', people: [], loading: false });
      return undefined;
    }
    const ctl = new AbortController();
    const timer = setTimeout(() => search(term, ctl.signal), 300);
    return () => {
      ctl.abort();
      clearTimeout(timer);
    };
  }, [term]);

  const after = () => {
    refreshSocial();
    if (term.length >= 2) search(term);
  };

  if (ready && !user) {
    return (
      <>
        <PageHead eyebrow="Community" title="Friends" subtitle="Find people by username, compare Showcases and chat." />
        <Empty
          icon="users"
          title="Sign in to find friends"
          text="Create an account to search for people, add friends and chat about what you watch."
          action={<button className="btn btn-primary" onClick={() => openAuth('Sign in to find friends and chat.')}>Sign in</button>}
        />
      </>
    );
  }

  const section = (title, list, relation, offset = 0) =>
    list.length > 0 && (
      <section>
        <div className="section-head">
          <h2>{title}</h2>
          <p>{list.length}</p>
        </div>
        <div className="people-grid">
          {list.map((p, i) => (
            <PersonCard key={p.handle} person={p} relation={relation ?? p.relation} onChange={after} index={i + offset} />
          ))}
        </div>
      </section>
    );

  return (
    <>
      <PageHead eyebrow="Community" title="Friends" subtitle="Find people by username, open their Showcase and chat about what you watch." />
      <div className="toolbar">
        <SearchField value={q} onChange={setQ} placeholder="Search by username or name, e.g. @maya" />
      </div>

      {term.length >= 2 ? (
        <>
          {found.loading && !found.people.length ? <p className="muted">Searching…</p> : null}
          {section('People', found.people)}
          {!found.loading && found.q === term && !found.people.length && <Empty icon="users" title="No one found" text={`Nobody matches “${term}”. Check the spelling of their username.`} />}
        </>
      ) : (
        <>
          {section('Friend requests', social.incoming, 'incoming')}
          {section('Your friends', social.friends, 'friends')}
          {section('Waiting for a reply', social.outgoing, 'requested')}
          {!social.friends.length && !social.incoming.length && !social.outgoing.length && (
            <Empty icon="users" title="No friends yet" text="Search for a username above to find people and send a friend request." />
          )}
        </>
      )}
    </>
  );
}
