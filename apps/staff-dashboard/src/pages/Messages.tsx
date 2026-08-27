import { useEffect, useState } from 'react';
import { client } from '../api/client';
import type { components } from '../api/types';
import './Messages.css';

type Message = components["schemas"]["Message"];

export function Messages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isDrafting, setIsDrafting] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const handleDraftReply = async (messageId: string) => {
    setIsDrafting(prev => ({ ...prev, [messageId]: true }));
    try {
      const res = await client.POST("/api/messages/{message_id}/draft-reply", {
        params: { path: { message_id: messageId } }
      });
      if (res.data) {
        setDrafts(prev => ({ ...prev, [messageId]: res.data.draft_text }));
      } else {
        alert("Failed to generate draft");
      }
    } catch (e) {
      console.error(e);
      alert("Error calling draft endpoint");
    } finally {
      setIsDrafting(prev => ({ ...prev, [messageId]: false }));
    }
  };

  const fetchMessages = () => {
    client.GET("/api/messages", {}).then((res) => {
      if (res.data) {
        setMessages(res.data.filter(m => m.status === 'new'));
      }
    });
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  const markAsRead = async (id: string) => {
    // Optimistic update
    const prevMessages = [...messages];
    setMessages(messages.filter(m => m.message_id !== id));

    const res = await client.PATCH("/api/messages/{message_id}/status" as any, {
      params: { path: { message_id: id } } as any,
      body: { status: 'read' } as any
    });

    if (res.error) {
      alert("Failed to mark as read");
      setMessages(prevMessages); // Rollback
    }
  };

  return (
    <div className="messages-page">
      <div className="messages-header">
        <div>
          <h1>Messages</h1>
          <p className="messages-subtitle" role="status" aria-live="polite">
            {messages.length === 0
              ? 'Anything the chatbot could not answer lands here.'
              : `${messages.length} unread message${messages.length === 1 ? '' : 's'} · anything the chatbot could not answer lands here.`}
          </p>
        </div>
      </div>
      {messages.length === 0 ? (
        <div className="empty-state">
          <div className="empty-title">Inbox clear</div>
          <div className="empty-hint">The bot handled everything today.</div>
        </div>
      ) : (
        <div className="messages-list">
          {messages.map(m => (
            <div key={m.message_id} className="message-card">
              <div className="message-header">
                <div>
                  <strong className="sender-name">{m.name}</strong>
                  <span className="contact-info"> {m.contact}</span>
                </div>
                <div className="message-time">
                  {new Date(m.created_at).toLocaleString()}
                </div>
              </div>
              <div className="message-body">
                {m.body}
              </div>
              <div className="message-actions">
                <button
                  type="button"
                  onClick={() => markAsRead(m.message_id)}
                  aria-label={`Mark message from ${m.name} as handled`}
                >
                  Mark handled
                </button>
                <button
                  type="button"
                  className="draft-reply-btn"
                  onClick={() => handleDraftReply(m.message_id)}
                  disabled={isDrafting[m.message_id]}
                  aria-label={`Draft an AI reply to the message from ${m.name}`}
                >
                  {isDrafting[m.message_id] ? "Drafting..." : "Draft Reply with AI ✨"}
                </button>
              </div>
              {drafts[m.message_id] && (
                <div className="draft-container">
                  <label>Draft Reply:</label>
                  <textarea 
                    className="draft-textarea"
                    defaultValue={drafts[m.message_id]} 
                    rows={6}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
