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
      <h1>Message Inbox</h1>
      {messages.length === 0 ? (
        <div className="empty-state">No new messages.</div>
      ) : (
        <div className="messages-list">
          {messages.map(m => (
            <div key={m.message_id} className="message-card">
              <div className="message-header">
                <div>
                  <strong>{m.name}</strong> 
                  <span className="contact-info"> ({m.contact})</span>
                </div>
                <div className="message-time">
                  {new Date(m.created_at).toLocaleString()}
                </div>
              </div>
              <div className="message-body">
                {m.body}
              </div>
              <div className="message-actions">
                <button onClick={() => markAsRead(m.message_id)}>Mark as Read</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
