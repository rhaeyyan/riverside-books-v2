import { useEffect, useRef, useState } from 'react';
import { client } from '../api/client';
import type { components } from '../api/types';
import { Gift, Award, Check, BookOpen, AlertCircle, LogIn } from 'lucide-react';
import { getCustomerSession, clearCustomerSession, subscribeToCustomerSession } from '../lib/customerSession';
import { AUTH_OPEN_EVENT } from '../components/AuthDialog';
import { prefersReducedMotion } from '../utils/motion';
import './LoyaltyCard.css';

type Customer = components["schemas"]["Customer"];

export default function LoyaltyCard() {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState(() => getCustomerSession());
  const resultsRef = useRef<HTMLDivElement>(null);
  // Set true right before a session auto-load resolves into `customer`, so
  // the scroll effect below only fires as the direct result of that load,
  // not on first mount.
  const shouldScrollToResults = useRef(false);

  // Session auto-load: the loyalty endpoint returns only the stamp counters,
  // so the display fields the card already knows (name, email, phone, id)
  // come from the session itself.
  const loadLoyaltyForSession = (s: NonNullable<ReturnType<typeof getCustomerSession>>) => {
    shouldScrollToResults.current = true;
    setLoading(true);
    setError(null);
    client.GET("/api/customers/{customer_id}/loyalty", {
      params: { path: { customer_id: s.customer_id } }
    })
      .then(({ data, error: fetchError, response }) => {
        if (data) {
          setCustomer({
            customer_id: s.customer_id,
            email: s.email,
            name: s.name,
            phone: s.phone,
            stamps: data.stamps,
            rewards_available: data.rewards_available,
            joined_date: "",
          });
        } else if (fetchError) {
          if (response.status === 404) {
            // The session's customer_id no longer resolves server-side —
            // the session itself is stale/broken, not "wrong person is
            // signed in". Clear it and fall back to the sign-in prompt
            // rather than rendering a stamp card for a customer that no
            // longer exists.
            clearCustomerSession();
            setCustomer(null);
            setError("Your saved session looks out of date. Please sign in again.");
          } else {
            setError("Could not retrieve your stamp card.");
          }
        }
      })
      .catch(() => {
        setError("Unable to connect to the store database. Please try again.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (session) loadLoyaltyForSession(session);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reactive to sign-out (and cross-tab sign-in/out) happening while this
  // page is already mounted, and to a sign-in completed through AuthDialog
  // while this page is open. When the session disappears out from under an
  // already-loaded stamp card, fall back to the same "no session" state:
  // clear the loaded customer data and let the render below fall through to
  // the sign-in prompt. When a session appears, load its stamp card.
  useEffect(() => {
    return subscribeToCustomerSession(() => {
      const next = getCustomerSession();
      setSession(next);
      if (next) {
        loadLoyaltyForSession(next);
      } else {
        setCustomer(null);
        setError(null);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll the stamp card into view once it arrives from a session load,
  // not on initial mount.
  useEffect(() => {
    if (customer && shouldScrollToResults.current) {
      shouldScrollToResults.current = false;
      resultsRef.current?.scrollIntoView({
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        block: 'start',
      });
    }
  }, [customer]);

  return (
    <div>
      <section className={`loyalty-hero${customer ? ' loyalty-hero--with-card' : ''}`}>
        <div className="loyalty-hero-copy">
          <p className="loyalty-eyebrow">Riverside Books · Readers Club</p>
          <h1 className="loyalty-title">Frequent Reader Stamp Card</h1>
          <p className="loyalty-subtitle">
            Earn 1 stamp for every book purchased. Collect 10 stamps to earn a free paperback of your choice!
          </p>

          {!session && (
            <button
              type="button"
              className="loyalty-submit-btn"
              onClick={() => window.dispatchEvent(new Event(AUTH_OPEN_EVENT))}
            >
              <LogIn size={16} aria-hidden="true" style={{ marginRight: '8px', verticalAlign: 'text-bottom' }} />
              Sign in to see your stamp card
            </button>
          )}

          {loading && !customer && (
            <p className="loyalty-subtitle" style={{ marginTop: '16px' }}>Checking your stamp card…</p>
          )}

          {error && (
            <div className="loyalty-error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {error}
            </div>
          )}
        </div>

        {customer && (
          <div className="loyalty-card" role="status" aria-live="polite" ref={resultsRef}>
            <div className="loyalty-card-header">
              <div>
                <span className="loyalty-card-eyebrow">Riverside Books · Readers Club</span>
                <h2 className="loyalty-card-name">{customer.name}</h2>
              </div>
              <span className="loyalty-card-id">{customer.customer_id}</span>
            </div>

            <div className="loyalty-stamp-grid" key={customer.customer_id}>
              {[...Array(10)].map((_, i) => {
                const isStamped = i < customer.stamps;
                const isRewardSlot = i === 9;
                return (
                  <div
                    key={i}
                    className={[
                      "loyalty-stamp",
                      isStamped && "loyalty-stamp--filled",
                      isRewardSlot && !isStamped && "loyalty-stamp--reward",
                    ].filter(Boolean).join(" ")}
                    style={{
                      animationDelay: `${i * 45}ms`,
                      "--stamp-rotate": isStamped ? "-3deg" : "0deg",
                    } as React.CSSProperties}
                  >
                    {isStamped ? (
                      <Check size={22} strokeWidth={2.8} aria-hidden="true" />
                    ) : isRewardSlot ? (
                      <Gift size={20} aria-hidden="true" />
                    ) : (
                      <span className="loyalty-stamp-index">{i + 1}</span>
                    )}
                    {isRewardSlot && !isStamped && (
                      <span className="loyalty-stamp-reward-label">FREE</span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="loyalty-progress" aria-hidden="true" key={customer.customer_id}>
              <div className="loyalty-progress-track">
                <div
                  className="loyalty-progress-fill"
                  style={{ "--progress-target": `${(customer.stamps / 10) * 100}%` } as React.CSSProperties}
                />
              </div>
            </div>

            <div className="loyalty-progress-text">
              <p className="loyalty-progress-text-count">
                <strong>{customer.stamps} / 10</strong> stamps collected
              </p>
              <p className="loyalty-progress-text-hint">
                {10 - customer.stamps > 0
                  ? `${10 - customer.stamps} more stamp${10 - customer.stamps === 1 ? '' : 's'} until your next free book reward!`
                  : "Card complete! Ready for reward redemption."}
              </p>
            </div>

            {customer.rewards_available > 0 && (
              <div className="loyalty-reward-banner">
                <Award size={32} aria-hidden="true" />
                <div>
                  <div className="loyalty-reward-banner-title">
                    {customer.rewards_available} Free Book Reward{customer.rewards_available > 1 ? 's' : ''} Available!
                  </div>
                  <div className="loyalty-reward-banner-desc">
                    Redeem in-store at the register on your next visit.
                  </div>
                </div>
              </div>
            )}

            <div className="loyalty-card-footer">
              <BookOpen size={15} aria-hidden="true" />
              <span>Stamps are automatically added whenever you buy or pick up a book on your account.</span>
            </div>
          </div>
        )}
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
            Stamps are automatically added whenever you buy or pick up a book on your account.
          </p>
        </div>
      </section>
    </div>
  );
}

