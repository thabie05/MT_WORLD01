import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import FingerprintKiosk from './components/FingerprintKiosk';
import Dashboard from './components/Dashboard';
import TitleBar from './components/TitleBar';

function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('mtworld_current_user');
    if (saved) {
      try { return JSON.parse(saved); }
      catch { return null; }
    }
    return null;
  });

  const [params, setParams] = useState(() => {
    const searchParams = new URLSearchParams(window.location.search);
    return {
      kiosk: searchParams.get('kiosk') === '1',
      board: searchParams.get('board') === '1',
    };
  });

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

  // Kiosk mode – full‑screen, no dashboard
  if (params.kiosk) {
  return (
    <div className="flex flex-col h-screen bg-body text-main font-['Inter',sans-serif] overflow-hidden">
      <TitleBar />
      <div className="flex-1 flex items-center justify-center overflow-hidden">
        <FingerprintKiosk />
      </div>
    </div>
  );
}

  if (params.board) {
    window.location.href = window.location.pathname;
    return null;
  }

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

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-body text-main font-['Inter',sans-serif]">
      <TitleBar />
      <div className="flex-1 overflow-auto">
        {currentUser ? (
          <Dashboard currentUser={currentUser} onLogout={handleLogout} />
        ) : (
          <Login onLogin={handleLogin} />
        )}
      </div>
    </div>
  );
}

export default App;