import { useState } from 'react';
import { go } from '../router';
import { useStore } from '../store';
import Avatar from './Avatar';
import Icon from './Icon';

// One person, with the right button for how they relate to you: add, requested, accept, message.
export default function PersonCard({ person, relation, onChange, index = 0, bare = false }) {
  const { addFriend, removeFriend, notify } = useStore();
  const [busy, setBusy] = useState(false);
  const first = person.name.split(' ')[0];

  const run = async (fn, message) => {
    setBusy(true);
    try {
      await fn();
      if (message) notify(message);
      onChange?.();
    } catch (e) {
      notify(e.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className={bare ? 'person-bare' : 'person-card'} style={{ '--i': index }}>
      {!bare && (
      <div className="person-top">
        <a href={`#/u/${person.handle}`} aria-label={`${person.name}'s profile`}>
          <Avatar user={person} size={46} />
        </a>
        <div className="grow">
          <h3>
            <a href={`#/u/${person.handle}`}>{person.name}</a>
          </h3>
          <span className="handle">@{person.handle}</span>
        </div>
        {person.watched != null && <span className="match">{person.watched} watched</span>}
      </div>
      )}
      <div className="btn-row">
        {relation === 'friends' && (
          <>
            <button className="btn btn-secondary grow" onClick={() => go(`/chat/${person.handle}`)}>
              <Icon name="message" size={16} /> Message
            </button>
            <button className="btn btn-quiet" disabled={busy} title="Remove friend" onClick={() => run(() => removeFriend(person.handle), `Removed ${first} from friends`)}>
              <Icon name="userCheck" size={16} /> Friends
            </button>
          </>
        )}
        {relation === 'incoming' && (
          <>
            <button className="btn btn-primary grow" disabled={busy} onClick={() => run(() => addFriend(person.handle), `You and ${first} are now friends`)}>
              <Icon name="check" size={16} /> Accept
            </button>
            <button className="btn btn-quiet" disabled={busy} onClick={() => run(() => removeFriend(person.handle))}>
              Decline
            </button>
          </>
        )}
        {relation === 'requested' && (
          <button className="btn btn-selected grow" disabled={busy} title="Cancel request" onClick={() => run(() => removeFriend(person.handle), 'Request cancelled')}>
            <Icon name="clock" size={16} /> Requested
          </button>
        )}
        {relation === 'none' && (
          <button className="btn btn-primary grow" disabled={busy} onClick={() => run(() => addFriend(person.handle), `Friend request sent to ${first}`)}>
            <Icon name="userPlus" size={16} /> Add friend
          </button>
        )}
      </div>
    </article>
  );
}
