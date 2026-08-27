import { useEffect, useRef, useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { Bubble, QuickReply, TextField, TypingDots } from './ChatBubble';
import { useChatSession } from '../hooks/useChatSession';

// Home.tsx's "Ask a bookseller" CTAs dispatch this on `window` to jump the
// panel straight to the escalation form, whether the panel is closed (open
// it and skip the root greeting) or already open on the root tree (transition
// in place). A same-weight sibling to the existing
// `document.getElementById("chatbot-toggle")?.click()` DOM-coupling pattern,
// just decoupled from a specific element id so it also works while the panel
// is already open — no new state-management dependency.
export const CHAT_ESCALATE_EVENT = 'riverside:chat-escalate';

export default function ChatPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const {
    history,
    currentNode,
    isLoading,
    isEscalating,
    setIsEscalating,
    escName,
    setEscName,
    escContact,
    setEscContact,
    escBody,
    setEscBody,
    userInput,
    setUserInput,
    startChat,
    startEscalation,
    handleOption,
    submitEscalation,
    submitInput
  } = useChatSession();

  const closeRef = useRef<HTMLButtonElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const hasOpened = useRef(false);
  // Set by the CHAT_ESCALATE_EVENT listener just before opening the panel,
  // so the isOpen-triggered effect below knows to route to the escalation
  // form instead of the normal root-node startChat(). Consumed and cleared
  // by that same effect.
  const pendingEscalationRef = useRef(false);

  // Direct launcher click (#chatbot-toggle) still lands here unchanged: opens
  // on the root node via startChat(). A CHAT_ESCALATE_EVENT-driven open sets
  // pendingEscalationRef first and is routed to startEscalation() instead —
  // exactly one of the two runs per open.
  useEffect(() => {
    if (!isOpen) return;
    if (pendingEscalationRef.current) {
      pendingEscalationRef.current = false;
      startEscalation();
    } else {
      startChat();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    const handleEscalate = () => {
      if (isOpen) {
        // Already open (e.g. showing the root tree) — transition in place.
        startEscalation();
      } else {
        pendingEscalationRef.current = true;
        setIsOpen(true);
      }
    };
    window.addEventListener(CHAT_ESCALATE_EVENT, handleEscalate);
    return () => window.removeEventListener(CHAT_ESCALATE_EVENT, handleEscalate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Focus moves into the panel on open and back to the launcher on close.
  // Both elements are conditionally mounted, so this has to run after the
  // render that mounts them — not from the click handler, where the target
  // does not exist yet. Non-modal, so Tab is deliberately not trapped.
  useEffect(() => {
    if (isOpen) {
      hasOpened.current = true;
      closeRef.current?.focus();
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setIsOpen(false);
      };
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
    }
    if (hasOpened.current) launcherRef.current?.focus();
  }, [isOpen]);

  return (
    <>
      {!isOpen && (
        <button
          id="chatbot-toggle"
          ref={launcherRef}
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed right-8 bottom-8 flex items-center gap-2.5 rounded-full border-2 border-[var(--accent)] bg-[var(--accent-bg)] py-3 pr-6 pl-4 text-base font-bold text-[var(--text-h)] shadow-[var(--shadow)] transition-colors hover:bg-[var(--bg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          <MessageCircle size={24} aria-hidden="true" />
          Ask us
        </button>
      )}

      {isOpen && (
        <div
          role="dialog"
          aria-label="Ask Riverside"
          className="fixed right-8 bottom-8 flex h-[560px] w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[32px] border border-[var(--border)] bg-[var(--bg)] shadow-[var(--shadow)]"
        >
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--accent-border)] bg-[var(--accent-bg)] text-sm font-bold text-[var(--text-h)]"
              >
                R
              </span>
              <div>
                <p className="text-[15px] font-bold text-[var(--text-h)]">Ask Riverside</p>
                <p className="text-xs text-[var(--text)]">Answers from today's shelf</p>
              </div>
            </div>
            <button
              type="button"
              ref={closeRef}
              aria-label="Close chat"
              onClick={() => setIsOpen(false)}
              className="rounded-full p-1.5 text-[var(--text-h)] transition-colors hover:bg-[var(--code-bg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>

          <div
            aria-live="polite"
            className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-5"
          >
            {history.map((msg, i) => (
              <Bubble key={i} sender={msg.sender}>{msg.text}</Bubble>
            ))}

            {isLoading && <TypingDots />}

            {isEscalating && (
              <form onSubmit={submitEscalation} className="flex flex-col gap-2 rounded-[24px] border border-[var(--border)] bg-[var(--code-bg)] p-4">
                <TextField id="chat-panel-name" label="Name" required value={escName} onChange={setEscName} placeholder="Name" />
                <TextField id="chat-panel-contact" label="Email or phone" required value={escContact} onChange={setEscContact} placeholder="Email or Phone" />
                <TextField id="chat-panel-body" label="Your message" required multiline value={escBody} onChange={setEscBody} placeholder="Your message..." />
                <div className="mt-1 flex gap-2">
                  <QuickReply type="submit" filled disabled={isLoading}>Send</QuickReply>
                  <QuickReply onClick={() => { setIsEscalating(false); handleOption('root', 'Cancel'); }}>Cancel</QuickReply>
                </div>
              </form>
            )}

            {currentNode && currentNode.text.includes("title, author, or ISBN") && !isEscalating && (
              <form onSubmit={submitInput} className="flex items-center gap-2">
                <TextField id="chat-panel-search" label="Title, author, or ISBN" required value={userInput} onChange={setUserInput} placeholder="Type a book name..." />
                <QuickReply type="submit" filled disabled={isLoading}>Ask</QuickReply>
              </form>
            )}
          </div>

          {!isEscalating && currentNode && currentNode.options.length > 0 && (
            <div className="flex flex-col items-start gap-2 border-t border-[var(--border)] px-4 py-4">
              {currentNode.options.map((opt: any) => (
                <QuickReply key={opt.id} onClick={() => handleOption(opt.id, opt.label)}>
                  {opt.label}
                </QuickReply>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
