import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { client } from '../api/client';
import { formatMoney } from '../utils/format';
import { prefersReducedMotion } from '../utils/motion';
import type { components } from '../api/types';
import { Clock, Calendar, CheckCircle2, XCircle, BookOpen, LogIn } from 'lucide-react';
import { getCustomerSession, subscribeToCustomerSession } from '../lib/customerSession';
import { AUTH_OPEN_EVENT } from '../components/AuthDialog';
import './MyOrders.css';

type Order = components["schemas"]["Order"];
type Book = components["schemas"]["Book"];

export default function MyOrders() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [session, setSession] = useState(() => getCustomerSession());
  const [bookDetails, setBookDetails] = useState<Record<string, Book>>({});
  const [bookCoverErrors, setBookCoverErrors] = useState<Record<string, boolean>>({});
  const resultsRef = useRef<HTMLDivElement>(null);
  // Set true right before a session auto-load resolves into `orders`, so the
  // scroll effect below only fires as the direct result of that load — not
  // on later state changes to `orders` (e.g. handleCancel patching an item
  // in place) and not on first mount.
  const shouldScrollToResults = useRef(false);

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
  // fires from App.tsx's header without a navigation, and misses a sign-in
  // completed through the new AuthDialog while this page is open. When the
  // session disappears out from under an already-loaded order list, fall
  // back to the same "no session" state: clear the loaded orders and let the
  // render below fall through to the sign-in prompt. When a session appears
  // (sign-in from this page's own prompt, or another tab), load its orders.
  useEffect(() => {
    return subscribeToCustomerSession(() => {
      const next = getCustomerSession();
      setSession(next);
      if (next) {
        loadOrdersForCustomer(next.customer_id);
      } else {
        setOrders(null);
        setError(null);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll the results into view once they arrive from a session auto-load,
  // not on initial mount and not on later in-place updates to `orders` (see
  // the ref above).
  useEffect(() => {
    if (orders && shouldScrollToResults.current) {
      shouldScrollToResults.current = false;
      resultsRef.current?.scrollIntoView({
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        block: 'start',
      });
    }
  }, [orders]);

  // Each order's items array only carries {isbn, quantity} — fetch the full
  // Book (title, cover) per unique ISBN across all loaded orders so the list
  // below can show a real thumbnail and title instead of a bare ISBN. Only
  // fetches ISBNs not already in `bookDetails`, so a later in-place order
  // update (handleCancel) doesn't re-fetch covers it already has.
  useEffect(() => {
    if (!orders || orders.length === 0) return;
    const isbns = new Set<string>();
    for (const o of orders) {
      for (const item of o.items) isbns.add(item.isbn);
    }
    const missing = Array.from(isbns).filter((isbn) => !(isbn in bookDetails));
    if (missing.length === 0) return;

    let ignore = false;
    Promise.all(
      missing.map((isbn) =>
        client.GET("/api/books/{isbn}", { params: { path: { isbn } } }).then(({ data }) => [isbn, data] as const)
      )
    ).then((results) => {
      if (ignore) return;
      setBookDetails((prev) => {
        const next = { ...prev };
        for (const [isbn, data] of results) {
          if (data) next[isbn] = data as Book;
        }
        return next;
      });
    });
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

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
          {session ? (
            <p className="myorders-subtitle">
              Showing holds and orders for {session.name}.
            </p>
          ) : (
            <>
              <p className="myorders-subtitle">
                Sign in to see your holds and orders.
              </p>
              <button
                type="button"
                className="myorders-signin-btn"
                onClick={() => window.dispatchEvent(new Event(AUTH_OPEN_EVENT))}
              >
                <LogIn size={16} aria-hidden="true" />
                Sign in
              </button>
            </>
          )}

          {loading && !orders && (
            <p className="myorders-subtitle" style={{ marginTop: '16px' }}>Loading your holds…</p>
          )}

          {error && (
            <div style={{ padding: '14px 16px', background: 'var(--status-out-bg)', border: '1px solid var(--status-out)', borderRadius: '8px', color: 'var(--status-out)', fontSize: '14px', marginTop: '20px', marginBottom: '4px' }} role="alert">
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
                We don't see any holds or orders on your account yet. Browse our shelves to find your next great read!
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
                      <div style={{ fontSize: '12.5px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8a7e6f', marginBottom: '10px', fontWeight: 600 }}>
                        Reserved Books ({o.items.length})
                      </div>
                      <ul className="myorders-item-list">
                        {o.items.map((item) => {
                          const book = bookDetails[item.isbn];
                          const hasCover = Boolean(book?.cover_image_url) && !bookCoverErrors[item.isbn];
                          return (
                            <li key={item.isbn} className="myorders-item-row">
                              <div className="myorders-item-thumb">
                                {book && hasCover ? (
                                  <img
                                    src={book.cover_image_url}
                                    alt={`Cover for ${book.title}`}
                                    className="myorders-item-thumb-img"
                                    onError={() => setBookCoverErrors((prev) => ({ ...prev, [item.isbn]: true }))}
                                  />
                                ) : (
                                  <span className="myorders-item-thumb-fallback" aria-hidden="true">
                                    {(book?.title ?? item.isbn).charAt(0).toUpperCase()}
                                  </span>
                                )}
                              </div>
                              <div className="myorders-item-meta">
                                <span className="myorders-item-title">
                                  {book ? book.title : <>ISBN <span style={{ fontFamily: 'var(--mono)', fontSize: '13px' }}>{item.isbn}</span></>}
                                </span>
                                {book && <span className="myorders-item-author">{book.author}</span>}
                              </div>
                              <span className="myorders-item-qty">Qty: {item.quantity}</span>
                            </li>
                          );
                        })}
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
