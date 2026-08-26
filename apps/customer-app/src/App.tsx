import { BrowserRouter, Routes, Route, NavLink, Link } from 'react-router-dom';
import Home from './pages/Home';
import BookDetail from './pages/BookDetail';
import MyOrders from './pages/MyOrders';
import LoyaltyCard from './pages/LoyaltyCard';
import Support from './pages/Support';
import ChatPanel from './components/ChatPanel';
import { BookOpen } from 'lucide-react';
import './App.css';

function App() {
  return (
    <BrowserRouter basename={import.meta.env.PROD ? '/shop' : undefined}>
      <div className="app-container">
        <header className="app-header">
          <div className="header-inner">
            <Link to="/" className="brand-link" aria-label="Riverside Books Home">
              <div className="brand-mark">
                <BookOpen size={22} className="brand-icon" aria-hidden="true" />
                <span className="brand-name">Riverside Books</span>
              </div>
              <span className="brand-location">Beacon, New York</span>
            </Link>

            <nav className="header-nav" aria-label="Main Navigation">
              <NavLink 
                to="/" 
                end
                className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`}
              >
                Browse Shelf
              </NavLink>
              <NavLink 
                to="/orders" 
                className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`}
              >
                My Holds
              </NavLink>
              <NavLink 
                to="/loyalty" 
                className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`}
              >
                Stamp Card
              </NavLink>
              <NavLink 
                to="/support" 
                className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`}
              >
                Store Info
              </NavLink>
            </nav>
          </div>
        </header>

        <main className="app-main" id="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/book/:isbn" element={<BookDetail />} />
            <Route path="/orders" element={<MyOrders />} />
            <Route path="/loyalty" element={<LoyaltyCard />} />
            <Route path="/support" element={<Support />} />
          </Routes>
        </main>

        <footer className="app-footer">
          <div className="footer-inner">
            <div className="footer-brand">
              <span className="footer-title">Riverside Books</span>
              <p className="footer-meta">412 Main Street, Beacon, NY 12508 · (845) 555-0142</p>
              <p className="footer-hours">Open Mon–Sat 10 AM – 8 PM · Sun 11 AM – 6 PM</p>
            </div>
            <div className="footer-links">
              <Link to="/support" className="footer-link">FAQ & Policies</Link>
              <a href="/staff/" className="footer-link">Staff Dashboard</a>
              <a href="/" className="footer-link">Home</a>
            </div>
          </div>
        </footer>

        <ChatPanel />
      </div>
    </BrowserRouter>
  );
}

export default App;
