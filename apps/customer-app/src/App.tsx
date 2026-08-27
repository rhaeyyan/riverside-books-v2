import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Link } from 'react-router-dom';
import Home from './pages/Home';
import BookDetail from './pages/BookDetail';
import MyOrders from './pages/MyOrders';
import LoyaltyCard from './pages/LoyaltyCard';
import Support from './pages/Support';
import ChatPanel from './components/ChatPanel';
import AuthDialog, { AUTH_OPEN_EVENT } from './components/AuthDialog';
import { BookOpen } from 'lucide-react';
import { getCustomerSession, clearCustomerSession, subscribeToCustomerSession } from './lib/customerSession';
import './App.css';

function App() {
  const [session, setSession] = useState(() => getCustomerSession());

  // Reactive rather than a one-shot mount-time read, so a sign-out (or a
  // cross-tab sign-in) is reflected in the header without a route remount.
  useEffect(() => {
    return subscribeToCustomerSession(() => setSession(getCustomerSession()));
  }, []);

  const handleSignOut = () => {
    clearCustomerSession();
  };

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
              <span className="brand-location">Standing Stone, New York</span>
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
                Support
              </NavLink>
            </nav>

            {session ? (
              <div className="header-session">
                <span className="header-session-name">Signed in as {session.name}</span>
                <button
                  type="button"
                  className="header-session-signout"
                  onClick={handleSignOut}
                >
                  Sign out
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="header-session-signin"
                onClick={() => window.dispatchEvent(new Event(AUTH_OPEN_EVENT))}
              >
                Sign in
              </button>
            )}
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
              <p className="footer-meta">128 Main Street, Standing Stone, NY 12508 · (845) 555-0142</p>
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
        <AuthDialog />
      </div>
    </BrowserRouter>
  );
}

export default App;
