import { useEffect } from 'react';
import { Bubble, QuickReply, TextField, TypingDots } from '../components/ChatBubble';
import { useChatSession } from '../hooks/useChatSession';

export default function Support() {
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
    handleOption,
    submitEscalation,
    submitInput
  } = useChatSession();

  useEffect(() => {
    startChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 text-left">
      <p className="text-xs font-semibold tracking-[0.2em] text-[var(--text)] uppercase">
        Customer support
      </p>
      <h1>Ask Riverside</h1>
      <p className="max-w-[60ch] text-[var(--text)]">
        Answers come from current inventory, store hours, policies, and event
        details — a decision tree reading the same shelf counts as the register.
      </p>

      <div className="mt-8 grid gap-6 md:grid-cols-[1fr_1.6fr]">
        <aside className="rounded-[32px] border border-[var(--border)] bg-[var(--code-bg)] p-6">
          <p className="mb-4 text-xs font-semibold tracking-[0.14em] text-[var(--text)] uppercase">
            Where to start
          </p>
          {(!isEscalating && currentNode && currentNode.options.length > 0) ? (
            <div className="flex flex-col items-start gap-2">
              {currentNode.options.map((opt: any) => (
                <QuickReply key={opt.id} onClick={() => handleOption(opt.id, opt.label)}>
                  {opt.label}
                </QuickReply>
              ))}
            </div>
          ) : (isEscalating || (currentNode && currentNode.options.length === 0)) ? (
            <p className="text-[15px] text-[var(--text)]">
              Finish the form on the right and the menu comes back.
            </p>
          ) : null}
        </aside>

        <section className="flex min-h-[560px] flex-col rounded-[32px] border border-[var(--border)] bg-[var(--bg)] p-5 shadow-[var(--shadow)]">
          <div
            aria-live="polite"
            className="flex flex-1 flex-col gap-4 overflow-y-auto"
          >
            {history.map((message, index) => (
              <Bubble key={`${message.sender}-${index}`} sender={message.sender}>
                {message.text}
              </Bubble>
            ))}

            {isLoading && <TypingDots />}

            {isEscalating && (
              <form onSubmit={submitEscalation} className="flex flex-col gap-2 rounded-[24px] border border-[var(--border)] bg-[var(--code-bg)] p-4">
                <TextField id="chat-page-name" label="Name" required value={escName} onChange={setEscName} placeholder="Name" />
                <TextField id="chat-page-contact" label="Email or phone" required value={escContact} onChange={setEscContact} placeholder="Email or Phone" />
                <TextField id="chat-page-body" label="Your message" required multiline value={escBody} onChange={setEscBody} placeholder="Your message..." />
                <div className="mt-1 flex gap-2">
                  <QuickReply type="submit" filled disabled={isLoading}>Send</QuickReply>
                  <QuickReply onClick={() => { setIsEscalating(false); handleOption('root', 'Cancel'); }}>Cancel</QuickReply>
                </div>
              </form>
            )}
          </div>

          {currentNode && currentNode.text.includes("title, author, or ISBN") && !isEscalating && (
            <form onSubmit={submitInput} className="mt-4 flex items-center gap-3 border-t border-[var(--border)] pt-4">
              <TextField id="chat-page-search" label="Title, author, or ISBN" required value={userInput} onChange={setUserInput} placeholder="Type a book name or ISBN..." />
              <QuickReply type="submit" filled disabled={isLoading}>Search</QuickReply>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
