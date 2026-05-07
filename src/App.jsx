import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';  // adjust path if needed
import './App.css';

// Hardcoded users – you can replace these with Firebase Auth later
const USERS = [
  { username: 'admin', password: 'admin123', fullName: 'Administrator' },
  { username: 'john', password: 'john123', fullName: 'John Doe' },
  { username: 'jane', password: 'jane123', fullName: 'Jane Smith' },
];

/* -------------------- LOGIN COMPONENT -------------------- */
function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const user = USERS.find(
      (u) => u.username === username && u.password === password
    );
    if (user) {
      onLogin({ username: user.username, fullName: user.fullName });
    } else {
      setError('Invalid username or password');
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>MT WORLD</h1>
        <h2>Attendance Register</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="error-msg">{error}</p>}
          <button type="submit">Log In</button>
        </form>
      </div>
    </div>
  );
}

/* -------------------- ATTENDANCE REGISTER -------------------- */
function AttendanceRegister({ currentUser, onLogout }) {
  // ---------- Load data from Firestore ----------
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [edits, setEdits] = useState({});
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);   // show loading while fetching

  // Popup & UI
  const [popup, setPopup] = useState(null);
  const popupRef = useRef(null);
  const [showHistory, setShowHistory] = useState(false);

  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [newEmployeeName, setNewEmployeeName] = useState('');

  // ── Fetch initial data from Firestore ──
  useEffect(() => {
    const fetchData = async () => {
      try {
        const docRef = doc(db, 'rollcall', 'data');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          setEmployees(data.employees || []);
          setAttendance(data.attendance || {});
          setEdits(data.edits || {});
          setHistory(data.history || []);
        } else {
          // No document yet – start with defaults
          setEmployees([
            { id: '1', name: 'John Doe' },
            { id: '2', name: 'Jane Smith' },
          ]);
        }
      } catch (err) {
        console.error('Failed to load data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // ── Persist all data to Firestore whenever it changes ──
  useEffect(() => {
    // Don't write while still loading initial data
    if (loading) return;
    const saveData = async () => {
      try {
        const docRef = doc(db, 'rollcall', 'data');
        await setDoc(docRef, {
          employees,
          attendance,
          edits,
          history,
        }, { merge: true });   // merge ensures we don't accidentally delete fields
      } catch (err) {
        console.error('Failed to save data:', err);
      }
    };
    saveData();
  }, [employees, attendance, edits, history, loading]);

  // close popup if clicking outside
  useEffect(() => {
    const handleClick = (e) => {
      if (popupRef.current && popupRef.current.contains(e.target)) {
        return;
      }
      setPopup(null);
    };
    if (popup) {
      document.addEventListener('mousedown', handleClick);
    }
    return () => document.removeEventListener('mousedown', handleClick);
  }, [popup]);

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // ---------- Mark attendance ----------
  const markAttendance = (employeeId, day, status) => {
    const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    // Edit count
    setEdits((prev) => {
      const current = prev[`${employeeId}-${dateKey}`];
      const count = typeof current === 'number' ? current : (current ? 1 : 0);
      return { ...prev, [`${employeeId}-${dateKey}`]: count + 1 };
    });

    // Attendance
    setAttendance((prev) => {
      const updated = { ...prev };
      const empAttendance = { ...(updated[employeeId] || {}) };
      empAttendance[dateKey] = status;
      if (Object.keys(empAttendance).length === 0) {
        delete updated[employeeId];
      } else {
        updated[employeeId] = empAttendance;
      }
      return updated;
    });

    // History
    const employee = employees.find(emp => emp.id === employeeId);
    const entry = {
      id: Date.now(),
      employeeId,
      employeeName: employee?.name || 'Unknown',
      day,
      date: dateKey,
      status: status ? 'Present' : 'Absent',
      editor: currentUser.fullName,
      editedAt: new Date().toISOString(),
    };
    setHistory((prev) => [entry, ...prev]);

    setPopup(null);
  };

  const isPresent = (employeeId, day) => {
    const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return attendance[employeeId]?.[dateKey] === true;
  };

  const isAbsent = (employeeId, day) => {
    const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return attendance[employeeId]?.[dateKey] === false;
  };

  const isEdited = (employeeId, day) => {
    const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const count = edits[`${employeeId}-${dateKey}`];
    return typeof count === 'number' && count >= 2;
  };

  const getEditors = (employeeId, day) => {
    const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const entries = history
      .filter((h) => h.employeeId === employeeId && h.date === dateKey)
      .sort((a, b) => new Date(a.editedAt) - new Date(b.editedAt));
    const uniqueEditors = [];
    const seen = new Set();
    for (const entry of entries) {
      if (!seen.has(entry.editor)) {
        seen.add(entry.editor);
        uniqueEditors.push(entry.editor);
      }
    }
    return uniqueEditors;
  };

  const getTotalWorkedDays = (employeeId) => {
    const empAttendance = attendance[employeeId] || {};
    const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-`;
    return Object.keys(empAttendance).filter(
      (key) => key.startsWith(monthPrefix) && empAttendance[key] === true
    ).length;
  };

  const addEmployee = () => {
    const name = newEmployeeName.trim();
    if (name === '') return;
    setEmployees((prev) => [...prev, { id: Date.now().toString(), name }]);
    setNewEmployeeName('');
  };

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((prev) => prev - 1);
    } else {
      setCurrentMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((prev) => prev + 1);
    } else {
      setCurrentMonth((prev) => prev + 1);
    }
  };

  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Popup with 2‑edit lock
  const openPopup = (e, employeeId, day) => {
    e.stopPropagation();
    const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const currentEdits = edits[`${employeeId}-${dateKey}`];
    const editCount = typeof currentEdits === 'number' ? currentEdits : 0;
    if (editCount >= 2) return;

    const rect = e.currentTarget.getBoundingClientRect();
    setPopup({
      employeeId,
      day,
      x: rect.left + window.scrollX,
      y: rect.bottom + window.scrollY,
    });
  };

  if (loading) {
    return <div className="loading">Loading data…</div>;
  }

  return (
    <div className="App">
      {/* Header, controls, table, popup, modal – identical to before */}
      {/* ... (use the same JSX from the previous full example) ... */}
      {/* I'll include an abbreviated version for brevity, but you should paste the full JSX from the earlier "two-edit" version. */}
      {/* For space, I show the structure – replace with your existing return block. */}
      <header className="app-header">…</header>
      <div className="main-card">…</div>
      {/* Footer: */}
      <footer className="app-footer">
        <p>Click a blank cell to set attendance, click again to change once. Locked after two edits.</p>
      </footer>
    </div>
  );
}

/* -------------------- MAIN APP -------------------- */
function App() {
  const [currentUser, setCurrentUser] = useState(null);
  return currentUser ? (
    <AttendanceRegister
      currentUser={currentUser}
      onLogout={() => setCurrentUser(null)}
    />
  ) : (
    <Login onLogin={setCurrentUser} />
  );
}

export default App;