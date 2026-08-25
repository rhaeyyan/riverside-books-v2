import { useEffect, useState } from 'react';
import { client } from '../api/client';
import type { components } from '../api/types';
import './Preorders.css';

type Order = components["schemas"]["Order"];
type Book = components["schemas"]["Book"];

export function Preorders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [books, setBooks] = useState<Record<string, Book>>({});

  const fetchOrders = () => {
    client.GET("/api/orders", {}).then((res) => {
      if (res.data) setOrders(res.data);
    });
  };

  const fetchBooks = () => {
    client.GET("/api/books", {}).then((res) => {
      if (res.data) {
        const bm: Record<string, Book> = {};
        res.data.forEach(b => bm[b.isbn] = b);
        setBooks(bm);
      }
    });
  };

  useEffect(() => {
    fetchOrders();
    fetchBooks();
  }, []);

  const moveOrder = async (order: Order, newStatus: string) => {
    // Optimistic update
    const prevOrders = [...orders];
    setOrders(orders.map(o => o.order_id === order.order_id ? { ...o, status: newStatus } : o));

    const res = await client.PATCH("/api/orders/{order_id}/status", {
      params: { path: { order_id: order.order_id } },
      body: { status: newStatus }
    });

    if (res.error) {
      alert("Failed to update status. Invalid transition?");
      setOrders(prevOrders);
    } else if (res.data) {
      setOrders(orders.map(o => o.order_id === order.order_id ? res.data : o));
    }
  };

  const releaseExpired = async () => {
    const res = await client.POST("/api/orders/release-expired", {});
    if (res.data) {
      alert(`Released ${res.data.released_count} expired holds.`);
      fetchOrders();
    }
  };

  const columns = ['PENDING', 'READY_FOR_PICKUP', 'COMPLETED'];
  
  const isPastDeadline = (deadline: string) => {
    if (!deadline) return false;
    return new Date(deadline) < new Date();
  };

  return (
    <div className="preorders-page">
      <div className="preorders-header">
        <h1>Pre-order Board</h1>
        <button className="release-btn" onClick={releaseExpired}>Release Expired Holds</button>
      </div>
      
      <div className="kanban-board">
        {columns.map(col => (
          <div key={col} className="kanban-column">
            <h2>{col.replace(/_/g, ' ')}</h2>
            <div className="kanban-cards">
              {orders.filter(o => o.status === col).map(order => {
                const pastDeadline = order.status === 'PENDING' && isPastDeadline(order.hold_expires_at);
                return (
                  <div key={order.order_id} className={`kanban-card ${pastDeadline ? 'past-deadline' : ''}`}>
                    <div className="card-header">
                      <span className="customer">Cust: {order.customer_id.substring(0,8)}</span>
                      {pastDeadline && <span className="warning">Expired!</span>}
                    </div>
                    <div className="items-list">
                      {order.items.map(item => (
                        <div key={item.isbn} className="item">
                          {item.quantity}x {books[item.isbn]?.title || item.isbn}
                        </div>
                      ))}
                    </div>
                    <div className="card-footer">
                      <span className="deadline">
                        By: {order.hold_expires_at ? new Date(order.hold_expires_at).toLocaleDateString() : 'N/A'}
                      </span>
                      <div className="actions">
                        {col === 'PENDING' && <button onClick={() => moveOrder(order, 'READY_FOR_PICKUP')}>Ready</button>}
                        {col === 'READY_FOR_PICKUP' && <button onClick={() => moveOrder(order, 'COMPLETED')}>Complete</button>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
