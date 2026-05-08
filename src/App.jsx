import React, { useState, useEffect, useRef } from 'react';
import Login from './components/Login';
import AttendanceRegister from './components/AttendanceRegister';
import './App.css';

function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('mtworld_current_user');
    return saved ? JSON.parse(saved) : null;
  });

  const logoutTimerRef = useRef(null);
  const INACTIVITY_LIMIT = 30 * 60 * 1000;

  const resetTimer = () => {
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (currentUser) {
      logoutTimerRef.current = setTimeout(() => {
        handleLogout();
        alert('You have been logged out due to 30 minutes of inactivity.');
      }, INACTIVITY_LIMIT);
    }
  };

  useEffect(() => {
    if (!currentUser) return;
    const events = ['mousedown', 'keydown', 'mousemove', 'touchstart', 'scroll', 'click'];
    events.forEach((event) => window.addEventListener(event, resetTimer));
    resetTimer();
    return () => {
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      events.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [currentUser]);

  const handleLogin = (user) => {
    setCurrentUser(user);
    localStorage.setItem('mtworld_current_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('mtworld_current_user');
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
  };

  return currentUser ? (
    <AttendanceRegister currentUser={currentUser} onLogout={handleLogout} onPasswordChanged={() => {}} />
  ) : (
    <Login onLogin={handleLogin} />
  );
}

export default App;