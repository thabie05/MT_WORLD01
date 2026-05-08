import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import './App.css';

const STORAGE_KEY = 'mtworld_users';

// Load users from localStorage or use defaults
const loadUsers = () => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try { return JSON.parse(saved); } catch { }
  }
  return [
    { username: 'Thabelo', password: 'admin123', fullName: 'Thabelo Tshishonga', role: 'admin' },
    { username: 'Shonisani', password: 'shoni123', fullName: 'Shonisani Mukwevho', role: 'user' },
    { username: 'Percy', password: 'percy123', fullName: 'Percy Tshilimandila', role: 'user' },
    { username: 'Soler', password: 'soler123', fullName: 'Soler thagwana', role: 'user' },
    { username: 'lucky', password: 'lucky123', fullName: 'Lucky Tshilimandila', role: 'user' },
  ];
};

// Seed Firestore with users (runs once)
const seedUsersIfNeeded = async () => {
  try {
    const docRef = doc(db, 'users', 'credentials');
    const snap = await getDoc(docRef);
    if (!snap.exists() || !snap.data().users || snap.data().users.length === 0) {
      const users = [
        { username: 'Thabelo', password: 'admin123', fullName: 'Thabelo Tshishonga', role: 'admin' },
        { username: 'Shonisani', password: 'shoni123', fullName: 'Shonisani Mukwevho', role: 'user' },
        { username: 'Percy', password: 'percy123', fullName: 'Percy Tshilimandila', role: 'user' },
        { username: 'Soler', password: 'soler123', fullName: 'Soler thagwana', role: 'user' },
        { username: 'lucky', password: 'lucky123', fullName: 'Lucky Tshilimandila', role: 'user' },
      ];
      await setDoc(docRef, { users });
      console.log('Users seeded to Firestore!');
    }
  } catch (err) {
    console.error('Seeding failed (may already exist):', err.message);
  }
};

/* -------------------- LOGIN -------------------- */
function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Try Firestore first
      const docRef = doc(db, 'users', 'credentials');
      const snap = await getDoc(docRef);

      let users;
      if (snap.exists() && snap.data().users && snap.data().users.length > 0) {
        users = snap.data().users;
      } else {
        users = loadUsers();
      }

      const user = users.find((u) => u.username === username && u.password === password);
      if (user) {
        onLogin({ username: user.username, fullName: user.fullName, role: user.role });
      } else {
        setError('Invalid username or password');
      }
    } catch (err) {
      console.error('Failed to fetch users from cloud:', err);
      const users = loadUsers();
      const user = users.find((u) => u.username === username && u.password === password);
      if (user) {
        onLogin({ username: user.username, fullName: user.fullName, role: user.role });
      } else {
        setError('Invalid username or password');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>MT WORLD</h1>
        <h2>Attendance Register</h2>
        <form onSubmit={handleSubmit}>
          <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <p className="error-msg">{error}</p>}
          <button type="submit" disabled={loading}>{loading ? 'Logging in...' : 'Log In'}</button>
        </form>
      </div>
    </div>
  );
}

/* -------------------- PASSWORD CHANGE MODAL -------------------- */
function PasswordChangeModal({ currentUser, onClose, onPasswordChanged }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const users = loadUsers();
    const userIndex = users.findIndex((u) => u.username === currentUser.username);

    if (userIndex === -1) {
      setError('User not found.');
      return;
    }

    if (users[userIndex].password !== currentPassword) {
      setError('Current password is incorrect.');
      return;
    }

    if (newPassword.length < 4) {
      setError('New password must be at least 4 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setSaving(true);

    try {
      // Update localStorage
      users[userIndex].password = newPassword;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(users));

      // Save to Firestore
      const docRef = doc(db, 'users', 'credentials');
      const snap = await getDoc(docRef);
      let allUsers = snap.exists() ? snap.data().users || [] : [];

      const cloudIndex = allUsers.findIndex((u) => u.username === currentUser.username);
      if (cloudIndex !== -1) {
        allUsers[cloudIndex].password = newPassword;
      } else {
        allUsers.push(users[userIndex]);
      }

      await setDoc(docRef, { users: allUsers }, { merge: true });

      setSuccess('Password changed successfully!');
      setTimeout(() => {
        onPasswordChanged();
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Failed to save password to cloud:', err);
      setError('Failed to save to cloud. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="history-modal-overlay" onClick={onClose}>
      <div className="history-modal password-modal" onClick={(e) => e.stopPropagation()}>
        <h2>🔒 Change Password</h2>
        <p className="password-user">Logged in as: <strong>{currentUser.fullName}</strong></p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Current Password</label>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required placeholder="Enter current password" />
          </div>
          <div className="form-group">
            <label>New Password</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required placeholder="Enter new password (min 4 chars)" />
          </div>
          <div className="form-group">
            <label>Confirm New Password</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="Re-enter new password" />
          </div>
          {error && <p className="error-msg">{error}</p>}
          {success && <p className="success-msg">{success}</p>}
          <div className="password-modal-buttons">
            <button type="button" onClick={onClose} className="cancel-btn" disabled={saving}>Cancel</button>
            <button type="submit" className="save-btn" disabled={saving}>
              {saving ? 'Saving...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* -------------------- ATTENDANCE REGISTER -------------------- */
function AttendanceRegister({ currentUser, onLogout, onPasswordChanged }) {
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [edits, setEdits] = useState({});
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState('none');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('mtworld_dark_mode') === 'true');
  const [showStats, setShowStats] = useState(false);
  const [editEmployeeId, setEditEmployeeId] = useState(null);
  const [editEmployeeName, setEditEmployeeName] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const [popup, setPopup] = useState(null);
  const popupRef = useRef(null);
  const contextMenuRef = useRef(null);
  const [showHistory, setShowHistory] = useState(false);

  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const isAdmin = currentUser.role === 'admin';

  useEffect(() => {
    // Seed Firestore on first load
    seedUsersIfNeeded();
  }, []);

  useEffect(() => {
    if (darkMode) document.body.classList.add('dark-mode');
    else document.body.classList.remove('dark-mode');
    localStorage.setItem('mtworld_dark_mode', darkMode);
  }, [darkMode]);

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
          setEmployees([{ id: '1', name: 'John Doe' }, { id: '2', name: 'Jane Smith' }]);
        }
      } catch (err) { console.error('Failed to load data:', err); }
      finally { setLoading(false); }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (loading) return;
    const saveData = async () => {
      try {
        const docRef = doc(db, 'rollcall', 'data');
        await setDoc(docRef, { employees, attendance, edits, history }, { merge: true });
      } catch (err) { console.error('Failed to save data:', err); }
    };
    saveData();
  }, [employees, attendance, edits, history, loading]);

  useEffect(() => {
    const handleClick = (e) => {
      if (popupRef.current && popupRef.current.contains(e.target)) return;
      setPopup(null);
    };
    if (popup) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [popup]);

  useEffect(() => {
    const handleClick = (e) => {
      if (contextMenuRef.current && contextMenuRef.current.contains(e.target)) return;
      setContextMenu(null);
    };
    if (contextMenu) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [contextMenu]);

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const getSAHolidays = (year) => {
    const holidays = [
      { date: `${year}-01-01`, name: "New Year's Day" },
      { date: `${year}-03-21`, name: "Human Rights Day" },
      { date: `${year}-04-27`, name: "Freedom Day" },
      { date: `${year}-05-01`, name: "Workers' Day" },
      { date: `${year}-06-16`, name: "Youth Day" },
      { date: `${year}-08-09`, name: "National Women's Day" },
      { date: `${year}-09-24`, name: "Heritage Day" },
      { date: `${year}-12-16`, name: "Day of Reconciliation" },
      { date: `${year}-12-25`, name: "Christmas Day" },
      { date: `${year}-12-26`, name: "Day of Goodwill" },
    ];
    const a = year % 19, b = Math.floor(year / 100), c = year % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    const easterSunday = new Date(year, month - 1, day);
    const goodFriday = new Date(easterSunday); goodFriday.setDate(easterSunday.getDate() - 2);
    const familyDay = new Date(easterSunday); familyDay.setDate(easterSunday.getDate() + 1);
    const formatDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    holidays.push({ date: formatDate(goodFriday), name: "Good Friday" }, { date: formatDate(familyDay), name: "Family Day" });
    return holidays;
  };

  const isWeekend = (day) => { const date = new Date(currentYear, currentMonth, day); return date.getDay() === 0 || date.getDay() === 6; };
  const isHoliday = (day) => { const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; return getSAHolidays(currentYear).some((h) => h.date === dateKey); };

  const markAttendance = (employeeId, day, status) => {
    const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setEdits((prev) => { const current = prev[`${employeeId}-${dateKey}`]; const count = typeof current === 'number' ? current : (current ? 1 : 0); return { ...prev, [`${employeeId}-${dateKey}`]: count + 1 }; });
    setAttendance((prev) => { const updated = { ...prev }; const empAttendance = { ...(updated[employeeId] || {}) }; empAttendance[dateKey] = status; if (Object.keys(empAttendance).length === 0) delete updated[employeeId]; else updated[employeeId] = empAttendance; return updated; });
    const employee = employees.find((emp) => emp.id === employeeId);
    setHistory((prev) => [{ id: Date.now(), employeeId, employeeName: employee?.name || 'Unknown', day, date: dateKey, status: status ? 'Present' : 'Absent', editor: currentUser.fullName, editedAt: new Date().toISOString() }, ...prev]);
    setPopup(null);
  };

  const isPresent = (employeeId, day) => attendance[employeeId]?.[`${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`] === true;
  const isAbsent = (employeeId, day) => attendance[employeeId]?.[`${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`] === false;
  const isEdited = (employeeId, day) => { const count = edits[`${employeeId}-${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`]; return typeof count === 'number' && count >= 2; };
  const getEditors = (employeeId, day) => { const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; const entries = history.filter((h) => h.employeeId === employeeId && h.date === dateKey).sort((a, b) => new Date(a.editedAt) - new Date(b.editedAt)); const uniqueEditors = [], seen = new Set(); for (const entry of entries) { if (!seen.has(entry.editor)) { seen.add(entry.editor); uniqueEditors.push(entry.editor); } } return uniqueEditors; };

  const getTotalWorkedDays = (employeeId) => { const empAttendance = attendance[employeeId] || {}; const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-`; return Object.keys(empAttendance).filter((key) => key.startsWith(monthPrefix) && empAttendance[key] === true).length; };

  const addEmployee = () => { const name = newEmployeeName.trim(); if (name === '') return; setEmployees((prev) => [...prev, { id: Date.now().toString(), name }]); setNewEmployeeName(''); };
  const deleteEmployee = (id) => { if (!isAdmin) return; setEmployees((prev) => prev.filter((emp) => emp.id !== id)); setAttendance((prev) => { const updated = { ...prev }; delete updated[id]; return updated; }); };
  const startEditEmployee = (emp) => { if (!isAdmin) return; setContextMenu(null); setEditEmployeeId(emp.id); setEditEmployeeName(emp.name); };
  const saveEditEmployee = () => { if (!isAdmin || editEmployeeName.trim() === '') return; setEmployees((prev) => prev.map((emp) => emp.id === editEmployeeId ? { ...emp, name: editEmployeeName.trim() } : emp)); setEditEmployeeId(null); setEditEmployeeName(''); };

  const handlePrevMonth = () => { if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear((prev) => prev - 1); } else setCurrentMonth((prev) => prev - 1); };
  const handleNextMonth = () => { if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear((prev) => prev + 1); } else setCurrentMonth((prev) => prev + 1); };

  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const openPopup = (e, employeeId, day) => { e.stopPropagation(); const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; const currentEdits = edits[`${employeeId}-${dateKey}`]; const editCount = typeof currentEdits === 'number' ? currentEdits : 0; if (editCount >= 2) return; const rect = e.currentTarget.getBoundingClientRect(); setPopup({ employeeId, day, x: rect.left + window.scrollX, y: rect.bottom + window.scrollY }); };

  const handleEmployeeClick = (e, emp) => { e.stopPropagation(); if (isAdmin) { const rect = e.currentTarget.getBoundingClientRect(); setContextMenu({ employee: emp, x: rect.left + window.scrollX, y: rect.bottom + window.scrollY }); } else { setSelectedEmployee(emp); } };

  const getSortedEmployees = () => { if (sortOrder === 'none') return employees; return [...employees].sort((a, b) => { if (sortOrder === 'asc') return a.name.toLowerCase().localeCompare(b.name.toLowerCase()); return b.name.toLowerCase().localeCompare(a.name.toLowerCase()); }); };
  const toggleSort = () => setSortOrder((prev) => prev === 'none' ? 'asc' : prev === 'asc' ? 'desc' : 'none');

  const calculateStats = () => { let presentCount = 0, absentCount = 0, weekendCount = 0, holidayCount = 0, blankCount = 0; for (const emp of employees) { for (const day of daysArray) { if (isWeekend(day)) weekendCount++; else if (isHoliday(day)) holidayCount++; else if (isPresent(emp.id, day)) presentCount++; else if (isAbsent(emp.id, day)) absentCount++; else blankCount++; } } return [{ name: 'Present', value: presentCount, color: '#22c55e' }, { name: 'Absent', value: absentCount, color: '#ef4444' }, { name: 'Weekend', value: weekendCount, color: '#94a3b8' }, { name: 'Holiday', value: holidayCount, color: '#fbbf24' }, { name: 'Unmarked', value: blankCount, color: '#e2e8f0' }].filter((d) => d.value > 0); };

  const getEmployeeReport = (empId) => { const months = []; for (let m = 0; m < 12; m++) { const daysInM = new Date(currentYear, m + 1, 0).getDate(); let present = 0, absent = 0, weekend = 0, holiday = 0, unmarked = 0; for (let d = 1; d <= daysInM; d++) { const date = new Date(currentYear, m, d); const dateKey = `${currentYear}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`; const dow = date.getDay(); const isH = getSAHolidays(currentYear).some((h) => h.date === dateKey); if (dow === 0 || dow === 6) weekend++; else if (isH) holiday++; else if (attendance[empId]?.[dateKey] === true) present++; else if (attendance[empId]?.[dateKey] === false) absent++; else unmarked++; } months.push({ month: monthNames[m], Present: present, Absent: absent, Weekend: weekend, Holiday: holiday, Unmarked: unmarked }); } return months; };

  if (loading) return <div className="loading">Loading data…</div>;

  return (
    <div className={`App ${darkMode ? 'dark' : ''}`}>
      <header className="app-header">
        <div className="header-top">
          <div className="header-left">
            <span className="user-info clickable" onClick={() => setShowPasswordModal(true)} title="Click to change password">
              Logged in as: {currentUser.fullName} {isAdmin && '(Admin)'}
            </span>
            <button onClick={onLogout} className="logout-btn">Logout</button>
            <button onClick={() => setDarkMode(!darkMode)} className="dark-mode-btn" title="Toggle dark mode">{darkMode ? '☀️' : '🌙'}</button>
          </div>
        </div>
      </header>

      <div className="main-card">
        <div className="controls">
          <div className="month-navigation">
            <button onClick={handlePrevMonth} className="nav-btn"><span>&lsaquo;</span></button>
            <span className="month-display">{monthNames[currentMonth]} {currentYear}</span>
            <button onClick={handleNextMonth} className="nav-btn"><span>&rsaquo;</span></button>
          </div>
          <div className="controls-right">
            <button onClick={() => setShowHistory(true)} className="history-btn">View History</button>
            <button onClick={() => setShowStats(!showStats)} className="stats-btn">{showStats ? 'Hide Stats' : '📊 Stats'}</button>
            <button onClick={toggleSort} className="sort-btn">{sortOrder === 'none' ? '⇅ Sort' : sortOrder === 'asc' ? '↓ A‑Z' : '↑ Z‑A'}</button>
            <div className="add-employee">
              <input type="text" placeholder="Employee name" value={newEmployeeName} onChange={(e) => setNewEmployeeName(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && addEmployee()} />
              <button onClick={addEmployee} className="add-btn">+ Add</button>
            </div>
          </div>
        </div>

        {showStats && (
          <div className="stats-container">
            <h3>Attendance Statistics – {monthNames[currentMonth]} {currentYear}</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart><Pie data={calculateStats()} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, value }) => `${name}: ${value}`}>{calculateStats().map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}</Pie><Tooltip /><Legend /></PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {employees.length === 0 ? (
          <div className="no-employees"><p>No employees added yet.</p></div>
        ) : (
          <div className="rollcall-table-wrapper">
            <table className="rollcall-table">
              <thead>
                <tr>
                  <th className="sticky-col number-header">#</th>
                  <th className="sticky-col employee-header">Employee</th>
                  {daysArray.map((day) => (<th key={day} className="day-header">{day}</th>))}
                  <th className="total-header">Total</th>
                  {isAdmin && <th className="action-header">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {getSortedEmployees().map((emp, index) => {
                  const total = getTotalWorkedDays(emp.id);
                  return (
                    <tr key={emp.id}>
                      <td className="sticky-col number-cell">{index + 1}</td>
                      <td className="sticky-col employee-name">
                        {editEmployeeId === emp.id ? (
                          <input type="text" value={editEmployeeName} onChange={(e) => setEditEmployeeName(e.target.value)} onBlur={saveEditEmployee} onKeyPress={(e) => e.key === 'Enter' && saveEditEmployee()} className="edit-name-input" autoFocus />
                        ) : (
                          <span className="emp-name clickable" onClick={(e) => handleEmployeeClick(e, emp)} title={isAdmin ? 'Click for options' : 'Click to view report'}>{emp.name}</span>
                        )}
                      </td>
                      {daysArray.map((day) => {
                        const present = isPresent(emp.id, day), absent = isAbsent(emp.id, day), edited = isEdited(emp.id, day), weekend = isWeekend(day), holiday = isHoliday(day);
                        const editors = getEditors(emp.id, day), showEditors = (present || absent) && editors.length > 0;
                        return (
                          <td key={day} className={`day-cell ${present ? 'present' : ''} ${absent ? 'absent' : ''} ${edited ? 'edited' : ''} ${weekend ? 'weekend' : ''} ${holiday ? 'holiday' : ''}`} onClick={(e) => openPopup(e, emp.id, day)} title={`${emp.name} – ${day} ${monthNames[currentMonth]} ${currentYear}${weekend ? ' (Weekend)' : ''}${holiday ? ` (${getSAHolidays(currentYear).find(h => h.date === `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`)?.name})` : ''}${showEditors ? ` (edited by ${editors.join(', ')})` : ''}`}>
                            {present && <span className="check-mark">✓</span>}{absent && <span className="absent-mark">✗</span>}{edited && <span className="edit-indicator">✎</span>}
                          </td>
                        );
                      })}
                      <td className="total-cell">{total}</td>
                      {isAdmin && <td className="action-cell"><button onClick={() => deleteEmployee(emp.id)} className="delete-btn" title="Delete employee">🗑️</button></td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <footer className="app-footer">
          <p>Click a blank cell to set attendance, click again to change once. Locked after two edits.</p>
          {isAdmin && <p className="admin-hint">Admin: Click employee name for options. Use 🗑️ to delete.</p>}
        </footer>
      </div>

      {/* History Modal */}
      {showHistory && (
        <div className="history-modal-overlay" onClick={() => setShowHistory(false)}>
          <div className="history-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Attendance Edit History</h2>
            {history.length === 0 ? <p>No edits recorded yet.</p> : (
              <div className="history-table-container"><table className="history-table"><thead><tr><th>Editor</th><th>Employee</th><th>Day</th><th>Date</th><th>Status</th><th>Time</th></tr></thead><tbody>{history.map((entry) => (<tr key={entry.id}><td>{entry.editor}</td><td>{entry.employeeName}</td><td>{entry.day}</td><td>{entry.date}</td><td>{entry.status}</td><td>{new Date(entry.editedAt).toLocaleString()}</td></tr>))}</tbody></table></div>
            )}
            <button className="close-history-btn" onClick={() => setShowHistory(false)}>Close</button>
          </div>
        </div>
      )}

      {/* Password Change Modal */}
      {showPasswordModal && (
        <PasswordChangeModal currentUser={currentUser} onClose={() => setShowPasswordModal(false)} onPasswordChanged={onPasswordChanged} />
      )}

      {/* Context Menu */}
      {contextMenu && isAdmin && createPortal(
        <div ref={contextMenuRef} className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
          <button onClick={() => { setSelectedEmployee(contextMenu.employee); setContextMenu(null); }} className="context-menu-item">📊 View Report</button>
          <button onClick={() => startEditEmployee(contextMenu.employee)} className="context-menu-item">✏️ Rename</button>
        </div>, document.body
      )}

      {/* Employee Report Modal */}
      {selectedEmployee && (
        <div className="history-modal-overlay" onClick={() => setSelectedEmployee(null)}>
          <div className="history-modal report-modal" onClick={(e) => e.stopPropagation()}>
            <h2>📋 {selectedEmployee.name} – {currentYear} Attendance Report</h2>
            <div className="report-summary">
              {(() => {
                const report = getEmployeeReport(selectedEmployee.id);
                const totalPresent = report.reduce((s, m) => s + m.Present, 0), totalAbsent = report.reduce((s, m) => s + m.Absent, 0), totalWeekend = report.reduce((s, m) => s + m.Weekend, 0), totalHoliday = report.reduce((s, m) => s + m.Holiday, 0), totalUnmarked = report.reduce((s, m) => s + m.Unmarked, 0);
                return (
                  <div className="report-summary-grid">
                    <div className="report-stat present"><span>✓ Present</span><strong>{totalPresent}</strong></div>
                    <div className="report-stat absent"><span>✗ Absent</span><strong>{totalAbsent}</strong></div>
                    <div className="report-stat weekend"><span>Weekend</span><strong>{totalWeekend}</strong></div>
                    <div className="report-stat holiday"><span>Holiday</span><strong>{totalHoliday}</strong></div>
                    <div className="report-stat unmarked"><span>Unmarked</span><strong>{totalUnmarked}</strong></div>
                  </div>
                );
              })()}
            </div>
            <div className="report-chart">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={getEmployeeReport(selectedEmployee.id)}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Legend /><Bar dataKey="Present" fill="#22c55e" stackId="a" /><Bar dataKey="Absent" fill="#ef4444" stackId="a" /><Bar dataKey="Weekend" fill="#94a3b8" stackId="a" /><Bar dataKey="Holiday" fill="#fbbf24" stackId="a" /><Bar dataKey="Unmarked" fill="#e2e8f0" stackId="a" /></BarChart>
              </ResponsiveContainer>
            </div>
            <div className="report-table-wrapper">
              <table className="history-table"><thead><tr><th>Month</th><th>Present</th><th>Absent</th><th>Weekend</th><th>Holiday</th><th>Unmarked</th><th>Total Days</th></tr></thead><tbody>{getEmployeeReport(selectedEmployee.id).map((m) => (<tr key={m.month}><td>{m.month}</td><td style={{ color: '#22c55e' }}>{m.Present}</td><td style={{ color: '#ef4444' }}>{m.Absent}</td><td style={{ color: '#94a3b8' }}>{m.Weekend}</td><td style={{ color: '#fbbf24' }}>{m.Holiday}</td><td style={{ color: '#94a3b8' }}>{m.Unmarked}</td><td>{new Date(currentYear, monthNames.indexOf(m.month) + 1, 0).getDate()}</td></tr>))}</tbody></table>
            </div>
            <button className="close-history-btn" onClick={() => setSelectedEmployee(null)}>Close</button>
          </div>
        </div>
      )}

      {/* Attendance Popup */}
      {popup && createPortal(<div ref={popupRef} className="attendance-popup" style={{ left: popup.x, top: popup.y }}><button className="popup-btn present-btn" onClick={() => markAttendance(popup.employeeId, popup.day, true)}>✓ Present</button><button className="popup-btn absent-btn" onClick={() => markAttendance(popup.employeeId, popup.day, false)}>✗ Absent</button></div>, document.body)}
    </div>
  );
}

/* -------------------- MAIN APP -------------------- */
function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('mtworld_current_user');
    return saved ? JSON.parse(saved) : null;
  });

  const handleLogin = (user) => {
    setCurrentUser(user);
    localStorage.setItem('mtworld_current_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('mtworld_current_user');
  };

  const handlePasswordChanged = () => {
    const saved = localStorage.getItem('mtworld_current_user');
    if (saved) setCurrentUser(JSON.parse(saved));
  };

  return currentUser ? (
    <AttendanceRegister currentUser={currentUser} onLogout={handleLogout} onPasswordChanged={handlePasswordChanged} />
  ) : (
    <Login onLogin={handleLogin} />
  );
}

export default App;