import { useEffect, useState } from 'react';
import { useStore } from '../store';
import Icon from './Icon';

export default function AuthDialog() {
  const { authDialog, closeAuth, login, register } = useStore();
  const [mode, setMode] = useState('signin');
  const [form, setForm] = useState({ handle: '', name: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!authDialog) return undefined;
    setMode(authDialog.mode || 'signin');
    setError('');
    const onKey = (e) => e.key === 'Escape' && closeAuth();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [authDialog, closeAuth]);

  if (!authDialog) return null;
  const signup = mode === 'signup';
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (signup) await register(form.handle.trim(), form.name.trim(), form.password);
      else await login(form.handle.trim(), form.password);
      setForm({ handle: '', name: '', password: '' });
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && closeAuth()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="btn btn-quiet btn-icon modal-close" onClick={closeAuth} aria-label="Close">
          <Icon name="x" size={18} />
        </button>
        <img src="/logo.png" alt="" className="modal-logo" width="530" height="640" />
        <h2 id="auth-title">{signup ? 'Create your account' : 'Welcome back'}</h2>
        <p className="muted modal-sub">{authDialog.reason || (signup ? 'Join to rate, review and save titles. Everyone can see your ratings and comments.' : 'Sign in to rate, review and save titles.')}</p>

        <form onSubmit={submit} className="auth-form">
          <label>
            <span>Handle</span>
            <input value={form.handle} onChange={set('handle')} autoComplete="username" autoFocus required minLength={3} maxLength={20} pattern="[A-Za-z0-9_]{3,20}" title="3 to 20 letters, numbers or underscores" placeholder="e.g. maya_watches" />
          </label>
          {signup && (
            <label>
              <span>Display name</span>
              <input value={form.name} onChange={set('name')} autoComplete="name" required maxLength={40} placeholder="e.g. Maya Chen" />
            </label>
          )}
          <label>
            <span>Password</span>
            <input type="password" value={form.password} onChange={set('password')} autoComplete={signup ? 'new-password' : 'current-password'} required minLength={signup ? 8 : 1} placeholder={signup ? 'At least 8 characters' : ''} />
          </label>
          {error && (
            <p className="form-error" role="alert">
              <Icon name="alert" size={15} /> {error}
            </p>
          )}
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'One moment…' : signup ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <p className="modal-switch">
          {signup ? 'Already have an account?' : 'New here?'}{' '}
          <button
            className="link"
            onClick={() => {
              setMode(signup ? 'signin' : 'signup');
              setError('');
            }}
          >
            {signup ? 'Sign in' : 'Create an account'}
          </button>
        </p>
      </div>
    </div>
  );
}
