import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { api } from '../api';
import Icon from './Icon';

const TITLES = { signin: 'Welcome back', signup: 'Create your account', forgot: 'Reset your password' };

export default function AuthDialog() {
  const { authDialog, closeAuth, login, register, emailOn } = useStore();
  const [mode, setMode] = useState('signin');
  const [form, setForm] = useState({ handle: '', name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!authDialog) return undefined;
    setMode(authDialog.mode || 'signin');
    setError('');
    setInfo('');
    const onKey = (e) => e.key === 'Escape' && closeAuth();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [authDialog, closeAuth]);

  if (!authDialog) return null;
  const signup = mode === 'signup';
  const forgot = mode === 'forgot';
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const go = (m) => {
    setMode(m);
    setError('');
    setInfo('');
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (forgot) {
        await api('/auth/forgot', { method: 'POST', body: { email: form.email.trim() } });
        setInfo(emailOn ? 'If an account uses that email, a reset link is on its way. It works for one hour.' : 'This server cannot send email yet, so no reset link was sent. Ask the site owner to set up email.');
      } else if (signup) {
        await register(form.handle.trim(), form.name.trim(), form.email.trim(), form.password);
        setForm({ handle: '', name: '', email: '', password: '' });
      } else {
        await login(form.handle.trim(), form.password);
        setForm({ handle: '', name: '', email: '', password: '' });
      }
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const subtitle = forgot
    ? 'Enter the email you signed up with and we will send you a link.'
    : authDialog.reason || (signup ? 'Join to rate, review, make friends and chat. Everyone can see your ratings and Showcase.' : 'Sign in to rate, review and chat with friends.');

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && closeAuth()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="btn btn-quiet btn-icon modal-close" onClick={closeAuth} aria-label="Close">
          <Icon name="x" size={18} />
        </button>
        <img src="/logo.png" alt="" className="modal-logo" width="530" height="640" />
        <h2 id="auth-title">{TITLES[mode]}</h2>
        <p className="muted modal-sub">{subtitle}</p>

        <form onSubmit={submit} className="auth-form">
          {!forgot && (
            <label>
              <span>Username</span>
              <input value={form.handle} onChange={set('handle')} autoComplete="username" autoFocus required minLength={3} maxLength={20} pattern="[A-Za-z0-9_]{3,20}" title="3 to 20 letters, numbers or underscores" placeholder="e.g. maya_watches" />
            </label>
          )}
          {signup && (
            <label>
              <span>Display name</span>
              <input value={form.name} onChange={set('name')} autoComplete="name" required maxLength={40} placeholder="e.g. Maya Chen" />
            </label>
          )}
          {(signup || forgot) && (
            <label>
              <span>Email</span>
              <input type="email" value={form.email} onChange={set('email')} autoComplete="email" required autoFocus={forgot} placeholder="you@example.com" />
            </label>
          )}
          {!forgot && (
            <label>
              <span>Password</span>
              <input type="password" value={form.password} onChange={set('password')} autoComplete={signup ? 'new-password' : 'current-password'} required minLength={signup ? 8 : 1} placeholder={signup ? 'At least 8 characters' : ''} />
            </label>
          )}
          {error && (
            <p className="form-error" role="alert">
              <Icon name="alert" size={15} /> {error}
            </p>
          )}
          {info && <p className="form-info" role="status">{info}</p>}
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'One moment…' : forgot ? 'Send reset link' : signup ? 'Create account' : 'Sign in'}
          </button>
        </form>

        {mode === 'signin' && (
          <p className="modal-switch">
            <button className="link" onClick={() => go('forgot')}>Forgot your password?</button>
          </p>
        )}
        <p className="modal-switch">
          {forgot ? (
            <button className="link" onClick={() => go('signin')}>Back to sign in</button>
          ) : (
            <>
              {signup ? 'Already have an account?' : 'New here?'}{' '}
              <button className="link" onClick={() => go(signup ? 'signin' : 'signup')}>
                {signup ? 'Sign in' : 'Create an account'}
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
