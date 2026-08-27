import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { client } from '../api/client';
import { formatMoney } from '../utils/format';
import { prefersReducedMotion } from '../utils/motion';
import type { components } from '../api/types';
import { Search, Clock, Calendar, CheckCircle2, XCircle, BookOpen } from 'lucide-react';
import { getCustomerSession, subscribeToCustomerSession } from '../lib/customerSession';
import './MyOrders.css';

type Order = components["schemas"]["Order"];

const DEMO_PHONE = "(555) 100-0005";

export default function MyOrders() {
  const [phone, setPhone] = useState("");
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [session, setSession] = useState(() => getCustomerSession());
  const [showManualLookup, setShowManualLookup] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);
  // Set true right before a lookup (session auto-load or manual submit)
  // resolves into `orders`, so the scroll effect below only fires as the
  // direct result of a lookup — not on later state changes to `orders`
  // (e.g. handleCancel patching an item in place) and not on first mount.
  const shouldScrollToResults = useRef(false);

  // Shared by both the session auto-load and the manual phone-lookup path so
  // the same loading/empty/error/list render below is always what's shown.
  const loadOrdersForCustomer = async (customerId: string) => {
    shouldScrollToResults.current = true;
    setLoading(true);
    setError(null);
    try {
      const { data: orderData, error: orderError } = await client.GET("/api/customers/{customer_id}/orders", {
        params: { path: { customer_id: customerId } }
      });
      if (orderData) {
        setOrders(orderData as Order[]);
      } else if (orderError) {
        setError("Could not retrieve orders for this account.");
      }
    } catch {
      setError("Unable to connect to the store database. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      loadOrdersForCustomer(session.customer_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reactive to sign-out (and cross-tab sign-in/out) happening while this
  // page is already mounted — a one-time mount read misses a sign-out that
  // fires from App.tsx's header without a navigation. When the session
  // disappears out from under an already-loaded order list, fall back to the
  // same "no session" state: clear the loaded orders and let the render
  // below fall through to the manual lookup form.
  useEffect(() => {
    return subscribeToCustomerSession(() => {
      const next = getCustomerSession();
      setSession(next);
      if (!next) {
        setOrders(null);
        setError(null);
      }
    });
  }, []);

  // Scroll the results into view once they arrive from a lookup (session
  // auto-load or manual submit), not on initial mount and not on later
  // in-place updates to `orders` (see the ref above).
  useEffect(() => {
    if (orders && shouldScrollToResults.current) {
      shouldScrollToResults.current = false;
      resultsRef.current?.scrollIntoView({
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        block: 'start',
      });
    }
  }, [orders]);

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
        await loadOrdersForCustomer(customerId);
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
    <div>
      <section className="myorders-hero">
        <div className="myorders-hero-copy">
          <p className="myorders-eyebrow">Reserved books, held at the register</p>
          <h1 className="myorders-title">
            My Holds & Orders
          </h1>
          {session && !showManualLookup ? (
            <>
              <p className="myorders-subtitle">
                Showing holds and orders for {session.name}.
              </p>
              <button
                type="button"
                className="rule-link"
                onClick={() => setShowManualLookup(true)}
              >
                Not you? Look up another number
              </button>
            </>
          ) : (
            <>
              <p className="myorders-subtitle">
                Look up your reservations and holds using the phone number you provided.
              </p>

              <form onSubmit={fetchOrders} className="myorders-lookup-form">
                <div className="myorders-input-wrapper">
                  <Search size={18} className="myorders-search-icon" aria-hidden="true" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. (845) 555-0142"
                    aria-label="Phone number"
                    required
                    className="myorders-phone-input"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="search-submit-btn"
                >
                  {loading ? "Looking up..." : "Find My Holds"}
                </button>
              </form>

              <button
                type="button"
                className="myorders-demo-hint"
                onClick={() => setPhone(DEMO_PHONE)}
              >
                Demo: try {DEMO_PHONE}
              </button>

              {session && (
                <button
                  type="button"
                  className="rule-link"
                  onClick={() => setShowManualLookup(false)}
                >
                  Back to my holds
                </button>
              )}
            </>
          )}

          {error && (
            <div style={{ padding: '14px 16px', background: 'var(--status-out-bg)', border: '1px solid var(--status-out)', borderRadius: '8px', color: 'var(--status-out)', fontSize: '14px', marginBottom: '24px' }} role="alert">
              {error}
            </div>
          )}
        </div>

        <div className="myorders-status-legend">
          <span className="myorders-status-chip myorders-status-chip--low">
            <Clock size={13} aria-hidden="true" />
            Pending hold
          </span>
          <span className="myorders-status-chip myorders-status-chip--in">
            <CheckCircle2 size={13} aria-hidden="true" />
            Ready for pickup
          </span>
          <span className="myorders-status-chip myorders-status-chip--out">
            <XCircle size={13} aria-hidden="true" />
            Cancelled
          </span>
        </div>
      </section>

      <section className="myorders-rule" aria-label="How holds work at Riverside Books">
        <div className="rule-item">
          <div className="rule-number" aria-hidden="true">01</div>
          <h2 className="rule-title">Held 48 hours</h2>
          <p className="rule-desc">
            Every hold shows the exact date and time it expires at the register, right on the order below.
          </p>
        </div>
        <div className="rule-item">
          <div className="rule-number" aria-hidden="true">02</div>
          <h2 className="rule-title">Tracked in real time</h2>
          <p className="rule-desc">
            Pending, ready for pickup, completed, or cancelled — each order shows the same status the register sees.
          </p>
        </div>
        <div className="rule-item">
          <div className="rule-number" aria-hidden="true">03</div>
          <h2 className="rule-title">Cancel anytime, online</h2>
          <p className="rule-desc">
            Changed your mind? Cancel a pending or ready hold right from this page — no call needed.
          </p>
        </div>
      </section>

      {orders && (
        <div className="myorders-results" role="status" aria-live="polite" ref={resultsRef}>
          {orders.length === 0 ? (
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
                      borderLeft: `3px solid ${statusAccentColor(o.status)}`,
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
          )}
        </div>
      )}
    </div>
  );
}

// Mirrors the token each state uses in OrderStatusBadge below, so the card's
// left-edge accent echoes the same status color as its badge.
function statusAccentColor(status: string): string {
  if (status === 'pending') return 'var(--status-low)';
  if (status === 'ready_for_pickup') return 'var(--status-in)';
  if (status === 'cancelled') return 'var(--status-out)';
  return 'var(--border)';
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
