import { useState, useEffect } from 'react';
import { client } from '../api/client';
import { MessageCircle, X } from 'lucide-react';

export default function ChatPanel() {
  const [isOpen, setIsOpen] = useState(false);
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
    if (isOpen) startChat();
  }, [isOpen]);

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
    <>
      <button 
        id="chatbot-toggle"
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed', bottom: '2rem', right: '2rem',
          background: '#007bff', color: 'white', borderRadius: '50%',
          width: '60px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}
      >
        <MessageCircle size={32} />
      </button>

      {isOpen && (
        <div style={{
          position: 'fixed', bottom: '2rem', right: '2rem',
          width: '350px', height: '500px', background: 'white',
          borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden'
        }}>
          <div style={{ background: '#007bff', color: 'white', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Riverside Support</h3>
            <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
              <X size={24} />
            </button>
          </div>

          <div style={{ flex: 1, padding: '1rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {history.map((msg, i) => (
              <div key={i} style={{ 
                alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                background: msg.sender === 'user' ? '#007bff' : '#f1f3f5',
                color: msg.sender === 'user' ? 'white' : 'black',
                padding: '0.75rem 1rem', borderRadius: '16px', maxWidth: '85%',
                whiteSpace: 'pre-wrap'
              }}>
                {msg.text}
              </div>
            ))}
            
            {isEscalating && (
              <form onSubmit={submitEscalation} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: '#f8f9fa', padding: '1rem', borderRadius: '8px' }}>
                <input required placeholder="Name" value={escName} onChange={e => setEscName(e.target.value)} style={{ padding: '0.5rem' }} />
                <input required placeholder="Email or Phone" value={escContact} onChange={e => setEscContact(e.target.value)} style={{ padding: '0.5rem' }} />
                <textarea required placeholder="Your message..." value={escBody} onChange={e => setEscBody(e.target.value)} style={{ padding: '0.5rem', minHeight: '60px' }} />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="submit" style={{ flex: 1, padding: '0.5rem', background: '#007bff', color: 'white', border: 'none' }}>Send</button>
                  <button type="button" onClick={() => { setIsEscalating(false); handleOption('root', 'Cancel'); }} style={{ padding: '0.5rem' }}>Cancel</button>
                </div>
              </form>
            )}
            
            {currentNode && currentNode.text.includes("title, author, or ISBN") && (
              <form onSubmit={submitInput} style={{ display: 'flex', gap: '0.5rem' }}>
                <input required value={userInput} onChange={e => setUserInput(e.target.value)} placeholder="Type a book name..." style={{ flex: 1, padding: '0.5rem' }} />
                <button type="submit" style={{ padding: '0.5rem', background: '#007bff', color: 'white', border: 'none' }}>Send</button>
              </form>
            )}
          </div>

          {!isEscalating && currentNode && currentNode.options.length > 0 && (
            <div style={{ padding: '1rem', borderTop: '1px solid #eee', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {currentNode.options.map((opt: any) => (
                <button 
                  key={opt.id} 
                  onClick={() => handleOption(opt.id, opt.label)}
                  style={{
                    padding: '0.75rem', background: 'white', border: '1px solid #007bff',
                    color: '#007bff', borderRadius: '8px', cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
