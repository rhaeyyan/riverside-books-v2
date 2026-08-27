import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { client } from '../api/client';
import { formatMoney } from '../utils/format';
import type { components } from '../api/types';
import { Search, Clock, Calendar, CheckCircle2, XCircle, BookOpen } from 'lucide-react';
import { getCustomerSession, subscribeToCustomerSession } from '../lib/customerSession';
import './MyOrders.css';

type Order = components["schemas"]["Order"];

export default function MyOrders() {
  const [phone, setPhone] = useState("");
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [session, setSession] = useState(() => getCustomerSession());
  const [showManualLookup, setShowManualLookup] = useState(false);

  // Shared by both the session auto-load and the manual phone-lookup path so
  // the same loading/empty/error/list render below is always what's shown.
  const loadOrdersForCustomer = async (customerId: string) => {
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

        <div className="myorders-hero-art">
          <svg
            viewBox="0 0 400 400"
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="ordersBgv" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#3d1f4d" />
                <stop offset="1" stopColor="#241030" />
              </linearGradient>
              <linearGradient id="ordersSpineA" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#c14a38" />
                <stop offset="1" stopColor="#8a2f22" />
              </linearGradient>
              <linearGradient id="ordersSpineB" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#e2a355" />
                <stop offset="1" stopColor="#b9782f" />
              </linearGradient>
              <linearGradient id="ordersSpineC" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#3d8c7c" />
                <stop offset="1" stopColor="#20574c" />
              </linearGradient>
            </defs>

            <rect width="400" height="400" fill="url(#ordersBgv)" />

            <g stroke="#fbf7f0" strokeOpacity="0.05">
              <path d="M 200 -20 L 520 460" />
              <path d="M 120 -20 L 440 460" />
              <path d="M 280 -20 L 600 460" />
              <path d="M 40 -20 L 360 460" />
            </g>

            {/* Reserved shelf cubbies — one slot pulled and tagged for a hold */}
            <g>
              <rect x="40" y="56" width="326" height="6" fill="#fbf7f0" opacity="0.45" />
              <rect x="40" y="56" width="6" height="164" fill="#fbf7f0" opacity="0.45" />
              <rect x="120" y="56" width="6" height="164" fill="#fbf7f0" opacity="0.45" />
              <rect x="200" y="56" width="6" height="164" fill="#fbf7f0" opacity="0.45" />
              <rect x="280" y="56" width="6" height="164" fill="#fbf7f0" opacity="0.45" />
              <rect x="360" y="56" width="6" height="164" fill="#fbf7f0" opacity="0.45" />

              <rect x="52" y="86" width="62" height="120" rx="2" fill="url(#ordersSpineC)" opacity="0.85" />
              <rect x="132" y="72" width="62" height="134" rx="2" fill="url(#ordersSpineA)" opacity="0.85" />

              {/* Empty slot — the held title has already been pulled */}
              <rect x="214" y="78" width="58" height="128" rx="2" fill="none" stroke="#fbf7f0" strokeOpacity="0.3" strokeDasharray="5 5" />
              <path d="M 243 78 L 243 58" stroke="#fbf7f0" strokeOpacity="0.5" strokeWidth="1.5" />
              <rect x="228" y="38" width="30" height="20" rx="3" fill="url(#ordersSpineB)" />
              <circle cx="243" cy="48" r="2.2" fill="#241030" opacity="0.5" />

              <rect x="292" y="80" width="62" height="126" rx="2" fill="url(#ordersSpineB)" opacity="0.85" />

              <rect x="40" y="220" width="326" height="7" fill="#e2a355" opacity="0.85" />
              <rect x="40" y="227" width="326" height="10" fill="#000000" opacity="0.22" />
            </g>

            {/* Register counter with the held book waiting, tagged */}
            <g>
              <rect x="0" y="252" width="400" height="148" fill="url(#ordersSpineB)" opacity="0.94" />
              <rect x="0" y="252" width="400" height="8" fill="#fbf7f0" opacity="0.22" />

              <g transform="rotate(-7 210 320)">
                <rect x="150" y="296" width="118" height="16" rx="3" fill="#fbf7f0" opacity="0.85" />
                <rect x="150" y="278" width="118" height="30" rx="4" fill="url(#ordersSpineA)" />
                <rect x="162" y="288" width="60" height="4" fill="#fbf7f0" opacity="0.4" />
              </g>

              <path d="M 268 280 Q 292 258 288 236" fill="none" stroke="#241030" strokeOpacity="0.35" strokeWidth="2" />
              <circle cx="286" cy="228" r="16" fill="url(#ordersSpineC)" stroke="#fbf7f0" strokeOpacity="0.5" strokeWidth="1.5" />
              <circle cx="286" cy="228" r="2" fill="#fbf7f0" />
            </g>
          </svg>
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

      <section className="myorders-promo">
        <div className="myorders-promo-inner">
          <p className="myorders-promo-eyebrow">The reader card</p>
          <h2 className="myorders-promo-title">Ten stamps, and the eleventh book is on us.</h2>
          <p className="myorders-promo-desc">
            Earn 1 stamp for every book purchased. Collect 10 stamps to earn a free paperback of your choice!
          </p>
          <Link to="/loyalty" className="myorders-promo-cta">
            See my stamp card
          </Link>
        </div>
      </section>

      {orders && (
        <div className="myorders-results" role="status" aria-live="polite">
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
