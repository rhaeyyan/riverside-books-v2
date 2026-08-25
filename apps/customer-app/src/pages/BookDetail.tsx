import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { client } from '../api/client';
import { formatMoney } from '../utils/format';
import type { components } from '../api/types';

type Book = components["schemas"]["Book"];

export default function BookDetail() {
  const { isbn } = useParams<{ isbn: string }>();
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [needsRegistration, setNeedsRegistration] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [holdExpiresAt, setHoldExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isbn) {
      client.GET("/api/books/{isbn}", { params: { path: { isbn } } }).then(({ data, error }) => {
        if (data) setBook(data as Book);
        if (error) setError("Book not found.");
        setLoading(false);
      });
    }
  }, [isbn]);

  const handlePreOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!book) return;

    const cleanPhone = phone.replace(/\D/g, "");
    let customerId = "";

    if (needsRegistration && name.trim()) {
      const { data: regData, error: regError } = await client.POST("/api/customers", {
        body: { phone: cleanPhone, name, email: "" }
      });
      if (regError) {
        setError("Registration failed.");
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
        return;
      }
      customerId = (custData as any).customer_id;
    }

    const { data, error: orderError, response: orderResponse } = await client.POST("/api/orders", {
      body: {
        customer_id: customerId,
        items: [{ isbn: book.isbn, quantity: 1 }],
        notes: "Pre-order"
      }
    });

    if (orderError) {
      if (orderResponse.status === 409) {
        setError("Someone just placed a hold on the last copy! Please check back later.");
        client.GET("/api/books/{isbn}", { params: { path: { isbn: book.isbn } } }).then(res => res.data && setBook(res.data as Book));
      } else {
        setError((orderError as any).detail || "An error occurred.");
      }
    } else if (data) {
      setOrderId((data as any).order_id);
      setHoldExpiresAt((data as any).hold_expires_at);
      client.GET("/api/books/{isbn}", { params: { path: { isbn: book.isbn } } }).then(res => res.data && setBook(res.data as Book));
    }
  };

  if (loading) return <p>Loading...</p>;
  if (!book) return <p>{error || "Not found"}</p>;

  const outOfStock = book.available_count === 0;

  return (
    <div style={{ display: 'flex', gap: '2rem' }}>
      <div style={{ flex: '1', maxWidth: '300px' }}>
        <img src={book.cover_image_url || ""} alt="Cover" style={{ width: '100%' }} />
      </div>
      <div style={{ flex: '2' }}>
        <h2>{book.title}</h2>
        <h3 style={{ color: '#666' }}>{book.author}</h3>
        <p><strong>Genre:</strong> {book.genre} | <strong>Format:</strong> {book.format}</p>
        <p><strong>ISBN:</strong> {book.isbn}</p>
        <p style={{ fontSize: '1.2rem', marginTop: '1rem' }}>{book.blurb}</p>
        <h2 style={{ color: '#007bff' }}>{formatMoney(book.price_cents)}</h2>
        
        <div style={{ margin: '2rem 0', padding: '1rem', background: '#f8f9fa', borderRadius: '8px' }}>
          {orderId ? (
            <div style={{ color: 'green' }}>
              <h3>Success! Hold placed.</h3>
              <p>Your order ID is <strong>{orderId}</strong>.</p>
              <p>Please pick it up by <strong>{new Date(holdExpiresAt!).toLocaleString()}</strong>.</p>
              <Link to="/orders">View My Orders</Link>
            </div>
          ) : (
            <form onSubmit={handlePreOrder} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '300px' }}>
              <h3>Place a 48-Hour Hold</h3>
              {error && <p style={{ color: 'red' }}>{error}</p>}
              
              <label>
                Phone Number:
                <input 
                  type="tel" 
                  value={phone} 
                  onChange={(e) => setPhone(e.target.value)} 
                  required 
                  style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
                />
              </label>

              {needsRegistration && (
                <label>
                  Full Name (New Customer):
                  <input 
                    type="text" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    required 
                    style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
                  />
                </label>
              )}

              {outOfStock ? (
                <button type="button" disabled style={{ padding: '0.75rem', background: '#ccc', cursor: 'not-allowed' }}>
                  Out of Stock - Cannot place hold
                </button>
              ) : (
                <button type="submit" style={{ padding: '0.75rem', background: '#28a745', color: 'white', border: 'none', cursor: 'pointer' }}>
                  {needsRegistration ? "Register & Place Hold" : "Place Hold"}
                </button>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
