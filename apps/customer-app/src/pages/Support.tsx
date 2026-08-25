import { useState, useEffect } from 'react';
import { client } from '../api/client';
import { Bubble, QuickReply, TextField, TypingDots } from '../components/ChatBubble';

export default function Support() {
  const [history, setHistory] = useState<{ sender: 'bot' | 'user', text: string }[]>([]);
  const [currentNode, setCurrentNode] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [isEscalating, setIsEscalating] = useState(false);
  const [escName, setEscName] = useState("");
  const [escContact, setEscContact] = useState("");
  const [escBody, setEscBody] = useState("");

  const [userInput, setUserInput] = useState("");

  const startChat = async () => {
    if (history.length === 0) {
      setIsLoading(true);
      const { data } = await client.POST("/api/chat/message", { body: { node_id: "root", input: null } });
      if (data) {
        setCurrentNode(data);
        setHistory([{ sender: 'bot', text: (data as any).text }]);
      }
      setIsLoading(false);
    }
  };

  useEffect(() => {
    startChat();
  }, []);

  const handleOption = async (optId: string, optLabel: string) => {
    if (optId === "escalate") {
      setHistory(h => [...h, { sender: 'user', text: optLabel }, { sender: 'bot', text: "Please provide your details below to leave a message." }]);
      setIsEscalating(true);
      setCurrentNode(null);
      return;
    }

    setHistory(h => [...h, { sender: 'user', text: optLabel }]);
    setIsLoading(true);
    const { data } = await client.POST("/api/chat/message", { body: { node_id: optId, input: null } });
    if (data) {
      setCurrentNode(data);
      setHistory(h => [...h, { sender: 'bot', text: (data as any).text }]);
    }
    setIsLoading(false);
  };

  const submitEscalation = async (e: React.FormEvent) => {
    e.preventDefault();
    await client.POST("/api/chat/escalate", {
      body: { name: escName, contact: escContact, body: escBody }
    });
    setHistory(h => [...h, { sender: 'bot', text: "Thank you! Your message has been sent to our staff. We will get back to you shortly." }]);
    setIsEscalating(false);

    setTimeout(async () => {
      const { data } = await client.POST("/api/chat/message", { body: { node_id: "root", input: null } });
      if (data) setCurrentNode(data);
    }, 2000);
  };

  const submitInput = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim()) return;

    setHistory(h => [...h, { sender: 'user', text: userInput }]);
    setIsLoading(true);
    const { data } = await client.POST("/api/chat/message", {
      body: { node_id: "check_stock", input: userInput }
    });

    if (data) {
      setCurrentNode(data);
      setHistory(h => [...h, { sender: 'bot', text: (data as any).text }]);
    }
    setIsLoading(false);
    setUserInput("");
  };

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
          {!isEscalating && currentNode && currentNode.options.length > 0 ? (
            <div className="flex flex-col items-start gap-2">
              {currentNode.options.map((opt: any) => (
                <QuickReply key={opt.id} onClick={() => handleOption(opt.id, opt.label)}>
                  {opt.label}
                </QuickReply>
              ))}
            </div>
          ) : (
            <p className="text-[15px] text-[var(--text)]">
              Finish the form on the right and the menu comes back.
            </p>
          )}
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
                  <QuickReply type="submit" filled>Send</QuickReply>
                  <QuickReply onClick={() => { setIsEscalating(false); handleOption('root', 'Cancel'); }}>Cancel</QuickReply>
                </div>
              </form>
            )}
          </div>

          {currentNode && currentNode.text.includes("title, author, or ISBN") && !isEscalating && (
            <form onSubmit={submitInput} className="mt-4 flex items-center gap-3 border-t border-[var(--border)] pt-4">
              <TextField id="chat-page-search" label="Title, author, or ISBN" required value={userInput} onChange={setUserInput} placeholder="Type a book name or ISBN..." />
              <QuickReply type="submit" filled>Search</QuickReply>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
