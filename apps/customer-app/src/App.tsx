import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import BookDetail from './pages/BookDetail';
import MyOrders from './pages/MyOrders';
import LoyaltyCard from './pages/LoyaltyCard';
import Support from './pages/Support';
import ChatPanel from './components/ChatPanel';
import './App.css';

function App() {
  return (
    <BrowserRouter basename={import.meta.env.PROD ? '/shop' : undefined}>
      <div className="app-container">
        <header className="app-header">
          <h1>Riverside Books</h1>
          <nav>
            <Link to="/">Browse Books</Link>
            <Link to="/orders">My Orders</Link>
            <Link to="/loyalty">Loyalty Card</Link>
            <Link to="/support">Support</Link>
          </nav>
        </header>
        
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/book/:isbn" element={<BookDetail />} />
            <Route path="/orders" element={<MyOrders />} />
            <Route path="/loyalty" element={<LoyaltyCard />} />
            <Route path="/support" element={<Support />} />
          </Routes>
        </main>
        
        <ChatPanel />
      </div>
    </BrowserRouter>
  );
}

export default App;
