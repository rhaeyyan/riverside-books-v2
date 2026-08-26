import { useState } from 'react';
import { Link } from 'react-router-dom';
import { client } from '../api/client';
import { formatMoney } from '../utils/format';
import type { components } from '../api/types';
import { Search, Clock, Calendar, CheckCircle2, XCircle, BookOpen } from 'lucide-react';

type Order = components["schemas"]["Order"];

export default function MyOrders() {
  const [phone, setPhone] = useState("");
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchOrders = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      setError("Please enter a valid 10-digit phone number.");
      return;
    }

    setLoading(true);
    try {
      const { data: custData, error: custError, response: custResponse } = await client.POST("/api/customers/lookup", {
        body: { phone: cleanPhone }
      });

      if (custError) {
        if (custResponse.status === 404) {
          setError("No customer record found with that number. Have you placed a hold yet?");
        } else {
          setError("An error occurred while finding your account.");
        }
        setOrders(null);
        return;
      }

      if (custData) {
        const customerId = (custData as any).customer_id;
        const { data: orderData, error: orderError } = await client.GET("/api/customers/{customer_id}/orders", {
          params: { path: { customer_id: customerId } }
        });
        if (orderData) {
          setOrders(orderData as Order[]);
        } else if (orderError) {
          setError("Could not retrieve orders for this account.");
        }
      }
    } catch {
      setError("Unable to connect to the store database. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (orderId: string) => {
    setCancellingId(orderId);
    try {
      const { error: cancelError } = await client.PATCH("/api/orders/{order_id}/status", {
        params: { path: { order_id: orderId } },
        body: { status: "cancelled" }
      });

      if (!cancelError && orders) {
        setOrders(orders.map((o) => (o.order_id === orderId ? { ...o, status: "cancelled" } : o)));
      }
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', paddingTop: '12px' }}>
      <h1 style={{ fontFamily: 'var(--heading)', fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 500, color: 'var(--text-h)', margin: '0 0 8px' }}>
        My Holds & Orders
      </h1>
      <p style={{ fontSize: '15.5px', color: '#6c6155', margin: '0 0 24px', lineHeight: 1.5 }}>
        Look up your reservations and holds using the phone number you provided.
      </p>

      <form onSubmit={fetchOrders} style={{ display: 'flex', gap: '10px', marginBottom: '28px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1', minWidth: '220px', position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={18} style={{ position: 'absolute', left: '14px', color: '#8a7e6f' }} />
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. (845) 555-0142"
            required
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '12px 14px 12px 42px',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              background: 'var(--bg-raised)',
              fontSize: '15px',
              fontFamily: 'var(--mono)',
              color: 'var(--text-h)',
              minHeight: '44px'
            }}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="search-submit-btn"
          style={{ minHeight: '44px' }}
        >
          {loading ? "Looking up..." : "Find My Holds"}
        </button>
      </form>

      {error && (
        <div style={{ padding: '14px 16px', background: 'var(--status-out-bg)', border: '1px solid var(--status-out)', borderRadius: '8px', color: 'var(--status-out)', fontSize: '14px', marginBottom: '24px' }} role="alert">
          {error}
        </div>
      )}

      {orders && (
        orders.length === 0 ? (
          <div className="empty-state" style={{ margin: '20px 0' }}>
            <BookOpen size={40} className="empty-state-icon" aria-hidden="true" />
            <h3 className="empty-state-title">No holds found</h3>
            <p className="empty-state-desc">
              We don't see any holds or orders for that number. Browse our shelves to find your next great read!
            </p>
            <Link to="/" className="btn-secondary" style={{ textDecoration: 'none' }}>
              Browse Available Books
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {orders.map((o) => {
              const isHoldActive = o.status === 'pending' || o.status === 'ready_for_pickup';
              return (
                <div
                  key={o.order_id}
                  style={{
                    background: 'var(--bg-raised)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '20px',
                    boxShadow: 'rgba(36, 29, 22, 0.04) 0 4px 10px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: '16px', fontWeight: 600, color: 'var(--accent)' }}>
                          #{o.order_id}
                        </span>
                        <OrderStatusBadge status={o.status} />
                      </div>
                      <div style={{ display: 'flex', gap: '16px', color: '#6c6155', fontSize: '13px', marginTop: '8px', flexWrap: 'wrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={14} />
                          {new Date(o.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        <span style={{ fontWeight: 600, color: 'var(--text-h)', fontVariantNumeric: 'tabular-nums' }}>
                          Total: {formatMoney(o.total_cents)}
                        </span>
                      </div>
                    </div>

                    {isHoldActive && (
                      <button
                        onClick={() => handleCancel(o.order_id)}
                        disabled={cancellingId === o.order_id}
                        style={{
                          padding: '8px 14px',
                          background: 'transparent',
                          color: 'var(--status-out)',
                          border: '1px solid var(--status-out)',
                          borderRadius: '6px',
                          fontSize: '13px',
                          fontWeight: 500,
                          cursor: 'pointer',
                          minHeight: '38px',
                          transition: 'background-color 0.15s ease'
                        }}
                      >
                        {cancellingId === o.order_id ? "Cancelling..." : "Cancel Hold"}
                      </button>
                    )}
                  </div>

                  {o.status === "pending" && o.hold_expires_at && (
                    <div style={{ marginTop: '14px', padding: '10px 14px', background: 'var(--status-low-bg)', borderRadius: '6px', fontSize: '13.5px', color: 'var(--status-low)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={15} />
                      <span>
                        Hold held at register until: <strong>{new Date(o.hold_expires_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong>
                      </span>
                    </div>
                  )}

                  <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '12.5px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8a7e6f', marginBottom: '8px', fontWeight: 600 }}>
                      Reserved Books ({o.items.length})
                    </div>
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {o.items.map((item) => (
                        <li key={item.isbn} style={{ fontSize: '14px', display: 'flex', justifyContent: 'space-between' }}>
                          <span>
                            ISBN <span style={{ fontFamily: 'var(--mono)', fontSize: '13px' }}>{item.isbn}</span>
                          </span>
                          <span style={{ color: '#6c6155' }}>Qty: {item.quantity}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

function OrderStatusBadge({ status }: { status: string }) {
  if (status === 'pending') {
    return <span className="stock-pill low-stock" style={{ fontSize: '12px', padding: '4px 10px' }}><Clock size={13} style={{ marginRight: '4px' }} />Pending Hold</span>;
  }
  if (status === 'ready_for_pickup') {
    return <span className="stock-pill in-stock" style={{ fontSize: '12px', padding: '4px 10px' }}><CheckCircle2 size={13} style={{ marginRight: '4px' }} />Ready for Pickup</span>;
  }
  if (status === 'completed') {
    return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: '999px', fontSize: '12px', background: 'var(--code-bg)', color: 'var(--text-h)', fontWeight: 600 }}><CheckCircle2 size={13} style={{ marginRight: '4px' }} />Completed</span>;
  }
  if (status === 'cancelled') {
    return <span className="stock-pill out-of-stock" style={{ fontSize: '12px', padding: '4px 10px' }}><XCircle size={13} style={{ marginRight: '4px' }} />Cancelled</span>;
  }
  return <span style={{ fontSize: '12px', color: '#8a7e6f' }}>{status}</span>;
}
