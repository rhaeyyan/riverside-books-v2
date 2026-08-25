import { useEffect, useState, useMemo } from 'react';
import { client } from '../api/client';
import type { components } from '../api/types';
import { Search, AlertCircle, AlertTriangle, Edit2, Check, X } from 'lucide-react';
import './Inventory.css';

type Book = components["schemas"]["Book"];

export function Inventory() {
  const [books, setBooks] = useState<Book[]>([]);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<keyof Book>('title');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [statusFilter, setStatusFilter] = useState('All');
  const [genreFilter, setGenreFilter] = useState('All');
  const [editingIsbn, setEditingIsbn] = useState<string | null>(null);
  const [editStockValue, setEditStockValue] = useState<string>('');


  const [newIsbn, setNewIsbn] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

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
  }, []);

  const fetchBooks = () => {
    client.GET("/api/books", {}).then((res) => {
      if (res.data) setBooks(res.data);
    });
  };

  const handleSort = (field: keyof Book) => {
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

  const statuses = useMemo(() => {
    const s = new Set(books.map(b => b.stock_status));
    return ['All', ...Array.from(s).sort()];
  }, [books]);

  const filteredBooks = useMemo(() => {
    let result = books;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(b => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q));
    }
    if (statusFilter !== 'All') {
      result = result.filter(b => b.stock_status === statusFilter);
    }
    if (genreFilter !== 'All') {
      result = result.filter(b => b.genre === genreFilter);
    }
    result.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      } else {
        return sortDir === 'asc' ? ((aVal as number) - (bVal as number)) : ((bVal as number) - (aVal as number));
      }
    });
    return result;
  }, [books, search, sortField, sortDir, statusFilter, genreFilter]);

  const outOfStockCount = books.filter(b => b.stock_status === 'OUT_OF_STOCK' || b.stock_status === 'Out of Stock' || b.stock_status.toLowerCase().includes('out')).length;
  const lowStockCount = books.filter(b => b.stock_status === 'LOW_STOCK' || b.stock_status === 'Low Stock' || b.stock_status.toLowerCase().includes('low')).length;

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

  return (
    <div className="inventory-page">
      <div className="alerts-summary">
        <div className="alert-card out-of-stock" onClick={() => setStatusFilter(statuses.find(s => s.toLowerCase().includes('out')) || 'All')}>
          <AlertCircle size={24} />
          <div className="alert-text">
            <span className="alert-count">{outOfStockCount}</span>
            <span className="alert-label">Out of Stock</span>
          </div>
        </div>
        <div className="alert-card low-stock" onClick={() => setStatusFilter(statuses.find(s => s.toLowerCase().includes('low')) || 'All')}>
          <AlertTriangle size={24} />
          <div className="alert-text">
            <span className="alert-count">{lowStockCount}</span>
            <span className="alert-label">Low Stock</span>
          </div>
        </div>
      </div>


      <div className="filters-bar" style={{ marginBottom: '1rem', background: '#e3f2fd', border: '1px solid #90caf9' }}>
        <form onSubmit={handleAddBook} style={{ display: 'flex', gap: '1rem', alignItems: 'center', width: '100%' }}>
          <strong>Add New Book:</strong>
          <input 
            type="text" 
            placeholder="Scan or enter ISBN..." 
            value={newIsbn} 
            onChange={e => setNewIsbn(e.target.value)}
            style={{ padding: '0.5rem', flex: 1 }}
          />
          <button type="submit" disabled={isAdding} style={{ padding: '0.5rem 1rem', background: '#0d47a1', color: 'white', border: 'none', borderRadius: '4px' }}>
            {isAdding ? "Fetching..." : "Fetch from OpenLibrary"}
          </button>
          {addError && <span style={{ color: 'red' }}>{addError}</span>}
        </form>
      </div>

      <div className="filters-bar">

        <div className="search-box">
          <Search size={18} />
          <input type="text" placeholder="Search title or author..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="filter-group">
          <label>Status:</label>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            {statuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label>Genre:</label>
          <select value={genreFilter} onChange={e => setGenreFilter(e.target.value)}>
            {genres.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      </div>

      <div className="table-container">
        <table className="inventory-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('title')}>Title {sortField === 'title' && (sortDir === 'asc' ? '↑' : '↓')}</th>
              <th onClick={() => handleSort('author')}>Author {sortField === 'author' && (sortDir === 'asc' ? '↑' : '↓')}</th>
              <th>Genre</th>
              <th onClick={() => handleSort('stock_count')}>Stock {sortField === 'stock_count' && (sortDir === 'asc' ? '↑' : '↓')}</th>
              <th>Available</th>
              <th>Reserved</th>
              <th onClick={() => handleSort('stock_status')}>Status {sortField === 'stock_status' && (sortDir === 'asc' ? '↑' : '↓')}</th>
              <th>Price</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredBooks.map(b => (
              <tr key={b.isbn} className={`status-${b.stock_status.toLowerCase().replace(/\s+/g, '-')}`}>
                <td>{b.title}</td>
                <td>{b.author}</td>
                <td>{b.genre}</td>
                <td>
                  {editingIsbn === b.isbn ? (
                    <input type="number" value={editStockValue} onChange={e => setEditStockValue(e.target.value)} style={{ width: '60px' }} />
                  ) : (
                    b.stock_count
                  )}
                </td>
                <td>{b.available_count}</td>
                <td>{b.reserved_count}</td>
                <td>
                  <span className={`status-badge ${b.stock_status.toLowerCase().replace(/\s+/g, '-')}`}>
                    {b.stock_status}
                  </span>
                </td>
                <td>${(b.price_cents / 100).toFixed(2)}</td>
                <td>
                  {editingIsbn === b.isbn ? (
                    <div className="action-buttons">
                      <button onClick={() => saveEdit(b)} title="Save"><Check size={16} /></button>
                      <button onClick={cancelEdit} title="Cancel"><X size={16} /></button>
                    </div>
                  ) : (
                    <button onClick={() => startEdit(b)} title="Edit Stock"><Edit2 size={16} /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
