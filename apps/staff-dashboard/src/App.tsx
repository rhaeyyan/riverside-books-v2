import { BrowserRouter, Routes, Route, Link, Outlet } from 'react-router-dom';
import { Inventory } from './pages/Inventory';
import { Preorders } from './pages/Preorders';
import { Messages } from './pages/Messages';
import { Marketing } from './pages/Marketing';
import { Book, Inbox, CalendarClock, Megaphone } from 'lucide-react';
import './App.css';

function Layout() {
  return (
    <div className="layout">
      <nav className="sidebar">
        <div className="logo">Riverside Staff</div>
        <div className="nav-links">
          <Link to="/" className="nav-link"><Book size={18}/> Inventory</Link>
          <Link to="/preorders" className="nav-link"><CalendarClock size={18}/> Pre-orders</Link>
          <Link to="/messages" className="nav-link"><Inbox size={18}/> Messages</Link>
          <Link to="/marketing" className="nav-link"><Megaphone size={18}/> Marketing</Link>
        </div>
      </nav>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Inventory />} />
          <Route path="preorders" element={<Preorders />} />
          <Route path="messages" element={<Messages />} />
          <Route path="marketing" element={<Marketing />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
