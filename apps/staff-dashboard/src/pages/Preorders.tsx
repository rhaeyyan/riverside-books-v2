import { useEffect, useState } from 'react';
import { client } from '../api/client';
import type { components } from '../api/types';
import './Preorders.css';

type Order = components["schemas"]["Order"];
type Book = components["schemas"]["Book"];

type Customer = components["schemas"]["Customer"];

const isPastDeadline = (deadline: string) => {
  if (!deadline) return false;
  return new Date(deadline) < new Date();
};

const columns = [
  { key: 'pending', label: 'To prepare', emptyText: 'Nothing waiting to be pulled.' },
  { key: 'ready_for_pickup', label: 'Ready at counter', emptyText: 'No bags on the shelf.' },
  { key: 'completed', label: 'Picked up', emptyText: 'Nobody collected yet today.' },
] as const;

export function Preorders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [books, setBooks] = useState<Record<string, Book>>({});
  const [customers, setCustomers] = useState<Record<string, Customer>>({});
  const [moveAnnouncement, setMoveAnnouncement] = useState('');

  const fetchOrders = () => {
    client.GET("/api/orders", {}).then((res) => {
      if (res.data) {
        setOrders(res.data);
        const missingIds = [...new Set(res.data.map(o => o.customer_id))];
        missingIds.forEach(id => {
          client.GET("/api/customers/{customer_id}", { params: { path: { customer_id: id } } }).then(r => {
            if (r.data) setCustomers(prev => ({ ...prev, [id]: r.data as Customer }));
          });
        });
      }
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

  const moveOrder = async (order: Order, newStatus: Order["status"]) => {
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
      const customer = customers[order.customer_id];
      const destColumn = columns.find(c => c.key === newStatus);
      setMoveAnnouncement(`${customer ? customer.name : order.customer_id}'s order moved to ${destColumn ? destColumn.label : newStatus}.`);
    }
  };

  const releaseExpired = async () => {
    const res = await client.POST("/api/orders/release-expired", {});
    if (res.data) {
      alert(`Released ${res.data.released_count} expired holds.`);
      fetchOrders();
    }
  };

  const expiredCount = orders.filter(o => o.status === 'expired' || (o.status === 'pending' && isPastDeadline(o.hold_expires_at))).length;
  const releaseLabel = expiredCount === 0 ? 'Holds released' : `Release ${expiredCount} expired holds`;

  return (
    <div className="preorders-page">
      <div className="preorders-header">
        <div>
          <h1>Pre-orders</h1>
          <p className="preorders-subtitle">Holds sit at the counter for 48 hours, then release back to the shelf.</p>
        </div>
        <div className="release-btn-wrap">
          <button
            type="button"
            className="release-btn"
            onClick={releaseExpired}
            disabled={expiredCount === 0}
          >
            {releaseLabel}
          </button>
          <span className="sr-only" role="status" aria-live="polite">{releaseLabel}</span>
        </div>
      </div>

      <span className="sr-only" role="status" aria-live="polite">{moveAnnouncement}</span>

      <div className="kanban-board">
        {columns.map(col => {
          const cards = orders.filter(o => o.status === col.key);
          return (
            <div key={col.key} className="kanban-column">
              <div className="kanban-column-header">
                <h2>{col.label}</h2>
                <span className="kanban-count">{cards.length}</span>
              </div>
              <div className="kanban-cards">
                {cards.map(order => {
                  const pastDeadline = order.status === 'pending' && isPastDeadline(order.hold_expires_at);
                  const customer = customers[order.customer_id];
                  return (
                    <div key={order.order_id} className={`kanban-card ${pastDeadline ? 'past-deadline' : ''}`}>
                      <div className="card-header">
                        <div>
                          <div className="customer-name">{customer ? customer.name : order.customer_id}</div>
                          {customer && <div className="customer-phone">{customer.phone}</div>}
                        </div>
                        {pastDeadline && <span className="warning">Past 48h</span>}
                      </div>
                      <div className="items-list">
                        {order.items.map(item => (
                          <div key={item.isbn} className="item">
                            {item.quantity} x {books[item.isbn]?.title || item.isbn}
                          </div>
                        ))}
                      </div>
                      {order.notes && <q className="order-note">{order.notes}</q>}
                      <div className="card-footer">
                        <span className={`deadline ${pastDeadline ? 'deadline-past' : ''}`}>
                          By: {order.hold_expires_at ? new Date(order.hold_expires_at).toLocaleDateString() : 'N/A'}
                        </span>
                        <div className="actions">
                          {col.key === 'pending' && (
                            <button
                              type="button"
                              onClick={() => moveOrder(order, 'ready_for_pickup')}
                              aria-label={`Mark ${customer ? customer.name : order.customer_id}'s order ready for pickup`}
                            >
                              Mark ready
                            </button>
                          )}
                          {col.key === 'ready_for_pickup' && (
                            <button
                              type="button"
                              onClick={() => moveOrder(order, 'completed')}
                              aria-label={`Mark ${customer ? customer.name : order.customer_id}'s order as picked up`}
                            >
                              Complete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {cards.length === 0 && (
                  <div className="kanban-empty">{col.emptyText}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
