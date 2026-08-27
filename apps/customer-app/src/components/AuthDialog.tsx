import { useEffect, useId, useRef, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { login, register } from '../lib/customerSession';
import './AuthDialog.css';

// MyOrders.tsx and LoyaltyCard.tsx dispatch this on `window` to open sign-in
// from inside their own "sign in to see..." prompts, without lifting dialog
// state through props — the same decoupled-custom-event shape ChatPanel.tsx
// already uses for CHAT_ESCALATE_EVENT.
export const AUTH_OPEN_EVENT = 'riverside:auth-open';

type Mode = 'sign-in' | 'sign-up';

export default function AuthDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  // The element that had focus right before the dialog opened (usually the
  // "Sign in" button that triggered AUTH_OPEN_EVENT) — focus returns here on
  // close, same as ChatPanel's launcherRef pattern.
  const openerRef = useRef<HTMLElement | null>(null);
  const errorId = useId();
  const titleId = useId();

  const resetFields = () => {
    setEmail('');
    setPassword('');
    setName('');
    setPhone('');
    setError(null);
  };

  const close = () => {
    setIsOpen(false);
  };

  useEffect(() => {
    const handleOpen = () => {
      openerRef.current = document.activeElement as HTMLElement | null;
      setMode('sign-in');
      resetFields();
      setIsOpen(true);
    };
    window.addEventListener(AUTH_OPEN_EVENT, handleOpen);
    return () => window.removeEventListener(AUTH_OPEN_EVENT, handleOpen);
  }, []);

  // Focus moves into the dialog on open and back to whatever opened it on
  // close (mirrors ChatPanel.tsx). Modal, so Escape closes it and Tab is
  // trapped inside — unlike the non-modal chat panel, this is a true
  // interruption of the page (a form collecting a password), so leaving it
  // reachable is the wrong default.
  useEffect(() => {
    if (!isOpen) return;
    firstFieldRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        return;
      }
      if (e.key !== 'Tab') return;
      const container = dialogRef.current;
      if (!container) return;
      const focusable = container.querySelectorAll<HTMLElement>(
        'button, input, a[href], [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  // Runs after the close-triggered render, once the dialog has actually
  // unmounted, so the target element still exists to receive focus.
  useEffect(() => {
    if (!isOpen) openerRef.current?.focus();
  }, [isOpen]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result =
      mode === 'sign-in'
        ? await login(email.trim(), password)
        : await register(email.trim(), password, name.trim(), phone.trim() || undefined);
    setSubmitting(false);
    if (result.ok === false) {
      setError(result.error);
      return;
    }
    resetFields();
    close();
  };

  if (!isOpen) return null;

  return (
    <div
      className="auth-dialog-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={dialogRef}>
        <div className="auth-dialog-header">
          <h2 id={titleId} className="auth-dialog-title">
            {mode === 'sign-in' ? 'Sign in' : 'Create an account'}
          </h2>
          <button type="button" className="auth-dialog-close" onClick={close} aria-label="Close sign-in dialog">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-dialog-form" noValidate>
          {error && (
            <div className="auth-dialog-error" role="alert" id={errorId}>
              <AlertCircle size={16} aria-hidden="true" />
              {error}
            </div>
          )}

          <div className="auth-field">
            <label htmlFor="auth-email" className="auth-label">
              Email
            </label>
            <input
              id="auth-email"
              ref={firstFieldRef}
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="auth-input"
              aria-describedby={error ? errorId : undefined}
            />
          </div>

          {mode === 'sign-up' && (
            <div className="auth-field">
              <label htmlFor="auth-name" className="auth-label">
                Full name
              </label>
              <input
                id="auth-name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="auth-input"
              />
            </div>
          )}

          <div className="auth-field">
            <label htmlFor="auth-password" className="auth-label">
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              required
              minLength={mode === 'sign-up' ? 8 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="auth-input"
            />
          </div>

          {mode === 'sign-up' && (
            <div className="auth-field">
              <label htmlFor="auth-phone" className="auth-label">
                Phone <span className="auth-label-optional">(optional)</span>
              </label>
              <input
                id="auth-phone"
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="auth-input"
              />
            </div>
          )}

          <button type="submit" className="auth-submit" disabled={submitting}>
            {submitting
              ? mode === 'sign-in'
                ? 'Signing in…'
                : 'Creating account…'
              : mode === 'sign-in'
                ? 'Sign in'
                : 'Create account'}
          </button>

          <p className="auth-switch">
            {mode === 'sign-in' ? (
              <>
                New here?{' '}
                <button type="button" className="auth-switch-link" onClick={() => switchMode('sign-up')}>
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button type="button" className="auth-switch-link" onClick={() => switchMode('sign-in')}>
                  Sign in
                </button>
              </>
            )}
          </p>
        </form>
      </div>
    </div>
  );
}
