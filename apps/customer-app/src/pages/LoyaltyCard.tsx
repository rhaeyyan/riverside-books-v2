import { useState } from 'react';
import { client } from '../api/client';
import type { components } from '../api/types';

type Customer = components["schemas"]["Customer"];

export default function LoyaltyCard() {
  const [phone, setPhone] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchLoyalty = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanPhone = phone.replace(/\D/g, "");
    
    const { data, error: fetchError } = await client.POST("/api/customers/lookup", {
      body: { phone: cleanPhone }
    });

    if (fetchError) {
      const status = (fetchError as any).status;
      if (status === 404) setError("Customer not found. Place an order to register!");
      else setError("An error occurred.");
      setCustomer(null);
    } else if (data) {
      setCustomer(data as Customer);
    }
  };

  return (
    <div>
      <h2>Loyalty Card</h2>
      <form onSubmit={fetchLoyalty} style={{ marginBottom: '2rem', display: 'flex', gap: '0.5rem' }}>
        <input 
          type="tel" 
          value={phone} 
          onChange={(e) => setPhone(e.target.value)} 
          placeholder="Enter phone number" 
          style={{ padding: '0.5rem', width: '250px' }}
          required
        />
        <button type="submit" style={{ padding: '0.5rem 1rem' }}>Check Loyalty</button>
      </form>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {customer && (
        <div style={{ background: '#fff', border: '2px solid #007bff', borderRadius: '16px', padding: '2rem', maxWidth: '500px', textAlign: 'center' }}>
          <h3>{customer.name}'s Rewards</h3>
          
          <div style={{ margin: '2rem 0', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem' }}>
            {[...Array(10)].map((_, i) => (
              <div 
                key={i} 
                style={{
                  aspectRatio: '1',
                  borderRadius: '50%',
                  border: '2px dashed #ccc',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: i < customer.stamps ? '#007bff' : 'transparent',
                  color: i < customer.stamps ? 'white' : '#ccc',
                  fontWeight: 'bold',
                  fontSize: '1.5rem'
                }}
              >
                {i < customer.stamps ? '✓' : ''}
              </div>
            ))}
          </div>
          
          <p style={{ fontSize: '1.2rem' }}>
            <strong>{customer.stamps} / 10</strong> stamps collected
          </p>
          
          {customer.rewards_available > 0 && (
            <div style={{ marginTop: '1rem', padding: '1rem', background: '#28a745', color: 'white', borderRadius: '8px' }}>
              <h3>🎉 You have {customer.rewards_available} free book reward{customer.rewards_available > 1 ? 's' : ''}!</h3>
              <p>Redeem in-store today.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
