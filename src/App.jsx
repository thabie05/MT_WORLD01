import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import './App.css';

// Hardcoded users – keep as before
const USERS = [
  { username: 'Thabelo', password: 'admin123', fullName: 'Thabelo Tshishonga' },
  { username: 'Shonisani', password: 'shoni123', fullName: 'Shonisani Mukwevho' },
  { username: 'Percy', password: 'percy123', fullName: 'Percy Tshilimandila' },
  { username: 'Soler', password: 'soler123', fullName: 'Soler thagwana' },
  { username: 'lucky', password: 'lucky123', fullName: 'Lucky Tshilimandila' },
];

/* -------------------- LOGIN -------------------- */
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
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [edits, setEdits] = useState({});
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const [popup, setPopup] = useState(null);
  const popupRef = useRef(null);
  const [showHistory, setShowHistory] = useState(false);

  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [newEmployeeName, setNewEmployeeName] = useState('');

  // ---------- Fetch initial data from Firestore ----------
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

  // ---------- Persist to Firestore ----------
  useEffect(() => {
    if (loading) return;
    const saveData = async () => {
      try {
        const docRef = doc(db, 'rollcall', 'data');
        await setDoc(docRef, {
          employees,
          attendance,
          edits,
          history,
        }, { merge: true });
      } catch (err) {
        console.error('Failed to save data:', err);
      }
    };
    saveData();
  }, [employees, attendance, edits, history, loading]);

  // close popup on outside click
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
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  // ---------- Mark attendance ----------
  const markAttendance = (employeeId, day, status) => {
    const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    setEdits((prev) => {
      const current = prev[`${employeeId}-${dateKey}`];
      const count = typeof current === 'number' ? current : (current ? 1 : 0);
      return { ...prev, [`${employeeId}-${dateKey}`]: count + 1 };
    });

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
      {/* ---------- HEADER ---------- */}
      <header className="app-header">
        <div className="header-top">
          <div className="header-left">
            <span className="user-info">Logged in as: {currentUser.fullName}</span>
            <button onClick={onLogout} className="logout-btn">Logout</button>
          </div>
          <div className="header-right">
            <img src="/logo.png" alt="MT WORLD Logo" className="logo" />
          </div>
        </div>
        <h1 className="header-title">MT World Employee Attendance Register</h1>
      </header>

      <div className="main-card">
        {/* ---------- CONTROLS ---------- */}
        <div className="controls">
          <div className="month-navigation">
            <button onClick={handlePrevMonth} className="nav-btn">
              <span>&lsaquo;</span>
            </button>
            <span className="month-display">
              {monthNames[currentMonth]} {currentYear}
            </span>
            <button onClick={handleNextMonth} className="nav-btn">
              <span>&rsaquo;</span>
            </button>
          </div>

          <div className="controls-right">
            <button onClick={() => setShowHistory(true)} className="history-btn">
              View History
            </button>
            <div className="add-employee">
              <input
                type="text"
                placeholder="Employee name"
                value={newEmployeeName}
                onChange={(e) => setNewEmployeeName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addEmployee()}
              />
              <button onClick={addEmployee} className="add-btn">+ Add</button>
            </div>
          </div>
        </div>

        {/* ---------- NO EMPLOYEES MESSAGE ---------- */}
        {employees.length === 0 ? (
          <div className="no-employees">
            <p>No employees added yet. Start by adding some names above.</p>
          </div>
        ) : (
          <div className="rollcall-table-wrapper">
            <table className="rollcall-table">
              <thead>
                <tr>
                  <th className="sticky-col employee-header">Employee</th>
                  {daysArray.map((day) => (
                    <th key={day} className="day-header">{day}</th>
                  ))}
                  <th className="total-header">Total</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => {
                  const total = getTotalWorkedDays(emp.id);
                  return (
                    <tr key={emp.id}>
                      <td className="sticky-col employee-name">
                        <span className="emp-name">{emp.name}</span>
                      </td>
                      {daysArray.map((day) => {
                        const present = isPresent(emp.id, day);
                        const absent = isAbsent(emp.id, day);
                        const edited = isEdited(emp.id, day);
                        const editors = getEditors(emp.id, day);
                        const showEditors = (present || absent) && editors.length > 0;

                        return (
                          <td
                            key={day}
                            className={`day-cell ${present ? 'present' : ''} ${absent ? 'absent' : ''} ${edited ? 'edited' : ''}`}
                            onClick={(e) => openPopup(e, emp.id, day)}
                            title={`${emp.name} – ${day} ${monthNames[currentMonth]} ${currentYear}${showEditors ? ` (edited by ${editors.join(', ')})` : ''}`}
                          >
                            {present && <span className="check-mark">✓</span>}
                            {absent && <span className="absent-mark">✗</span>}
                            {edited && <span className="edit-indicator" title="This day has been edited">✎</span>}
                          </td>
                        );
                      })}
                      <td className="total-cell">{total}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <footer className="app-footer">
          <p>Click a blank cell to set attendance, click again to change once. Locked after two edits.</p>
        </footer>
      </div>

      {/* ---------- HISTORY MODAL ---------- */}
      {showHistory && (
        <div className="history-modal-overlay" onClick={() => setShowHistory(false)}>
          <div className="history-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Attendance Edit History</h2>
            {history.length === 0 ? (
              <p>No edits recorded yet.</p>
            ) : (
              <div className="history-table-container">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Editor</th>
                      <th>Employee</th>
                      <th>Day</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((entry) => (
                      <tr key={entry.id}>
                        <td>{entry.editor}</td>
                        <td>{entry.employeeName}</td>
                        <td>{entry.day}</td>
                        <td>{entry.date}</td>
                        <td>{entry.status}</td>
                        <td>{new Date(entry.editedAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <button className="close-history-btn" onClick={() => setShowHistory(false)}>Close</button>
          </div>
        </div>
      )}

      {/* ---------- ATTENDANCE POPUP ---------- */}
      {popup &&
        createPortal(
          <div ref={popupRef} className="attendance-popup" style={{ left: popup.x, top: popup.y }}>
            <button
              className="popup-btn present-btn"
              onClick={() => markAttendance(popup.employeeId, popup.day, true)}
            >
              ✓ Present
            </button>
            <button
              className="popup-btn absent-btn"
              onClick={() => markAttendance(popup.employeeId, popup.day, false)}
            >
              ✗ Absent
            </button>
          </div>,
          document.body
        )}
    </div>
  );
}

/* -------------------- MAIN APP -------------------- */
function App() {
  const [currentUser, setCurrentUser] = useState(null);
  return currentUser ? (
    <AttendanceRegister currentUser={currentUser} onLogout={() => setCurrentUser(null)} />
  ) : (
    <Login onLogin={setCurrentUser} />
  );
}

export default App;