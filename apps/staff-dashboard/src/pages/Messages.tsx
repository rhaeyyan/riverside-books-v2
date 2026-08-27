import { useEffect, useState } from 'react';
import { client } from '../api/client';
import type { components } from '../api/types';
import './Messages.css';

type Message = components["schemas"]["Message"];

export function Messages() {
  const [messages, setMessages] = useState<Message[]>([]);

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
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
