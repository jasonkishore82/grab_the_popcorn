import { useRef, useState } from 'react';
import { api } from '../api';
import Icon from './Icon';

// Crop to the card's 4:5 shape and shrink, so the photo stays small enough to store with the account.
async function toPhoto(file) {
  const bitmap = await createImageBitmap(file);
  const W = 480;
  const H = 600;
  const scale = Math.max(W / bitmap.width, H / bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, (W - bitmap.width * scale) / 2, (H - bitmap.height * scale) / 2, bitmap.width * scale, bitmap.height * scale);
  for (const q of [0.86, 0.75, 0.62, 0.5]) {
    const url = canvas.toDataURL('image/jpeg', q);
    if (url.length < 190_000) return url;
  }
  throw new Error('That photo is too detailed. Try a smaller one.');
}

export default function EditProfile({ user, onClose, onSaved }) {
  const [bio, setBio] = useState(user.bio || '');
  const [avatar, setAvatar] = useState(user.avatar || null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const file = useRef(null);

  const pick = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError('');
    try {
      setAvatar(await toPhoto(f));
    } catch (err) {
      setError(err.message || 'Could not read that image');
    }
    e.target.value = '';
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/me/profile', { method: 'PUT', body: { bio, avatar } });
      onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="edit-title">
        <button className="btn btn-quiet btn-icon modal-close" onClick={onClose} aria-label="Close">
          <Icon name="x" size={18} />
        </button>
        <h2 id="edit-title">Edit your showcase</h2>
        <p className="muted modal-sub">This is what appears on your card.</p>
        <form className="auth-form" onSubmit={save}>
          <div className="photo-edit">
            <div className="photo-preview" style={avatar ? { backgroundImage: `url(${avatar})` } : undefined}>
              {!avatar && <Icon name="user" size={28} />}
            </div>
            <div className="photo-actions">
              <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" onChange={pick} hidden />
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => file.current.click()}>
                {avatar ? 'Change photo' : 'Add a photo'}
              </button>
              {avatar && (
                <button type="button" className="btn btn-quiet btn-sm" onClick={() => setAvatar(null)}>
                  Remove
                </button>
              )}
            </div>
          </div>
          <label>
            <span>Bio ({bio.length}/160)</span>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={160} rows={3} placeholder="A line about your taste in film" />
          </label>
          {error && (
            <p className="form-error" role="alert">
              <Icon name="alert" size={15} /> {error}
            </p>
          )}
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </form>
      </div>
    </div>
  );
}
