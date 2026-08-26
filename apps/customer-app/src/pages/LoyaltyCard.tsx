import { useState } from 'react';
import { client } from '../api/client';
import type { components } from '../api/types';
import { Search, Gift, Award, Check, BookOpen, AlertCircle } from 'lucide-react';

type Customer = components["schemas"]["Customer"];

export default function LoyaltyCard() {
  const [phone, setPhone] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <div style={{ maxWidth: '640px', margin: '0 auto', paddingTop: '12px' }}>
      <h1 style={{ fontFamily: 'var(--heading)', fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 500, color: 'var(--text-h)', margin: '0 0 8px' }}>
        Frequent Reader Stamp Card
      </h1>
      <p style={{ fontSize: '15.5px', color: '#6c6155', margin: '0 0 24px', lineHeight: 1.5 }}>
        Earn 1 stamp for every book purchased. Collect 10 stamps to earn a free paperback of your choice!
      </p>

      <form onSubmit={fetchLoyalty} style={{ display: 'flex', gap: '10px', marginBottom: '28px', flexWrap: 'wrap' }}>
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
          {loading ? "Checking..." : "View Stamp Card"}
        </button>
      </form>

      {error && (
        <div style={{ padding: '14px 16px', background: 'var(--status-out-bg)', border: '1px solid var(--status-out)', borderRadius: '8px', color: 'var(--status-out)', fontSize: '14px', marginBottom: '24px' }} role="alert">
          <AlertCircle size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} />
          {error}
        </div>
      )}

      {customer && (
        <div
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
                color: '#ffffff',
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
  );
}
