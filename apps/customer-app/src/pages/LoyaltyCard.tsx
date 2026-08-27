import { useEffect, useState } from 'react';
import { client } from '../api/client';
import type { components } from '../api/types';
import { Search, Gift, Award, Check, BookOpen, AlertCircle } from 'lucide-react';
import { getCustomerSession, clearCustomerSession, subscribeToCustomerSession } from '../lib/customerSession';
import './LoyaltyCard.css';

type Customer = components["schemas"]["Customer"];

export default function LoyaltyCard() {
  const [phone, setPhone] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState(() => getCustomerSession());
  const [showManualLookup, setShowManualLookup] = useState(false);

  // Session auto-load: the loyalty endpoint returns only the stamp counters,
  // so the display fields the card already knows (name, phone, id) come from
  // the session itself. The `customer &&` render block below is unchanged
  // and shared with the manual phone-lookup path.
  useEffect(() => {
    if (!session) return;
    setLoading(true);
    setError(null);
    client.GET("/api/customers/{customer_id}/loyalty", {
      params: { path: { customer_id: session.customer_id } }
    })
      .then(({ data, error: fetchError, response }) => {
        if (data) {
          setCustomer({
            customer_id: session.customer_id,
            phone: session.phone,
            name: session.name,
            email: "",
            stamps: data.stamps,
            rewards_available: data.rewards_available,
            joined_date: "",
          });
        } else if (fetchError) {
          if (response.status === 404) {
            // The session's customer_id no longer resolves server-side —
            // the session itself is stale/broken, not "wrong person is
            // signed in". Clear it and fall back to the manual lookup form
            // rather than rendering a "Not you?" link that implies the
            // wrong customer is signed in.
            clearCustomerSession();
            setCustomer(null);
            setError("Your saved session looks out of date. Please look yourself up again.");
          } else {
            setError("Could not retrieve your stamp card.");
          }
        }
      })
      .catch(() => {
        setError("Unable to connect to the store database. Please try again.");
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reactive to sign-out (and cross-tab sign-in/out) happening while this
  // page is already mounted. When the session disappears out from under an
  // already-loaded stamp card, fall back to the same "no session" state:
  // clear the loaded customer data and let the render below fall through to
  // the manual lookup form.
  useEffect(() => {
    return subscribeToCustomerSession(() => {
      const next = getCustomerSession();
      setSession(next);
      if (!next) {
        setCustomer(null);
        setError(null);
      }
    });
  }, []);

  const fetchLoyalty = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      setError("Please enter a valid 10-digit phone number.");
      return;
    }

    setLoading(true);
    try {
      const { data, error: fetchError, response: fetchResponse } = await client.POST("/api/customers/lookup", {
        body: { phone: cleanPhone }
      });

      if (fetchError) {
        if (fetchResponse.status === 404) {
          setError("No customer record found with that number. Place a hold on any book to automatically register!");
        } else {
          setError("An error occurred while finding your loyalty card.");
        }
        setCustomer(null);
      } else if (data) {
        setCustomer(data as Customer);
      }
    } catch {
      setError("Unable to connect to the store database. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <section className="loyalty-hero">
        <div className="loyalty-hero-copy">
          <p className="loyalty-eyebrow">Riverside Books · Readers Club</p>
          <h1 className="loyalty-title">Frequent Reader Stamp Card</h1>
          <p className="loyalty-subtitle">
            Earn 1 stamp for every book purchased. Collect 10 stamps to earn a free paperback of your choice!
          </p>

          {session && !showManualLookup ? (
            <button
              type="button"
              className="rule-link"
              onClick={() => setShowManualLookup(true)}
            >
              Not you? Look up another number
            </button>
          ) : (
            <>
              <form onSubmit={fetchLoyalty} className="loyalty-lookup-form">
                <div className="loyalty-input-wrapper">
                  <Search size={18} className="loyalty-input-icon" aria-hidden="true" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. (845) 555-0142"
                    aria-label="Phone number"
                    required
                    className="loyalty-input"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="loyalty-submit-btn"
                >
                  {loading ? "Checking..." : "View Stamp Card"}
                </button>
              </form>

              {session && (
                <button
                  type="button"
                  className="rule-link"
                  onClick={() => setShowManualLookup(false)}
                >
                  Back to my stamp card
                </button>
              )}
            </>
          )}
        </div>

        <div className="loyalty-hero-art">
          <svg
            viewBox="0 0 400 400"
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="loyaltyBgv" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#4a1f3d" />
                <stop offset="1" stopColor="#241030" />
              </linearGradient>
              <linearGradient id="loyaltyCardFace" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#c14a38" />
                <stop offset="1" stopColor="#8a2f22" />
              </linearGradient>
              <radialGradient id="loyaltyStampFill" cx="0.35" cy="0.3" r="0.85">
                <stop offset="0" stopColor="#e2a355" />
                <stop offset="1" stopColor="#b9782f" />
              </radialGradient>
            </defs>
            <rect width="400" height="400" fill="url(#loyaltyBgv)" />
            <g stroke="#fbf7f0" strokeOpacity="0.05">
              <path d="M 200 -20 L 520 460" />
              <path d="M 140 -20 L 460 460" />
              <path d="M 260 -20 L -60 460" />
            </g>

            {/* Punch card body */}
            <rect x="60" y="108" width="280" height="184" rx="18" fill="url(#loyaltyCardFace)" />
            <rect x="60" y="108" width="280" height="184" rx="18" fill="none" stroke="#fbf7f0" strokeOpacity="0.16" strokeWidth="2" />
            <rect x="84" y="130" width="64" height="12" rx="4" fill="#fbf7f0" opacity="0.35" />
            <rect x="84" y="150" width="40" height="8" rx="3" fill="#fbf7f0" opacity="0.2" />

            {/* Perforation notch, ticket-stub style */}
            <circle cx="60" cy="200" r="10" fill="#241030" />
            <circle cx="340" cy="200" r="10" fill="#241030" />

            {/* Ten stamp slots, 5x2 grid — six filled, three open, one reward slot */}
            <g>
              <circle cx="95" cy="200" r="19" fill="url(#loyaltyStampFill)" />
              <circle cx="150" cy="200" r="19" fill="url(#loyaltyStampFill)" />
              <circle cx="205" cy="200" r="19" fill="url(#loyaltyStampFill)" />
              <circle cx="260" cy="200" r="19" fill="url(#loyaltyStampFill)" />
              <circle cx="315" cy="200" r="19" fill="url(#loyaltyStampFill)" />
              <circle cx="95" cy="260" r="19" fill="url(#loyaltyStampFill)" />

              {/* Ink-mark detail on filled stamps */}
              <g fill="#241030" opacity="0.28">
                <circle cx="95" cy="200" r="6" />
                <circle cx="150" cy="200" r="6" />
                <circle cx="205" cy="200" r="6" />
                <circle cx="260" cy="200" r="6" />
                <circle cx="315" cy="200" r="6" />
                <circle cx="95" cy="260" r="6" />
              </g>

              {/* Open slots */}
              <circle cx="150" cy="260" r="19" fill="none" stroke="#fbf7f0" strokeOpacity="0.3" strokeWidth="2" strokeDasharray="4 4" />
              <circle cx="205" cy="260" r="19" fill="none" stroke="#fbf7f0" strokeOpacity="0.3" strokeWidth="2" strokeDasharray="4 4" />
              <circle cx="260" cy="260" r="19" fill="none" stroke="#fbf7f0" strokeOpacity="0.3" strokeWidth="2" strokeDasharray="4 4" />

              {/* Reward slot */}
              <circle cx="315" cy="260" r="19" fill="rgba(226,163,85,0.12)" stroke="#e2a355" strokeOpacity="0.8" strokeWidth="2" strokeDasharray="3 3" />
              <path d="M 315 251 l 3.6 7.3 8 1.2 -5.8 5.6 1.4 8 -7.2 -3.8 -7.2 3.8 1.4 -8 -5.8 -5.6 8 -1.2 z" fill="#e2a355" opacity="0.85" />
            </g>
          </svg>
        </div>
      </section>

      <section className="loyalty-rule" aria-label="How the stamp card works">
        <div className="rule-item">
          <div className="rule-number" aria-hidden="true">01</div>
          <h2 className="rule-title">One stamp per book</h2>
          <p className="rule-desc">
            Earn 1 stamp for every book purchased.
          </p>
        </div>
        <div className="rule-item">
          <div className="rule-number" aria-hidden="true">02</div>
          <h2 className="rule-title">Ten stamps, one free book</h2>
          <p className="rule-desc">
            Collect 10 stamps to earn a free paperback of your choice.
          </p>
        </div>
        <div className="rule-item">
          <div className="rule-number" aria-hidden="true">03</div>
          <h2 className="rule-title">Added automatically</h2>
          <p className="rule-desc">
            Stamps are automatically added whenever you buy or pick up a book with this phone number.
          </p>
        </div>
      </section>

      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        {error && (
          <div style={{ padding: '14px 16px', background: 'var(--status-out-bg)', border: '1px solid var(--status-out)', borderRadius: '8px', color: 'var(--status-out)', fontSize: '14px', marginBottom: '24px' }} role="alert">
            <AlertCircle size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} />
            {error}
          </div>
        )}

        {customer && (
          <div
            role="status"
            aria-live="polite"
            style={{
              background: 'var(--bg-raised)',
              border: '2px solid var(--border)',
              borderRadius: '16px',
              padding: '28px',
              boxShadow: 'rgba(36, 29, 22, 0.08) 0 12px 24px -4px',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border)', paddingBottom: '16px', marginBottom: '22px' }}>
              <div>
                <span style={{ fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#8a7e6f', fontWeight: 600 }}>
                  Riverside Books · Readers Club
                </span>
                <h2 style={{ fontFamily: 'var(--heading)', fontSize: '24px', fontWeight: 500, color: 'var(--text-h)', margin: '4px 0 0' }}>
                  {customer.name}
                </h2>
              </div>
              <span style={{ fontFamily: 'var(--mono)', fontSize: '12px', background: 'var(--code-bg)', padding: '4px 8px', borderRadius: '4px', color: '#6c6155' }}>
                {customer.customer_id}
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: '14px',
                margin: '24px 0'
              }}
            >
              {[...Array(10)].map((_, i) => {
                const isStamped = i < customer.stamps;
                const isRewardSlot = i === 9;
                return (
                  <div
                    key={i}
                    style={{
                      aspectRatio: '1',
                      borderRadius: '50%',
                      border: isStamped
                        ? '2px solid var(--accent)'
                        : isRewardSlot
                        ? '2px dashed var(--accent)'
                        : '2px dashed var(--border)',
                      background: isStamped
                        ? 'var(--accent-bg)'
                        : isRewardSlot
                        ? 'rgba(166, 61, 47, 0.04)'
                        : 'transparent',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isStamped ? 'var(--accent)' : '#8a7e6f',
                      position: 'relative',
                      transform: isStamped ? 'rotate(-3deg)' : 'none',
                      transition: 'transform 0.15s ease'
                    }}
                  >
                    {isStamped ? (
                      <Check size={22} strokeWidth={2.8} />
                    ) : isRewardSlot ? (
                      <Gift size={20} color="var(--accent)" />
                    ) : (
                      <span style={{ fontSize: '14px', fontWeight: 600, color: '#8a7e6f' }}>{i + 1}</span>
                    )}
                    {isRewardSlot && !isStamped && (
                      <span style={{ fontSize: '9px', fontWeight: 600, color: 'var(--accent)', marginTop: '2px' }}>FREE</span>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ textAlign: 'center', margin: '18px 0' }}>
              <p style={{ fontSize: '16px', color: 'var(--text-h)', margin: 0 }}>
                <strong>{customer.stamps} / 10</strong> stamps collected
              </p>
              <p style={{ fontSize: '13px', color: '#6c6155', marginTop: '4px' }}>
                {10 - customer.stamps > 0
                  ? `${10 - customer.stamps} more stamp${10 - customer.stamps === 1 ? '' : 's'} until your next free book reward!`
                  : "Card complete! Ready for reward redemption."}
              </p>
            </div>

            {customer.rewards_available > 0 && (
              <div
                style={{
                  marginTop: '20px',
                  padding: '16px 20px',
                  background: 'var(--accent)',
                  color: 'var(--ink-text)',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px'
                }}
              >
                <Award size={32} style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '15px' }}>
                    {customer.rewards_available} Free Book Reward{customer.rewards_available > 1 ? 's' : ''} Available!
                  </div>
                  <div style={{ fontSize: '13px', opacity: 0.92, marginTop: '2px' }}>
                    Redeem in-store at the register on your next visit.
                  </div>
                </div>
              </div>
            )}

            <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#8a7e6f' }}>
              <BookOpen size={15} />
              <span>Stamps are automatically added whenever you buy or pick up a book with this phone number.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
