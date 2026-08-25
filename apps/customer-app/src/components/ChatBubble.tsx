import type { ReactNode } from 'react';
import { User } from 'lucide-react';

export type Sender = 'bot' | 'user';

const SPEAKER: Record<Sender, string> = {
  bot: 'Riverside Books said',
  user: 'You said',
};

/**
 * Shared presentation for both Product C surfaces — the floating ChatPanel and
 * the full-page Support view. Geometry follows design 2a (asymmetric bubble
 * radii, pill quick-replies, avatar chips); colour comes entirely from the
 * index.css tokens, so both light and dark schemes adapt on their own.
 */

const FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]';

export function Avatar({ sender }: { sender: Sender }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--accent-border)] bg-[var(--accent-bg)] text-sm font-bold text-[var(--text-h)]"
    >
      {sender === 'bot' ? 'R' : <User size={16} />}
    </span>
  );
}

export function Bubble({ sender, children }: { sender: Sender; children: ReactNode }) {
  const isBot = sender === 'bot';
  return (
    <div className={`flex items-end gap-2 ${isBot ? '' : 'flex-row-reverse'}`}>
      <Avatar sender={sender} />
      <div
        className={`max-w-[85%] px-5 py-3 text-[15px] leading-6 whitespace-pre-wrap text-[var(--text-h)] ${
          isBot
            ? 'rounded-[28px_28px_28px_10px] border border-[var(--border)] bg-[var(--code-bg)]'
            : 'rounded-[28px_28px_10px_28px] border border-[var(--accent-border)] bg-[var(--accent-bg)]'
        }`}
      >
        <span className="sr-only">{SPEAKER[sender]}: </span>
        {children}
      </div>
    </div>
  );
}

/**
 * A decision-tree option. Outlined rather than filled: `--accent` as a text or
 * background colour only reaches 4.39:1 against `--bg`, so the label carries
 * `--text-h` and the accent does the work on the 2px border, which only owes
 * 3:1 as a component boundary.
 */
export function QuickReply({
  onClick,
  children,
  type = 'button',
  filled = false,
}: {
  onClick?: () => void;
  children: ReactNode;
  type?: 'button' | 'submit';
  filled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`rounded-full border-2 border-[var(--accent)] px-5 py-2.5 text-left text-[15px] font-semibold text-[var(--text-h)] transition-colors ${FOCUS} ${
        filled ? 'bg-[var(--accent-bg)] hover:bg-[var(--bg)]' : 'bg-[var(--bg)] hover:bg-[var(--accent-bg)]'
      }`}
    >
      {children}
    </button>
  );
}

export function TypingDots() {
  return (
    <div className="flex items-end gap-2">
      <Avatar sender="bot" />
      <div className="flex items-center gap-1.5 rounded-[28px_28px_28px_10px] border border-[var(--border)] bg-[var(--code-bg)] px-5 py-4">
        <span className="sr-only">Riverside Books is typing</span>
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            aria-hidden="true"
            style={{ animationDelay: `${delay}ms` }}
            className="h-2 w-2 rounded-full bg-[var(--text)] motion-safe:animate-bounce"
          />
        ))}
      </div>
    </div>
  );
}

export function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
  required = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  multiline?: boolean;
  required?: boolean;
}) {
  const shared = `w-full rounded-2xl border border-[var(--text)] bg-[var(--bg)] px-4 py-2.5 text-[15px] text-[var(--text-h)] placeholder:text-[var(--text)] ${FOCUS}`;
  return (
    <>
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          required={required}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`${shared} min-h-[72px]`}
        />
      ) : (
        <input
          id={id}
          required={required}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={shared}
        />
      )}
    </>
  );
}
