import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { client } from '../api/client';
import { formatMoney } from '../utils/format';
import type { components } from '../api/types';

type Book = components["schemas"]["Book"];

export default function Home() {
  const [books, setBooks] = useState<Book[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchBooks = async (searchQuery: string) => {
    setLoading(true);
    const { data } = await client.GET("/api/books", {
      params: { query: { q: searchQuery || undefined } }
    });
    if (data) setBooks(data as Book[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchBooks("");
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchBooks(query);
  };

  return (
    <div>
      <h2>Browse Books</h2>
      <form onSubmit={handleSearch} style={{ marginBottom: '2rem', display: 'flex', gap: '0.5rem' }}>
        <input 
          type="text" 
          value={query} 
          onChange={(e) => setQuery(e.target.value)} 
          placeholder="Search by title, author, or ISBN..." 
          style={{ padding: '0.5rem', width: '300px' }}
        />
        <button type="submit" style={{ padding: '0.5rem 1rem' }}>Search</button>
      </form>

      {loading ? (
        <p>Loading books...</p>
      ) : books.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', background: '#f8f9fa', borderRadius: '8px' }}>
          <h3>No books found matching "{query}"</h3>
          <p>Would you like to ask our chatbot about special orders?</p>
          <button 
            onClick={() => document.getElementById("chatbot-toggle")?.click()}
            style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}
          >
            Open Chat
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '2rem' }}>
          {books.map(b => (
            <div key={b.isbn} style={{ border: '1px solid #ddd', padding: '1rem', borderRadius: '8px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ background: '#eee', height: '200px', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {b.cover_image_url && <img src={b.cover_image_url} alt="Cover" style={{ maxHeight: '100%', maxWidth: '100%' }} />}
              </div>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem' }}>{b.title}</h3>
              <p style={{ margin: '0 0 0.5rem 0', color: '#666' }}>{b.author}</p>
              <div style={{ marginTop: 'auto' }}>
                <p style={{ fontWeight: 'bold', margin: '0 0 0.5rem 0' }}>{formatMoney(b.price_cents)}</p>
                <StockBadge status={b.stock_status} available={b.available_count} />
                <Link to={`/book/${b.isbn}`} style={{ display: 'block', marginTop: '1rem', textAlign: 'center', background: '#007bff', color: 'white', textDecoration: 'none', padding: '0.5rem', borderRadius: '4px' }}>
                  View Details
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StockBadge({ status, available }: { status: string, available: number }) {
  if (status === 'out_of_stock') return <span style={{ color: 'red', fontWeight: 'bold' }}>Out of stock</span>;
  if (status === 'low_stock') return <span style={{ color: 'orange', fontWeight: 'bold' }}>Only {available} left</span>;
  return <span style={{ color: 'green', fontWeight: 'bold' }}>In stock ({available} copies)</span>;
}
