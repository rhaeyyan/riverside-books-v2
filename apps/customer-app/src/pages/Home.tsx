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
        <div className="browse-hero-copy">
          <p className="browse-eyebrow">412 Main Street, Beacon, NY 12508</p>
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
        </div>

        <div className="browse-hero-art">
          <svg
            viewBox="0 0 400 400"
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="homeBgv" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#3d1f4d" />
                <stop offset="1" stopColor="#241030" />
              </linearGradient>
              <linearGradient id="homeSpineA" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#c14a38" />
                <stop offset="1" stopColor="#8a2f22" />
              </linearGradient>
              <linearGradient id="homeSpineB" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#e2a355" />
                <stop offset="1" stopColor="#b9782f" />
              </linearGradient>
              <linearGradient id="homeSpineC" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#3d8c7c" />
                <stop offset="1" stopColor="#20574c" />
              </linearGradient>
            </defs>
            <rect width="400" height="400" fill="url(#homeBgv)" />
            <g stroke="#fbf7f0" strokeOpacity="0.05">
              <path d="M 200 -20 L 520 460" />
              <path d="M 140 -20 L 460 460" />
              <path d="M 80 -20 L 400 460" />
              <path d="M 200 -20 L -120 460" />
              <path d="M 260 -20 L -60 460" />
            </g>
            <g>
              <rect x="34" y="90" width="34" height="150" rx="2" fill="url(#homeSpineA)" />
              <rect x="34" y="90" width="34" height="6" fill="#fbf7f0" opacity="0.28" />
              <rect x="44" y="118" width="16" height="3" fill="#fbf7f0" opacity="0.6" />
              <rect x="72" y="62" width="26" height="178" rx="2" fill="url(#homeSpineB)" />
              <rect x="102" y="104" width="42" height="136" rx="2" fill="url(#homeSpineC)" />
              <rect x="112" y="132" width="20" height="3" fill="#e2a355" opacity="0.8" />
              <rect x="148" y="80" width="22" height="160" rx="2" fill="#fbf7f0" opacity="0.9" />
              <rect x="148" y="112" width="22" height="6" fill="#c14a38" />
              <g transform="rotate(12 210 240)">
                <rect x="182" y="102" width="38" height="142" rx="2" fill="url(#homeSpineA)" opacity="0.95" />
                <rect x="196" y="132" width="16" height="3" fill="#fbf7f0" opacity="0.55" />
              </g>
              <rect x="228" y="70" width="30" height="170" rx="2" fill="url(#homeSpineB)" />
              <rect x="262" y="88" width="44" height="152" rx="2" fill="url(#homeSpineC)" />
              <rect x="274" y="120" width="20" height="3" fill="#e2a355" opacity="0.75" />
              <rect x="310" y="76" width="24" height="164" rx="2" fill="#fbf7f0" opacity="0.86" />
              <rect x="310" y="112" width="24" height="6" fill="#c14a38" opacity="0.9" />
              <rect x="20" y="240" width="340" height="6" fill="#e2a355" opacity="0.9" />
              <rect x="20" y="246" width="340" height="10" fill="#000000" opacity="0.25" />
            </g>
            <g>
              <rect x="46" y="300" width="28" height="112" rx="2" fill="url(#homeSpineB)" opacity="0.55" />
              <rect x="80" y="312" width="40" height="100" rx="2" fill="url(#homeSpineC)" opacity="0.55" />
              <rect x="128" y="292" width="24" height="120" rx="2" fill="#fbf7f0" opacity="0.4" />
              <rect x="158" y="308" width="34" height="104" rx="2" fill="url(#homeSpineA)" opacity="0.5" />
              <rect x="200" y="296" width="26" height="116" rx="2" fill="url(#homeSpineB)" opacity="0.45" />
              <rect x="232" y="314" width="42" height="98" rx="2" fill="url(#homeSpineC)" opacity="0.45" />
              <rect x="280" y="302" width="22" height="110" rx="2" fill="#fbf7f0" opacity="0.32" />
              <rect x="308" y="310" width="34" height="102" rx="2" fill="url(#homeSpineA)" opacity="0.4" />
              <rect x="20" y="412" width="340" height="5" fill="#e2a355" opacity="0.45" />
            </g>
          </svg>
        </div>
      </section>

      <section className="browse-rule" aria-label="Why shop the shelf at Riverside Books">
        <div className="rule-item">
          <div className="rule-number" aria-hidden="true">01</div>
          <h2 className="rule-title">Live stock, not a guess</h2>
          <p className="rule-desc">
            Every card below shows the same count the register sees — in stock, only a few copies left, or out.
          </p>
        </div>
        <div className="rule-item">
          <div className="rule-number" aria-hidden="true">02</div>
          <h2 className="rule-title">Held 48 hours</h2>
          <p className="rule-desc">
            Reserve a title and we'll keep it by the register with your name on it for two days.
          </p>
        </div>
        <div className="rule-item">
          <div className="rule-number" aria-hidden="true">03</div>
          <h2 className="rule-title">Ask a bookseller</h2>
          <p className="rule-desc">
            Can't find it on the shelf? Open the chat and ask — a real person answers.
          </p>
          <button
            type="button"
            onClick={() => document.getElementById("chatbot-toggle")?.click()}
            className="rule-link"
          >
            Ask a bookseller <span aria-hidden="true">&rarr;</span>
          </button>
        </div>
      </section>

      <section className="browse-promo">
        <div className="browse-promo-inner">
          <p className="browse-promo-eyebrow">The reader card</p>
          <h2 className="browse-promo-title">Ten stamps, and the eleventh book is on us.</h2>
          <p className="browse-promo-desc">
            Earn 1 stamp for every book purchased. Collect 10 stamps to earn a free paperback of your choice.
          </p>
          <Link to="/loyalty" className="browse-promo-cta">
            See my stamp card
          </Link>
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
