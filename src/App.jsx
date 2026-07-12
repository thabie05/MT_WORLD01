import React, { useState, useEffect, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import Login from './components/Login';
import AttendanceRegister from './components/AttendanceRegister';
import FingerprintKiosk from './components/FingerprintKiosk';

function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('mtworld_current_user');
    if (saved) {
      try { return JSON.parse(saved); }
      catch { return null; }
    }
    return null;
  });

  // Kiosk mode: open this app as https://your-app-url/?kiosk=1 on the PC
  // sitting next to the fingerprint scanner. It runs unattended, with no
  // login of its own — see SETUP.md for the Firestore security rule
  // implications of that.
  const isKioskMode = new URLSearchParams(window.location.search).get('kiosk') === '1';
  const [kioskEmployees, setKioskEmployees] = useState([]);

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
    if (isKioskMode || !currentUser) return;
    const events = ['mousedown', 'keydown', 'mousemove', 'touchstart', 'scroll', 'click'];
    events.forEach((event) => window.addEventListener(event, resetTimer));
    resetTimer();
    return () => {
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      events.forEach((event) => window.removeEventListener(event, resetTimer));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, isKioskMode]);

  // Kiosk mode needs the employee list to know who a fingerprint match
  // belongs to. It refreshes periodically so a newly-enrolled employee
  // shows up without needing to restart the kiosk screen.
  useEffect(() => {
    if (!isKioskMode) return;
    let cancelled = false;

    const fetchEmployees = async () => {
      try {
        const snap = await getDoc(doc(db, 'rollcall', 'data'));
        if (!cancelled && snap.exists()) setKioskEmployees(snap.data().employees || []);
      } catch (err) {
        console.error('Kiosk failed to load employees:', err);
      }
    };

    fetchEmployees();
    const interval = setInterval(fetchEmployees, 60000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [isKioskMode]);

  const handleLogin = (user) => {
    setCurrentUser(user);
    if (user.rememberMe) {
      localStorage.setItem('mtworld_current_user', JSON.stringify(user));
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('mtworld_current_user');
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
  };

  if (isKioskMode) {
    return <FingerprintKiosk employees={kioskEmployees} />;
  }

  return currentUser ? (
    <AttendanceRegister currentUser={currentUser} onLogout={handleLogout} onPasswordChanged={() => {}} />
  ) : (
    <Login onLogin={handleLogin} />
  );
}

export default App;