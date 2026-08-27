import { useEffect, useState, useMemo } from 'react';
import { client } from '../api/client';
import type { components } from '../api/types';
import { Search, AlertCircle, AlertTriangle, Bookmark, Clock, Edit2, Check, X } from 'lucide-react';
import './Inventory.css';

type Book = components["schemas"]["Book"];
type Order = components["schemas"]["Order"];
type StatusFilter = 'out_of_stock' | 'low_stock' | null;
type SortField = 'title' | 'stock_count' | 'available_count';

const isPastDeadline = (deadline: string) => {
  if (!deadline) return false;
  return new Date(deadline) < new Date();
};

export function Inventory() {
  const [books, setBooks] = useState<Book[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('title');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(null);
  const [heldOnly, setHeldOnly] = useState(false);
  const [genreFilter, setGenreFilter] = useState('All');
  const [editingIsbn, setEditingIsbn] = useState<string | null>(null);
  const [editStockValue, setEditStockValue] = useState<string>('');

  const [newIsbn, setNewIsbn] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const fetchBooks = () => {
    client.GET("/api/books", {}).then((res) => {
      if (res.data) setBooks(res.data);
    });
  };

  const fetchOrders = () => {
    client.GET("/api/orders", {}).then((res) => {
      if (res.data) setOrders(res.data);
    });
  };

  const handleAddBook = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    if (!newIsbn) return;

    setIsAdding(true);
    // 1. Fetch external data
    const resExternal = await client.GET("/api/books/external/{isbn}", {
      params: { path: { isbn: newIsbn } }
    });

    if (resExternal.error) {
      setAddError("Failed to find book on OpenLibrary.");
      setIsAdding(false);
      return;
    }

    // 2. Create local book
    const externalBook = resExternal.data as any;
    const resCreate = await client.POST("/api/books", {
      body: {
        isbn: newIsbn,
        title: externalBook.title,
        author: externalBook.author,
        genre: "Uncategorized", // Default
        format: "paperback", // Default
        price_cents: 1999, // Default $19.99
        stock_count: 1, // Start with 1 on hand
        publisher: externalBook.publisher || "",
        published_date: externalBook.published_date || "",
        cover_image_url: externalBook.cover_image_url || "",
        blurb: ""
      }
    });

    if (resCreate.error) {
      setAddError("Failed to add book locally (perhaps it already exists).");
    } else {
      setNewIsbn('');
      fetchBooks();
    }
    setIsAdding(false);
  };

  useEffect(() => {
    fetchBooks();
    fetchOrders();
  }, []);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const genres = useMemo(() => {
    const g = new Set(books.map(b => b.genre));
    return ['All', ...Array.from(g).sort()];
  }, [books]);

  const filteredBooks = useMemo(() => {
    let result = books;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(b => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q));
    }
    if (statusFilter) {
      result = result.filter(b => b.stock_status === statusFilter);
    }
    if (heldOnly) {
      result = result.filter(b => b.reserved_count > 0);
    }
    if (genreFilter !== 'All') {
      result = result.filter(b => b.genre === genreFilter);
    }
    result = [...result].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === 'asc' ? ((aVal as number) - (bVal as number)) : ((bVal as number) - (aVal as number));
    });
    return result;
  }, [books, search, sortField, sortDir, statusFilter, heldOnly, genreFilter]);

  const filterActive = statusFilter !== null || heldOnly;
  const filterLabel = [
    statusFilter === 'out_of_stock' ? 'Out of stock' : statusFilter === 'low_stock' ? 'Low stock' : null,
    heldOnly ? 'On hold' : null,
  ].filter(Boolean).join(' + ');

  const clearFilters = () => {
    setSearch('');
    setGenreFilter('All');
    setStatusFilter(null);
    setHeldOnly(false);
  };

  const outOfStockCount = books.filter(b => b.stock_status === 'out_of_stock').length;
  const lowStockCount = books.filter(b => b.stock_status === 'low_stock').length;
  const heldCount = books.reduce((n, b) => n + b.reserved_count, 0);
  const expiredCount = orders.filter(o => o.status === 'expired' || (o.status === 'pending' && isPastDeadline(o.hold_expires_at))).length;

  const tiles: { id: 'out_of_stock' | 'low_stock' | 'held' | 'expired', className: string, icon: React.ReactNode, count: number, label: string, hint: string, active: boolean }[] = [
    { id: 'out_of_stock', className: 'out-of-stock', icon: <AlertCircle size={22} />, count: outOfStockCount, label: 'Out of stock', hint: 'Reorder or offer a special order', active: statusFilter === 'out_of_stock' },
    { id: 'low_stock', className: 'low-stock', icon: <AlertTriangle size={22} />, count: lowStockCount, label: 'Low stock', hint: 'Sell-through risk this week', active: statusFilter === 'low_stock' },
    { id: 'held', className: 'held', icon: <Bookmark size={22} />, count: heldCount, label: 'Copies on hold', hint: 'Reserved, not on the shelf', active: heldOnly },
    { id: 'expired', className: 'expired', icon: <Clock size={22} />, count: expiredCount, label: 'Holds past 48h', hint: 'Release them back to stock', active: false },
  ];

  const handleTileClick = async (id: 'out_of_stock' | 'low_stock' | 'held' | 'expired') => {
    if (id === 'expired') {
      if (expiredCount === 0) return;
      const res = await client.POST("/api/orders/release-expired", {});
      if (res.data) {
        alert(`Released ${res.data.released_count} expired holds.`);
        fetchOrders();
        fetchBooks();
      }
      return;
    }
    if (id === 'held') {
      setHeldOnly(h => !h);
      return;
    }
    setStatusFilter(f => f === id ? null : id);
  };

  const startEdit = (book: Book) => {
    setEditingIsbn(book.isbn);
    setEditStockValue(book.stock_count.toString());
  };

  const cancelEdit = () => {
    setEditingIsbn(null);
  };

  const saveEdit = async (book: Book) => {
    const newStock = parseInt(editStockValue, 10);
    if (isNaN(newStock) || newStock < book.reserved_count) {
      alert(`Cannot set stock below reserved count (${book.reserved_count})`);
      return;
    }

    const oldBooks = [...books];
    setBooks(books.map(b => b.isbn === book.isbn ? { ...b, stock_count: newStock, available_count: newStock - b.reserved_count } : b));
    setEditingIsbn(null);

    const res = await client.PATCH("/api/books/{isbn}/stock", {
      params: { path: { isbn: book.isbn } },
      body: { stock_count: newStock }
    });

    if (res.error) {
      alert('Failed to update stock');
      setBooks(oldBooks); // rollback
    } else if (res.data) {
      setBooks(books.map(b => b.isbn === book.isbn ? res.data : b));
    }
  };

  const statusLabel = (b: Book) => {
    if (b.stock_status === 'out_of_stock') return 'Out of stock';
    if (b.stock_status === 'low_stock') return b.available_count === 1 ? 'Only 1 left' : `Only ${b.available_count} left`;
    return 'In stock';
  };

  const sortArrow = (field: SortField) => sortField === field ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  const ariaSortFor = (field: SortField): 'ascending' | 'descending' | 'none' =>
    sortField === field ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none';

  return (
    <div className="inventory-page">
      <div className="inventory-header">
        <div>
          <h1>Inventory</h1>
          <p className="inventory-subtitle">{books.length} titles on file · counted live against holds</p>
        </div>
        <form onSubmit={handleAddBook} className="isbn-form">
          <input
            type="text"
            placeholder="Scan ISBN to add…"
            aria-label="Scan or enter ISBN to add a book"
            value={newIsbn}
            onChange={e => setNewIsbn(e.target.value)}
            className="isbn-input"
          />
          <button type="submit" disabled={isAdding} className="isbn-submit">
            {isAdding ? "Looking up…" : "Look up"}
          </button>
        </form>
      </div>
      {addError && <p className="isbn-error" role="alert">{addError}</p>}

      <div className="alerts-summary">
        {tiles.map(t => (
          <button
            key={t.id}
            type="button"
            className={`alert-card ${t.className}`}
            aria-pressed={t.id === 'expired' ? undefined : t.active}
            onClick={() => handleTileClick(t.id)}
          >
            <div className="alert-top">
              {t.icon}
              {t.count > 0 && <span className="alert-dot" />}
            </div>
            <span className="alert-count">{t.count}</span>
            <span className="alert-label">{t.label}</span>
            <span className="alert-hint">{t.hint}</span>
          </button>
        ))}
      </div>

      <div className="filters-bar filters-bar--controls">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search title or author..."
            aria-label="Search inventory by title or author"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label htmlFor="inventory-genre-filter">Genre:</label>
          <select id="inventory-genre-filter" value={genreFilter} onChange={e => setGenreFilter(e.target.value)}>
            {genres.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        {filterActive && (
          <button type="button" className="filter-chip" onClick={clearFilters}>
            {filterLabel} ✕
          </button>
        )}
        <span className="shown-count">{filteredBooks.length} shown</span>
      </div>

      <div className="table-container">
        <table className="inventory-table">
          <thead>
            <tr>
              <th scope="col" aria-sort={ariaSortFor('title')}><button type="button" className="sort-btn" onClick={() => handleSort('title')}>Title{sortArrow('title')}</button></th>
              <th scope="col">ISBN</th>
              <th scope="col">Genre</th>
              <th scope="col" aria-sort={ariaSortFor('stock_count')}><button type="button" className="sort-btn" onClick={() => handleSort('stock_count')}>On hand{sortArrow('stock_count')}</button></th>
              <th scope="col" aria-sort={ariaSortFor('available_count')}><button type="button" className="sort-btn" onClick={() => handleSort('available_count')}>Avail{sortArrow('available_count')}</button></th>
              <th scope="col">Held</th>
              <th scope="col">Status</th>
              <th scope="col">Price</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredBooks.map(b => (
              <tr key={b.isbn} className={`status-${b.stock_status.replace(/_/g, '-')}`}>
                <td>
                  <div className="title-cell">{b.title}</div>
                  <div className="author-cell">{b.author}</div>
                </td>
                <td className="isbn-cell">{b.isbn}</td>
                <td>{b.genre}</td>
                <td>
                  {editingIsbn === b.isbn ? (
                    <input
                      type="number"
                      value={editStockValue}
                      onChange={e => setEditStockValue(e.target.value)}
                      className="edit-stock-input"
                      aria-label={`Stock count for ${b.title}`}
                    />
                  ) : (
                    b.stock_count
                  )}
                </td>
                <td>{b.available_count}</td>
                <td>{b.reserved_count}</td>
                <td>
                  <span className={`status-badge ${b.stock_status.replace(/_/g, '-')}`}>
                    {statusLabel(b)}
                  </span>
                </td>
                <td>${(b.price_cents / 100).toFixed(2)}</td>
                <td>
                  {editingIsbn === b.isbn ? (
                    <div className="action-buttons">
                      <button type="button" onClick={() => saveEdit(b)} title="Save" aria-label={`Save stock count for ${b.title}`}><Check size={16} /></button>
                      <button type="button" onClick={cancelEdit} title="Cancel" aria-label={`Cancel editing stock count for ${b.title}`}><X size={16} /></button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => startEdit(b)} title="Adjust count" aria-label={`Adjust stock count for ${b.title}`}><Edit2 size={16} /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredBooks.length === 0 && (
          <div className="empty-state">
            <div className="empty-title">Nothing on that shelf</div>
            <div className="empty-hint">No titles match what you typed. Try the author's surname.</div>
            <button type="button" className="empty-clear" onClick={clearFilters}>Clear filters</button>
          </div>
        )}
      </div>
    </div>
  );
}
