import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import AttendanceRegister from './components/AttendanceRegister';
import FingerprintKiosk from './components/FingerprintKiosk';
// If you have a LiveBoard component, import it; otherwise ignore

function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('mtworld_current_user');
    if (saved) {
      try { return JSON.parse(saved); }
      catch { return null; }
    }
    return null;
  });

  // Check URL parameters
  const [params, setParams] = useState(() => {
    const searchParams = new URLSearchParams(window.location.search);
    return {
      kiosk: searchParams.get('kiosk') === '1',
      board: searchParams.get('board') === '1',
    };
  });

  // Listen to URL changes (popstate) to update params without reload
  useEffect(() => {
    const handlePopState = () => {
      const searchParams = new URLSearchParams(window.location.search);
      setParams({
        kiosk: searchParams.get('kiosk') === '1',
        board: searchParams.get('board') === '1',
      });
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // --- Kiosk mode (no login required) ---
  if (params.kiosk) {
    return <FingerprintKiosk />;
  }

  // --- Live Board mode (if you have a component) ---
  if (params.board) {
    // return <LiveBoard />; // or redirect to register if not implemented
    // For now, fallback to register
    // return <AttendanceRegister currentUser={currentUser} onLogout={handleLogout} onPasswordChanged={() => {}} />;
    // Since LiveBoard is not provided, we redirect to home
    window.location.href = window.location.pathname;
    return null;
  }

  // --- Standard mode: Login / Register ---
  const handleLogin = (user) => {
    setCurrentUser(user);
    if (user.rememberMe) {
      localStorage.setItem('mtworld_current_user', JSON.stringify(user));
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('mtworld_current_user');
  };

  return currentUser ? (
    <AttendanceRegister currentUser={currentUser} onLogout={handleLogout} onPasswordChanged={() => {}} />
  ) : (
    <Login onLogin={handleLogin} />
  );
}

export default App;