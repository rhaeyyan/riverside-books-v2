import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { client } from '../api/client';
import { formatMoney } from '../utils/format';
import type { components } from '../api/types';
import { Search, X, MessageSquare, BookOpen } from 'lucide-react';
import './Home.css';

type Book = components["schemas"]["Book"];

export default function Home() {
  const [books, setBooks] = useState<Book[]>([]);
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let ignore = false;
    client.GET("/api/books", {}).then(({ data }) => {
      if (!ignore) {
        if (data) setBooks(data as Book[]);
        setLoading(false);
      }
    });
    return () => {
      ignore = true;
    };
  }, []);

  const fetchBooks = async (searchQuery: string) => {
    setLoading(true);
    const { data } = await client.GET("/api/books", {
      params: { query: { q: searchQuery.trim() || undefined } }
    });
    if (data) setBooks(data as Book[]);
    setLoading(false);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchBooks(query);
  };

  const handleClear = () => {
    setQuery("");
    fetchBooks("");
  };

  // Compute genres available from fetched books
  const availableGenres = useMemo(() => {
    const genres = new Set<string>();
    for (const b of books) {
      if (b.genre && b.genre !== "Uncategorized") {
        genres.add(b.genre);
      }
    }
    return Array.from(genres);
  }, [books]);

  // Apply client-side filter chips
  const filteredBooks = useMemo(() => {
    return books.filter((b) => {
      if (activeFilter === "all") return true;
      if (activeFilter === "in_stock") return b.available_count > 0;
      return b.genre.toLowerCase() === activeFilter.toLowerCase();
    });
  }, [books, activeFilter]);

  return (
    <div>
      <section className="browse-hero">
        <h1 className="browse-title">See what's on the shelf before you walk over.</h1>
        <p className="browse-subtitle">
          Stock counts come straight off the counter. Reserve a copy and we'll keep it by the register for 48 hours.
        </p>

        <div className="search-section">
          <form role="search" onSubmit={handleSearch} className="search-bar-form">
            <div className="search-input-wrapper">
              <Search size={18} className="search-icon" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by title, author, or ISBN..."
                className="search-input"
                aria-label="Search bookstore inventory by title, author, or ISBN"
              />
              {query && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="search-clear-btn"
                  aria-label="Clear search query"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <button type="submit" className="search-submit-btn">
              Search
            </button>
          </form>

          <div className="filter-chips-row" role="group" aria-label="Filter inventory">
            <span className="filter-label">Filter:</span>
            <button
              type="button"
              onClick={() => setActiveFilter("all")}
              className={`filter-chip ${activeFilter === "all" ? "active" : ""}`}
            >
              All Books
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("in_stock")}
              className={`filter-chip ${activeFilter === "in_stock" ? "active" : ""}`}
            >
              In Stock Only
            </button>
            {availableGenres.slice(0, 4).map((genre) => (
              <button
                key={genre}
                type="button"
                onClick={() => setActiveFilter(genre)}
                className={`filter-chip ${activeFilter.toLowerCase() === genre.toLowerCase() ? "active" : ""}`}
              >
                {genre}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="results-header">
        <h2 className="results-heading">
          {query ? `Results for "${query}"` : activeFilter === "in_stock" ? "In-Stock Titles" : activeFilter !== "all" ? `${activeFilter} Books` : "Browsing Inventory"}
        </h2>
        <span className="results-count">
          {loading ? "Searching..." : `${filteredBooks.length} title${filteredBooks.length === 1 ? "" : "s"}`}
        </span>
      </div>

      {loading ? (
        <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text)' }}>
          <p>Checking shelf inventory...</p>
        </div>
      ) : filteredBooks.length === 0 ? (
        <div className="empty-state">
          <BookOpen size={42} className="empty-state-icon" aria-hidden="true" />
          <h3 className="empty-state-title">We don't have that one on the shelf</h3>
          <p className="empty-state-desc">
            Almost any in-print book can be special ordered at no extra charge — usually here in three to five days.
          </p>
          <div className="empty-state-actions">
            <button
              type="button"
              onClick={() => document.getElementById("chatbot-toggle")?.click()}
              className="btn-secondary"
            >
              <MessageSquare size={16} />
              Ask a bookseller
            </button>
            {query && (
              <button
                type="button"
                onClick={handleClear}
                className="btn-secondary"
              >
                Clear search
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="book-grid">
          {filteredBooks.map((b) => {
            const hasCover = Boolean(b.cover_image_url) && !imageErrors[b.isbn];
            return (
              <Link
                key={b.isbn}
                to={`/book/${b.isbn}`}
                className="book-card"
                aria-label={`${b.title} by ${b.author}, ${formatMoney(b.price_cents)}`}
              >
                <div className="book-cover-container">
                  {hasCover ? (
                    <img
                      src={b.cover_image_url}
                      alt={`Cover for ${b.title}`}
                      className="book-cover-img"
                      loading="lazy"
                      onError={() => setImageErrors((prev) => ({ ...prev, [b.isbn]: true }))}
                    />
                  ) : (
                    <div className="book-cover-fallback">
                      <span className="book-fallback-initial">
                        {b.title.charAt(0).toUpperCase()}
                      </span>
                      <span className="book-fallback-isbn">ISBN · {b.isbn}</span>
                    </div>
                  )}
                </div>
                <div className="book-card-info">
                  <h3 className="book-title">{b.title}</h3>
                  <div className="book-author">{b.author}</div>
                  <div className="book-card-footer">
                    <StockBadge status={b.stock_status} available={b.available_count} />
                    <span className="book-price">{formatMoney(b.price_cents)}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
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
