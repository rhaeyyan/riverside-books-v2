import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { client } from '../api/client';
import { formatMoney } from '../utils/format';
import type { components } from '../api/types';
import { ArrowLeft, CheckCircle2, MessageSquare, Clock, AlertCircle } from 'lucide-react';
import './BookDetail.css';

type Book = components["schemas"]["Book"];

export default function BookDetail() {
  const { isbn } = useParams<{ isbn: string }>();
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [coverError, setCoverError] = useState(false);
  
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [needsRegistration, setNeedsRegistration] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [holdExpiresAt, setHoldExpiresAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    if (isbn) {
      client.GET("/api/books/{isbn}", { params: { path: { isbn } } }).then(({ data, error: fetchErr }) => {
        if (!ignore) {
          if (data) setBook(data as Book);
          if (fetchErr) setError("Book not found on our shelves.");
          setLoading(false);
        }
      });
    }
    return () => {
      ignore = true;
    };
  }, [isbn]);

  const handlePreOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!book) return;

    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      setError("Please enter a valid 10-digit phone number.");
      return;
    }

    setSubmitting(true);
    let customerId = "";

    try {
      if (needsRegistration && name.trim()) {
        const { data: regData, error: regError } = await client.POST("/api/customers", {
          body: { phone: cleanPhone, name: name.trim(), email: "" }
        });
        if (regError) {
          setError("Could not register your phone number. Please check the format.");
          setSubmitting(false);
          return;
        }
        customerId = (regData as any).customer_id;
        setNeedsRegistration(false);
      } else {
        const { data: custData, error: custError } = await client.POST("/api/customers/lookup", {
          body: { phone: cleanPhone }
        });
        if (custError) {
          setNeedsRegistration(true);
          setSubmitting(false);
          return;
        }
        customerId = (custData as any).customer_id;
      }

      const { data, error: orderError, response: orderResponse } = await client.POST("/api/orders", {
        body: {
          customer_id: customerId,
          items: [{ isbn: book.isbn, quantity: 1 }],
          notes: "Customer hold"
        }
      });

      if (orderError) {
        if (orderResponse.status === 409) {
          setError("Someone just placed a hold on the last copy! Please check back later or ask our bookseller.");
          const res = await client.GET("/api/books/{isbn}", { params: { path: { isbn: book.isbn } } });
          if (res.data) setBook(res.data as Book);
        } else {
          setError((orderError as any).detail || "Could not place hold. Please try again.");
        }
      } else if (data) {
        setOrderId((data as any).order_id);
        setHoldExpiresAt((data as any).hold_expires_at);
        const res = await client.GET("/api/books/{isbn}", { params: { path: { isbn: book.isbn } } });
        if (res.data) setBook(res.data as Book);
      }
    } catch {
      setError("A connection error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text)' }}>
        <p>Looking up book details...</p>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="book-detail-page">
        <Link to="/" className="back-link">
          <ArrowLeft size={16} />
          Back to browsing
        </Link>
        <div style={{ padding: '40px', background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: '12px', textAlign: 'center' }}>
          <h2>{error || "Book not found"}</h2>
          <p style={{ margin: '12px 0 20px', color: '#6c6155' }}>The title you requested might have been moved or removed.</p>
          <Link to="/" className="btn-secondary" style={{ display: 'inline-flex' }}>
            Browse Available Books
          </Link>
        </div>
      </div>
    );
  }

  const outOfStock = book.available_count === 0;
  const hasCover = Boolean(book.cover_image_url) && !coverError;

  return (
    <div className="book-detail-page">
      <Link to="/" className="back-link">
        <ArrowLeft size={16} />
        Back to browsing
      </Link>

      <div className="book-detail-layout">
        <div className="book-detail-cover">
          {hasCover ? (
            <img
              src={book.cover_image_url}
              alt={`Cover art for ${book.title}`}
              className="book-detail-cover-img"
              onError={() => setCoverError(true)}
            />
          ) : (
            <div className="book-cover-fallback">
              <span className="book-fallback-initial">{book.title.charAt(0).toUpperCase()}</span>
              <span className="book-fallback-isbn">ISBN · {book.isbn}</span>
            </div>
          )}
        </div>

        <div className="book-detail-info">
          <h1 className="book-detail-title">{book.title}</h1>
          <div className="book-detail-author">by {book.author}</div>

          <div className="book-detail-meta-row">
            <StockBadge status={book.stock_status} available={book.available_count} />
            <span className="book-detail-price">{formatMoney(book.price_cents)}</span>
          </div>

          {book.blurb && <p className="book-detail-blurb">{book.blurb}</p>}

          <dl className="book-detail-specs">
            <div className="spec-item">
              <dt>Format</dt>
              <dd>{book.format ? book.format.charAt(0).toUpperCase() + book.format.slice(1) : "Paperback"}</dd>
            </div>
            <div className="spec-item">
              <dt>Genre</dt>
              <dd>{book.genre || "General"}</dd>
            </div>
            <div className="spec-item">
              <dt>ISBN</dt>
              <dd className="spec-isbn">{book.isbn}</dd>
            </div>
            <div className="spec-item">
              <dt>On The Shelf</dt>
              <dd>
                {book.available_count > 0 ? (
                  <span style={{ color: 'var(--status-in)' }}>{book.available_count} available</span>
                ) : (
                  <span style={{ color: 'var(--status-out)' }}>0 copies</span>
                )}
              </dd>
            </div>
          </dl>

          <div className="hold-card-wrapper">
            {orderId ? (
              <div className="hold-success-card">
                <div className="hold-success-title">
                  <CheckCircle2 size={22} color="var(--status-in)" />
                  It's behind the counter for you!
                </div>
                <p className="hold-success-body">
                  Ask for hold <strong className="hold-order-id-badge">{orderId}</strong> when you arrive at the register.
                  {holdExpiresAt && (
                    <> We'll hold it until <strong>{new Date(holdExpiresAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong> (48 hours).</>
                  )}
                </p>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <Link to="/orders" className="btn-hold-submit" style={{ textDecoration: 'none' }}>
                    View My Holds
                  </Link>
                  <Link to="/" className="btn-secondary" style={{ textDecoration: 'none' }}>
                    Continue Browsing
                  </Link>
                </div>
              </div>
            ) : outOfStock ? (
              <div className="sold-out-box">
                <div className="sold-out-title">Not on the shelf right now</div>
                <p className="sold-out-desc">
                  Almost any in-print book can be special ordered at no extra charge — usually three to five days. Leave a note or ask our bookseller.
                </p>
                <div className="sold-out-actions">
                  <button
                    type="button"
                    onClick={() => document.getElementById("chatbot-toggle")?.click()}
                    className="btn-hold-submit"
                  >
                    <MessageSquare size={16} />
                    Ask a bookseller to order
                  </button>
                  <Link to="/" className="btn-secondary" style={{ textDecoration: 'none' }}>
                    See in-stock titles
                  </Link>
                </div>
              </div>
            ) : (
              <div className="hold-card">
                <div className="hold-title">Hold a copy for 48 hours</div>
                <p className="hold-subtitle">
                  Free, no credit card needed. Your phone number is your pickup code.
                </p>

                <form onSubmit={handlePreOrder} className="hold-form">
                  {error && (
                    <div className="form-error-alert" role="alert">
                      <AlertCircle size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} />
                      {error}
                    </div>
                  )}

                  <div className="form-group">
                    <label htmlFor="hold-phone" className="form-label">
                      Phone Number
                    </label>
                    <input
                      id="hold-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. (845) 555-0142"
                      required
                      className="form-input phone-input"
                      autoComplete="tel"
                    />
                  </div>

                  {needsRegistration && (
                    <div className="form-group" style={{ animation: 'riseIn 0.2s ease' }}>
                      <label htmlFor="customer-name" className="form-label">
                        Your Full Name (First time with us?)
                      </label>
                      <input
                        id="customer-name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Jane Doe"
                        required
                        className="form-input"
                        autoComplete="name"
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-hold-submit"
                  >
                    <Clock size={16} />
                    {submitting ? "Placing hold..." : needsRegistration ? "Save & Place 48-Hour Hold" : "Place 48-Hour Hold"}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>

      <section className="book-detail-promo">
        <div className="book-detail-promo-inner">
          <p className="book-detail-promo-eyebrow">The reader card</p>
          <h2 className="book-detail-promo-title">Ten stamps, and the eleventh book is on us.</h2>
          <p className="book-detail-promo-desc">
            Earn 1 stamp for every book purchased. Collect 10 stamps to earn a free paperback of your choice.
          </p>
          <Link to="/loyalty" className="book-detail-promo-cta">
            See my stamp card
          </Link>
        </div>
      </section>
    </div>
  );
}

function StockBadge({ status, available }: { status: string; available: number }) {
  if (status === 'out_of_stock') {
    return <span className="stock-pill out-of-stock">Out of stock</span>;
  }
  if (status === 'low_stock') {
    return <span className="stock-pill low-stock">Only {available} left</span>;
  }
  return <span className="stock-pill in-stock">In stock ({available})</span>;
}
