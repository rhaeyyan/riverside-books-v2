import { useId, useState } from 'react';
import { login, type StaffSession } from '../lib/staffAuth';
import './SignIn.css';

export function SignIn({ onSignIn }: { onSignIn: (staff: StaffSession) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const errorId = useId();
  const gatewayHref = import.meta.env.PROD ? '../' : '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const result = await login(email, password);
    setIsSubmitting(false);
    if (result.ok === false) {
      setError(result.error);
      return;
    }
    onSignIn(result.staff);
  };

  return (
    <div className="signin-screen">
      <div className="signin-card">
        <div className="signin-wordmark">Riverside Books</div>
        <div className="signin-eyebrow">Staff &amp; Ops sign in</div>
        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor="staff-email" className="signin-label">Email</label>
          <input
            id="staff-email"
            name="email"
            type="email"
            autoComplete="username"
            autoFocus
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(null); }}
            placeholder="you@riversidebooks.example"
            className="signin-input"
            aria-describedby={error ? errorId : undefined}
            aria-invalid={error ? true : undefined}
          />
          <label htmlFor="staff-password" className="signin-label signin-label--spaced">Password</label>
          <input
            id="staff-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(null); }}
            placeholder="••••••••"
            className="signin-input"
            aria-describedby={error ? errorId : undefined}
            aria-invalid={error ? true : undefined}
          />
          <div id={errorId} role="alert" className="signin-error">
            {error ?? ''}
          </div>
          <button type="submit" className="signin-submit" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <a href={gatewayHref} className="signin-back">&larr; Back to the shop</a>
      </div>
    </div>
  );
}
