import { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Outlet } from 'react-router-dom';
import { Inventory } from './pages/Inventory';
import { Preorders } from './pages/Preorders';
import { Messages } from './pages/Messages';
import { Marketing } from './pages/Marketing';
import { Book, Inbox, CalendarClock, Megaphone } from 'lucide-react';
import { SignIn } from './components/SignIn';
import { getStaffSession, clearStaffSession, type StaffSession } from './lib/staffAuth';
import './App.css';

function Layout({ staff, onSignOut }: { staff: StaffSession; onSignOut: () => void }) {
  return (
    <div className="layout">
      <nav className="sidebar" aria-label="Staff Dashboard Navigation">
        <div className="logo">Riverside Staff</div>
        <div className="nav-links">
          <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Book size={18} aria-hidden="true" /> Inventory
          </NavLink>
          <NavLink to="/preorders" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <CalendarClock size={18} aria-hidden="true" /> Pre-orders
          </NavLink>
          <NavLink to="/messages" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Inbox size={18} aria-hidden="true" /> Messages
          </NavLink>
          <NavLink to="/marketing" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Megaphone size={18} aria-hidden="true" /> Marketing
          </NavLink>
        </div>
        <div className="sidebar-footer">
          <div className="staff-name">{staff.name} · {staff.role}</div>
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
  const [staff, setStaff] = useState<StaffSession | null>(() => getStaffSession());

  if (!staff) {
    return <SignIn onSignIn={setStaff} />;
  }

  const handleSignOut = () => {
    clearStaffSession();
    setStaff(null);
  };

  return (
    <BrowserRouter basename={import.meta.env.PROD ? '/staff' : undefined}>
      <Routes>
        <Route path="/" element={<Layout staff={staff} onSignOut={handleSignOut} />}>
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
