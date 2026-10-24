import { useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api';
import { useStore } from '../store';
import Avatar from './Avatar';
import Icon from './Icon';

// Pick which friends appear in your dome: one row per friend with a switch.
export default function DomeSheet({ members, onChange, onClose }) {
  const { social } = useStore();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const on = new Set(members.map((m) => m.handle));

  const flip = async (handle) => {
    setBusy(handle);
    setError('');
    try {
      onChange(await api(`/dome/${handle}`, { method: on.has(handle) ? 'DELETE' : 'PUT' }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal sheet" role="dialog" aria-modal="true" aria-labelledby="dome-sheet-title">
        <button className="btn btn-quiet btn-icon modal-close" onClick={onClose} aria-label="Close">
          <Icon name="x" size={18} />
        </button>
        <h2 id="dome-sheet-title">Friends Dome</h2>
        <p className="muted modal-sub">Only friends can be added. {members.length} of 40.</p>
        {social.friends.length ? (
          <ul className="sheet-list">
            {social.friends.map((f) => (
              <li key={f.handle}>
                {f.avatarUrl ? <img className="avatar" src={f.avatarUrl} alt="" width="36" height="36" /> : <Avatar user={f} size={36} />}
                <span className="sheet-name">
                  <strong>{f.name}</strong>
                  <span className="muted small">@{f.handle}</span>
                </span>
                <button
                  role="switch"
                  aria-checked={on.has(f.handle)}
                  aria-label={`${f.name} in dome`}
                  className="switch"
                  disabled={busy === f.handle}
                  onClick={() => flip(f.handle)}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Add friends first, then you can choose who appears here.</p>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-primary sheet-done" onClick={onClose}>Done</button>
      </div>
    </div>,
    document.body,
  );
}
