import { useState } from 'react';
import { client } from '../api/client';
import { formatMoney } from '../utils/format';
import type { components } from '../api/types';

type Order = components["schemas"]["Order"];

export default function MyOrders() {
  const [phone, setPhone] = useState("");
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanPhone = phone.replace(/\D/g, "");
    
    const { data: custData, error: custError } = await client.POST("/api/customers/lookup", {
      body: { phone: cleanPhone }
    });

    if (custError) {
      const status = (custError as any).status;
      if (status === 404) setError("Customer not found.");
      else setError("An error occurred.");
      setOrders(null);
      return;
    }

    if (custData) {
      const customerId = (custData as any).customer_id;
      const { data: orderData } = await client.GET("/api/customers/{customer_id}/orders", {
        params: { path: { customer_id: customerId } }
      });
      if (orderData) setOrders(orderData as Order[]);
    }
  };

  const handleCancel = async (orderId: string) => {
    const { error } = await client.PATCH("/api/orders/{order_id}/status", {
      params: { path: { order_id: orderId } },
      body: { status: "cancelled" }
    });
    
    if (!error && orders) {
      setOrders(orders.map(o => o.order_id === orderId ? { ...o, status: "cancelled" } : o));
    }
  };

  return (
    <div>
      <h2>My Orders</h2>
      <form onSubmit={fetchOrders} style={{ marginBottom: '2rem', display: 'flex', gap: '0.5rem' }}>
        <input 
          type="tel" 
          value={phone} 
          onChange={(e) => setPhone(e.target.value)} 
          placeholder="Enter phone number" 
          style={{ padding: '0.5rem', width: '250px' }}
          required
        />
        <button type="submit" style={{ padding: '0.5rem 1rem' }}>Find Orders</button>
      </form>
      
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {orders && (
        orders.length === 0 ? (
          <p>No orders found.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {orders.map(o => (
              <div key={o.order_id} style={{ border: '1px solid #ddd', padding: '1rem', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ margin: '0 0 0.5rem 0' }}>Order {o.order_id}</h3>
                    <p>Status: <strong>{o.status.replace(/_/g, ' ').toUpperCase()}</strong></p>
                    <p>Total: {formatMoney(o.total_cents)}</p>
                    <p>Placed: {new Date(o.created_at).toLocaleString()}</p>
                    {o.status === "pending" && (
                      <p style={{ color: 'orange' }}>
                        Hold expires: {new Date(o.hold_expires_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div>
                    {(o.status === 'pending' || o.status === 'ready_for_pickup') && (
                      <button 
                        onClick={() => handleCancel(o.order_id)}
                        style={{ padding: '0.5rem 1rem', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        Cancel Hold
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ marginTop: '1rem' }}>
                  <strong>Items:</strong>
                  <ul>
                    {o.items.map(item => (
                      <li key={item.isbn}>ISBN: {item.isbn} (Qty: {item.quantity})</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
