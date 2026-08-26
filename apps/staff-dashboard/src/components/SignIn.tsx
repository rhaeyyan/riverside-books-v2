import { useId, useState } from 'react';
import { resolvePin, setStaffSession } from '../lib/staffAuth';
import './SignIn.css';

export function SignIn({ onSignIn }: { onSignIn: (name: string) => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const errorId = useId();
  const gatewayHref = import.meta.env.PROD ? '../' : '/';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = resolvePin(pin);
    if (!name) {
      setError(true);
      return;
    }
    setStaffSession(name);
    onSignIn(name);
  };

  return (
    <div className="signin-screen">
      <div className="signin-card">
        <div className="signin-wordmark">Riverside Books</div>
        <div className="signin-eyebrow">Staff &amp; Ops sign in</div>
        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor="staff-pin" className="signin-label">Staff PIN</label>
          <input
            id="staff-pin"
            type="password"
            inputMode="numeric"
            autoFocus
            value={pin}
            onChange={(e) => { setPin(e.target.value); setError(false); }}
            placeholder="••••"
            className="signin-input"
            aria-describedby={error ? errorId : undefined}
            aria-invalid={error}
          />
          <div id={errorId} role="alert" className="signin-error">
            {error ? "That PIN doesn't match anyone on staff." : ''}
          </div>
          <button type="submit" className="signin-submit">Sign in</button>
        </form>
        <div className="signin-demo-hint">Demo PIN: 1234</div>
        <a href={gatewayHref} className="signin-back">&larr; Back to the shop</a>
      </div>
    </div>
  );
}
