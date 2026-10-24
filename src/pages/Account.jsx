import { useEffect, useState } from 'react';
import { api } from '../api';
import { go } from '../router';
import { useStore } from '../store';
import { Empty } from '../components/ui';

// Pages opened from links in emails: #/verify/<token> and #/reset/<token>
const verifying = new Map(); // a link works once, so make sure it is only sent once even if React runs the effect twice

export function VerifyEmail({ token }) {
  const { refreshMe } = useStore();
  const [state, setState] = useState({ status: 'working', message: '' });

  useEffect(() => {
    let cancelled = false;
    if (!verifying.has(token)) verifying.set(token, api('/auth/verify', { method: 'POST', body: { token } }));
    verifying
      .get(token)
      .then(() => refreshMe().catch(() => {}))
      .then(() => !cancelled && setState({ status: 'ok', message: '' }))
      .catch((e) => !cancelled && setState({ status: 'error', message: e.message }));
    return () => {
      cancelled = true;
    };
  }, [token, refreshMe]);

  if (state.status === 'working') return <div className="shimmer detail-loading"><i /><i /></div>;
  return state.status === 'ok' ? (
    <Empty icon="check" title="Email confirmed" text="Thanks. Your email address is confirmed, so you can reset your password if you ever need to." action={<button className="btn btn-primary" onClick={() => go('/')}>Continue</button>} />
  ) : (
    <Empty icon="alert" title="That link did not work" text={`${state.message}. Sign in and ask for a new confirmation email.`} action={<button className="btn btn-secondary" onClick={() => go('/')}>Go to Explore</button>} />
  );
}

export function ResetPassword({ token }) {
  const { openAuth } = useStore();
  const [password, setPassword] = useState('');
  const [state, setState] = useState({ status: 'form', message: '' });

  const submit = async (e) => {
    e.preventDefault();
    setState({ status: 'saving', message: '' });
    try {
      await api('/auth/reset', { method: 'POST', body: { token, password } });
      setState({ status: 'done', message: '' });
    } catch (err) {
      setState({ status: 'form', message: err.message });
    }
  };

  if (state.status === 'done') {
    return <Empty icon="check" title="Password changed" text="You have been signed out everywhere. Sign in with your new password." action={<button className="btn btn-primary" onClick={() => { go('/'); setTimeout(() => openAuth('Sign in with your new password.'), 150); }}>Sign in</button>} />;
  }
  return (
    <div className="reset-page">
      <h1 className="display-sm">Choose a new password</h1>
      <form className="auth-form" onSubmit={submit}>
        <label>
          <span>New password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} required autoFocus placeholder="At least 8 characters" />
        </label>
        {state.message && <p className="form-error" role="alert">{state.message}</p>}
        <button className="btn btn-primary" disabled={state.status === 'saving'}>
          {state.status === 'saving' ? 'Saving…' : 'Change password'}
        </button>
      </form>
    </div>
  );
}
