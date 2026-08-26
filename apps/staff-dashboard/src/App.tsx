import { useState } from 'react';
import { BrowserRouter, Routes, Route, Link, Outlet } from 'react-router-dom';
import { Inventory } from './pages/Inventory';
import { Preorders } from './pages/Preorders';
import { Messages } from './pages/Messages';
import { Marketing } from './pages/Marketing';
import { Book, Inbox, CalendarClock, Megaphone } from 'lucide-react';
import { SignIn } from './components/SignIn';
import { getStaffSession, clearStaffSession } from './lib/staffAuth';
import './App.css';

function Layout({ staffName, onSignOut }: { staffName: string, onSignOut: () => void }) {
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
        <div className="sidebar-footer">
          <div className="staff-name">{staffName}</div>
          <button type="button" className="sign-out-btn" onClick={onSignOut}>Sign out</button>
        </div>
      </nav>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}

function App() {
  const [staffName, setStaffName] = useState<string | null>(() => getStaffSession());

  if (!staffName) {
    return <SignIn onSignIn={setStaffName} />;
  }

  const handleSignOut = () => {
    clearStaffSession();
    setStaffName(null);
  };

  return (
    <BrowserRouter basename={import.meta.env.PROD ? '/staff' : undefined}>
      <Routes>
        <Route path="/" element={<Layout staffName={staffName} onSignOut={handleSignOut} />}>
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
