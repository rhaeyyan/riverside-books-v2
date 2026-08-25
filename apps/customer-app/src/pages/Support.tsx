import { useState, useEffect } from 'react';
import { client } from '../api/client';

export default function Support() {
  const [history, setHistory] = useState<{ sender: 'bot' | 'user', text: string }[]>([]);
  const [currentNode, setCurrentNode] = useState<any>(null);
  
  const [isEscalating, setIsEscalating] = useState(false);
  const [escName, setEscName] = useState("");
  const [escContact, setEscContact] = useState("");
  const [escBody, setEscBody] = useState("");
  
  const [userInput, setUserInput] = useState("");

  const startChat = async () => {
    if (history.length === 0) {
      const { data } = await client.POST("/api/chat/message", { body: { node_id: "root", input: null } });
      if (data) {
        setCurrentNode(data);
        setHistory([{ sender: 'bot', text: (data as any).text }]);
      }
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
    const { data } = await client.POST("/api/chat/message", { body: { node_id: optId, input: null } });
    if (data) {
      setCurrentNode(data);
      setHistory(h => [...h, { sender: 'bot', text: (data as any).text }]);
    }
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
    const { data } = await client.POST("/api/chat/message", { 
      body: { node_id: "check_stock", input: userInput } 
    });
    
    if (data) {
      setCurrentNode(data);
      setHistory(h => [...h, { sender: 'bot', text: (data as any).text }]);
    }
    setUserInput("");
  };

  return (
    <main className="min-h-screen bg-[#f7f2ea] px-4 py-10 text-[#1d1b18]">
      <div className="mx-auto max-w-6xl rounded-[28px] border border-[#e3d8c4] bg-[#fffdf9] shadow-[0_20px_60px_rgba(71,56,35,0.08)]">
        <div className="grid min-h-[780px] gap-0 md:grid-cols-[1.1fr_1.4fr]">
          <aside className="border-b border-[#e3d8c4] bg-[#f2e6d6] p-6 md:border-r md:border-b-0 md:p-8">
            <div className="mb-8 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#3d2b1f] text-lg font-bold text-[#fefaf2]">
                R
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6c5847]">
                  Riverside Books
                </p>
                <h1 className="text-xl font-semibold text-[#1d1b18]">Support Bot</h1>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-[#d9c8a9] bg-[#fffaf2] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7a624d]">
                  Live support
                </p>
                <p className="mt-2 text-sm leading-6 text-[#3c3128]">
                  Answers grounded in current inventory, store hours, policies, and event details.
                </p>
              </div>

              {!isEscalating && currentNode && currentNode.options.length > 0 && (
                <div>
                  <p className="mb-3 text-sm font-medium uppercase tracking-[0.14em] text-[#6c5847]">
                    Options
                  </p>
                  <div className="space-y-2">
                    {currentNode.options.map((opt: any) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleOption(opt.id, opt.label)}
                        className="w-full rounded-xl border border-[#d8c2a0] bg-[#fffaf2] px-3 py-2 text-left text-sm text-[#2a251f] transition hover:border-[#8b6b47] hover:bg-[#fff5e7]"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>

          <section className="flex flex-col bg-[#fffdf9] p-4 md:p-6">
            <div className="mb-4 flex items-center justify-between border-b border-[#efe0c7] pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7a624d]">
                  Customer support
                </p>
                <h2 className="mt-1 text-2xl font-semibold text-[#1d1b18]">Ask Riverside</h2>
              </div>
              <span className="rounded-full bg-[#eaf6ee] px-3 py-1 text-xs font-medium text-[#1d5c3f]">
                Online
              </span>
            </div>

            <div className="flex-1 space-y-4 overflow-hidden overflow-y-auto rounded-2xl bg-[#f9f4ec] p-4">
              {history.map((message, index) => (
                <div
                  key={`${message.sender}-${index}`}
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 whitespace-pre-wrap ${
                    message.sender === "bot"
                      ? "bg-[#fffaf2] text-[#2a251f]"
                      : "ml-auto bg-[#3d2b1f] text-[#fffaf2]"
                  }`}
                >
                  {message.text}
                </div>
              ))}
              
              {isEscalating && (
                <form onSubmit={submitEscalation} className="flex flex-col gap-2 bg-[#fffaf2] p-4 rounded-xl border border-[#d8c2a0]">
                  <input required placeholder="Name" value={escName} onChange={e => setEscName(e.target.value)} className="p-2 rounded border border-[#efe0c7]" />
                  <input required placeholder="Email or Phone" value={escContact} onChange={e => setEscContact(e.target.value)} className="p-2 rounded border border-[#efe0c7]" />
                  <textarea required placeholder="Your message..." value={escBody} onChange={e => setEscBody(e.target.value)} className="p-2 rounded border border-[#efe0c7] min-h-[60px]" />
                  <div className="flex gap-2 mt-2">
                    <button type="submit" className="flex-1 rounded-xl bg-[#3d2b1f] px-3 py-2 text-[#fffaf2]">Send</button>
                    <button type="button" onClick={() => { setIsEscalating(false); handleOption('root', 'Cancel'); }} className="flex-1 rounded-xl border border-[#3d2b1f] px-3 py-2">Cancel</button>
                  </div>
                </form>
              )}

              <div className="rounded-2xl border border-dashed border-[#d8c2a0] bg-[#fdfaf3] p-3 text-sm text-[#695c4d] mt-8">
                Current response logic is intentionally grounded in bookstore facts, not generic AI guesses.
              </div>
            </div>

            {currentNode && currentNode.text.includes("title, author, or ISBN") && !isEscalating && (
              <form onSubmit={submitInput} className="mt-4 flex gap-3">
                <input
                  type="text"
                  value={userInput}
                  onChange={e => setUserInput(e.target.value)}
                  aria-label="Ask a question"
                  placeholder="Type a book name or ISBN..."
                  className="flex-1 rounded-xl border border-[#dcc7a5] bg-[#fffaf2] px-4 py-3 text-sm text-[#201c1a] outline-none ring-0 placeholder:text-[#8c7a65] focus:border-[#8b6b47]"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-[#3d2b1f] px-5 py-3 text-sm font-medium text-[#fffaf2] transition hover:bg-[#2c2019]"
                >
                  Search
                </button>
              </form>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
