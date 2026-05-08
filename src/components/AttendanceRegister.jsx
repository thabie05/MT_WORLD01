import React, { useState, useEffect, useRef } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { seedUsersIfNeeded } from '../data/users';
import { getSAHolidays, monthNames } from '../utils/holidays';
import PasswordChangeModal from './PasswordChangeModal';
import StatsChart from './StatsChart';
import HistoryModal from './HistoryModal';
import EmployeeReportModal from './EmployeeReportModal';
import ContextMenu from './ContextMenu';
import AttendancePopup from './AttendancePopup';

function AttendanceRegister({ currentUser, onLogout, onPasswordChanged }) {
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [edits, setEdits] = useState({});
  const [history, setHistory] = useState([]);
  const [notes, setNotes] = useState({});
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
  const [popupNote, setPopupNote] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const popupRef = useRef(null);
  const contextMenuRef = useRef(null);

  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const isAdmin = currentUser.role === 'admin';

  // Seed Firestore users on first load
  useEffect(() => { seedUsersIfNeeded(db, doc, getDoc, setDoc); }, []);

  // Dark mode
  useEffect(() => {
    if (darkMode) document.body.classList.add('dark-mode');
    else document.body.classList.remove('dark-mode');
    localStorage.setItem('mtworld_dark_mode', darkMode);
  }, [darkMode]);

  // Migrate old boolean attendance data to new string format
  const migrateAndSaveOldData = async (data, docRef) => {
    const { attendance: oldAttendance } = data;
    if (!oldAttendance) return data;

    const newAttendance = {};
    let needsMigration = false;

    for (const empId in oldAttendance) {
      newAttendance[empId] = {};
      for (const dateKey in oldAttendance[empId]) {
        const value = oldAttendance[empId][dateKey];
        if (value === true) {
          newAttendance[empId][dateKey] = 'present';
          needsMigration = true;
        } else if (value === false) {
          newAttendance[empId][dateKey] = 'absent';
          needsMigration = true;
        } else if (typeof value === 'string') {
          newAttendance[empId][dateKey] = value; // already migrated
        } else {
          newAttendance[empId][dateKey] = value;
        }
      }
    }

    if (needsMigration) {
      console.log('Migrating old attendance data to new format...');
      const updatedData = { ...data, attendance: newAttendance };
      await setDoc(docRef, updatedData, { merge: true });
      return updatedData;
    }

    return data;
  };

  // Fetch data from Firestore
  useEffect(() => {
    const fetchData = async () => {
      try {
        const docRef = doc(db, 'rollcall', 'data');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          let data = snap.data();

          // Migrate old boolean data to new string format
          data = await migrateAndSaveOldData(data, docRef);

          setEmployees(data.employees || []);
          setAttendance(data.attendance || {});
          setEdits(data.edits || {});
          setHistory(data.history || []);
          setNotes(data.notes || {});
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

  // Save data to Firestore
  useEffect(() => {
    if (loading) return;
    const saveData = async () => {
      try {
        const docRef = doc(db, 'rollcall', 'data');
        await setDoc(docRef, { employees, attendance, edits, history, notes }, { merge: true });
      } catch (err) {
        console.error('Failed to save data:', err);
      }
    };
    saveData();
  }, [employees, attendance, edits, history, notes, loading]);

  // Close popup on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (popupRef.current && popupRef.current.contains(e.target)) return;
      setPopup(null);
      setPopupNote('');
    };
    if (popup) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [popup]);

  // Close context menu on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (contextMenuRef.current && contextMenuRef.current.contains(e.target)) return;
      setContextMenu(null);
    };
    if (contextMenu) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [contextMenu]);

  // Calendar helpers
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const isWeekend = (day) => {
    const date = new Date(currentYear, currentMonth, day);
    return date.getDay() === 0 || date.getDay() === 6;
  };

  const isHoliday = (day) => {
    const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return getSAHolidays(currentYear).some((h) => h.date === dateKey);
  };

  // Mark attendance
  const markAttendance = (employeeId, day, status, noteText = '') => {
    const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    // Track edit count
    setEdits((prev) => {
      const current = prev[`${employeeId}-${dateKey}`];
      const count = typeof current === 'number' ? current : current ? 1 : 0;
      return { ...prev, [`${employeeId}-${dateKey}`]: count + 1 };
    });

    // Set attendance status
    setAttendance((prev) => {
      const updated = { ...prev };
      const empAttendance = { ...(updated[employeeId] || {}) };
      empAttendance[dateKey] = status;
      if (Object.keys(empAttendance).length === 0) delete updated[employeeId];
      else updated[employeeId] = empAttendance;
      return updated;
    });

    // Save note if provided
    if (noteText.trim()) {
      setNotes((prev) => ({ ...prev, [`${employeeId}-${dateKey}`]: noteText.trim() }));
    }

    // Add to history
    const employee = employees.find((emp) => emp.id === employeeId);
    const statusLabel =
      status === 'present' ? 'Present' :
      status === 'absent' ? 'Absent' :
      status === 'late' ? 'Late' : 'Early';
    setHistory((prev) => [
      {
        id: Date.now(),
        employeeId,
        employeeName: employee?.name || 'Unknown',
        day,
        date: dateKey,
        status: statusLabel,
        note: noteText.trim() || '',
        editor: currentUser.fullName,
        editedAt: new Date().toISOString(),
      },
      ...prev,
    ]);

    setPopup(null);
    setPopupNote('');
  };

  // Status helpers
  const getStatus = (employeeId, day) => {
    const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return attendance[employeeId]?.[dateKey] || null;
  };

  const isPresent = (employeeId, day) => getStatus(employeeId, day) === 'present';
  const isAbsent = (employeeId, day) => getStatus(employeeId, day) === 'absent';
  const isLate = (employeeId, day) => getStatus(employeeId, day) === 'late';
  const isEarly = (employeeId, day) => getStatus(employeeId, day) === 'early';

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

  const getNote = (employeeId, day) => {
    const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return notes[`${employeeId}-${dateKey}`] || '';
  };

  const getTotalWorkedDays = (employeeId) => {
    const empAttendance = attendance[employeeId] || {};
    const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-`;
    return Object.keys(empAttendance).filter(
      (key) =>
        key.startsWith(monthPrefix) &&
        (empAttendance[key] === 'present' ||
          empAttendance[key] === 'late' ||
          empAttendance[key] === 'early')
    ).length;
  };

  // Employee management
  const addEmployee = () => {
    const name = newEmployeeName.trim();
    if (name === '') return;
    setEmployees((prev) => [...prev, { id: Date.now().toString(), name }]);
    setNewEmployeeName('');
  };

  const deleteEmployee = (id) => {
    if (!isAdmin) return;
    setEmployees((prev) => prev.filter((emp) => emp.id !== id));
    setAttendance((prev) => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });
  };

  const startEditEmployee = (emp) => {
    if (!isAdmin) return;
    setContextMenu(null);
    setEditEmployeeId(emp.id);
    setEditEmployeeName(emp.name);
  };

  const saveEditEmployee = () => {
    if (!isAdmin || editEmployeeName.trim() === '') return;
    setEmployees((prev) =>
      prev.map((emp) =>
        emp.id === editEmployeeId ? { ...emp, name: editEmployeeName.trim() } : emp
      )
    );
    setEditEmployeeId(null);
    setEditEmployeeName('');
  };

  // Month navigation
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

  // Popup
  const openPopup = (e, employeeId, day) => {
    e.stopPropagation();
    const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const currentEdits = edits[`${employeeId}-${dateKey}`];
    const editCount = typeof currentEdits === 'number' ? currentEdits : 0;
    if (editCount >= 2) return;
    setPopupNote(getNote(employeeId, day));
    const rect = e.currentTarget.getBoundingClientRect();
    setPopup({
      employeeId,
      day,
      x: rect.left + window.scrollX,
      y: rect.bottom + window.scrollY,
    });
  };

  // Employee click handler
  const handleEmployeeClick = (e, emp) => {
    e.stopPropagation();
    if (isAdmin) {
      const rect = e.currentTarget.getBoundingClientRect();
      setContextMenu({
        employee: emp,
        x: rect.left + window.scrollX,
        y: rect.bottom + window.scrollY,
      });
    } else {
      setSelectedEmployee(emp);
    }
  };

  // Sorting
  const getSortedEmployees = () => {
    if (sortOrder === 'none') return employees;
    return [...employees].sort((a, b) =>
      sortOrder === 'asc'
        ? a.name.toLowerCase().localeCompare(b.name.toLowerCase())
        : b.name.toLowerCase().localeCompare(a.name.toLowerCase())
    );
  };

  // Stats
  const calculateStats = () => {
    let presentCount = 0,
      absentCount = 0,
      lateCount = 0,
      earlyCount = 0,
      weekendCount = 0,
      holidayCount = 0,
      blankCount = 0;

    for (const emp of employees) {
      for (const day of daysArray) {
        if (isWeekend(day)) weekendCount++;
        else if (isHoliday(day)) holidayCount++;
        else if (isPresent(emp.id, day)) presentCount++;
        else if (isLate(emp.id, day)) lateCount++;
        else if (isEarly(emp.id, day)) earlyCount++;
        else if (isAbsent(emp.id, day)) absentCount++;
        else blankCount++;
      }
    }

    return [
      { name: 'Present', value: presentCount, color: '#22c55e' },
      { name: 'Late', value: lateCount, color: '#f59e0b' },
      { name: 'Early Leave', value: earlyCount, color: '#8b5cf6' },
      { name: 'Absent', value: absentCount, color: '#ef4444' },
      { name: 'Weekend', value: weekendCount, color: '#94a3b8' },
      { name: 'Holiday', value: holidayCount, color: '#fbbf24' },
      { name: 'Unmarked', value: blankCount, color: '#e2e8f0' },
    ].filter((d) => d.value > 0);
  };

  // Employee report
  const getEmployeeReport = (empId) => {
    const months = [];
    for (let m = 0; m < 12; m++) {
      const daysInM = new Date(currentYear, m + 1, 0).getDate();
      let present = 0,
        absent = 0,
        late = 0,
        early = 0,
        weekend = 0,
        holiday = 0,
        unmarked = 0;

      for (let d = 1; d <= daysInM; d++) {
        const date = new Date(currentYear, m, d);
        const dateKey = `${currentYear}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dow = date.getDay();
        const isH = getSAHolidays(currentYear).some((h) => h.date === dateKey);

        if (dow === 0 || dow === 6) weekend++;
        else if (isH) holiday++;
        else if (attendance[empId]?.[dateKey] === 'present') present++;
        else if (attendance[empId]?.[dateKey] === 'late') late++;
        else if (attendance[empId]?.[dateKey] === 'early') early++;
        else if (attendance[empId]?.[dateKey] === 'absent') absent++;
        else unmarked++;
      }

      months.push({
        month: monthNames[m],
        Present: present,
        Late: late,
        Early: early,
        Absent: absent,
        Weekend: weekend,
        Holiday: holiday,
        Unmarked: unmarked,
      });
    }
    return months;
  };

  if (loading) return <div className="loading">Loading data…</div>;

  return (
    <div className={`App ${darkMode ? 'dark' : ''}`}>
      {/* HEADER */}
      <header className="app-header">
        <div className="header-top">
          <div className="header-left">
            <span
              className="user-info clickable"
              onClick={() => setShowPasswordModal(true)}
              title="Click to change password"
            >
              Logged in as: {currentUser.fullName} {isAdmin && '(Admin)'}
            </span>
            <button onClick={onLogout} className="logout-btn">Logout</button>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="dark-mode-btn"
              title="Toggle dark mode"
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
          </div>
          <div className="header-right">
            <img src="/logo.png" alt="MT WORLD Logo" className="logo" />
          </div>
        </div>
        <h1 className="header-title">MT World Employee Attendance Register</h1>
      </header>

      {/* MAIN CARD */}
      <div className="main-card">
        {/* CONTROLS */}
        <div className="controls">
          <div className="month-navigation">
            <button onClick={handlePrevMonth} className="nav-btn"><span>&lsaquo;</span></button>
            <span className="month-display">{monthNames[currentMonth]} {currentYear}</span>
            <button onClick={handleNextMonth} className="nav-btn"><span>&rsaquo;</span></button>
          </div>
          <div className="controls-right">
            <button onClick={() => setShowHistory(true)} className="history-btn">View History</button>
            <button onClick={() => setShowStats(!showStats)} className="stats-btn">
              {showStats ? 'Hide Stats' : '📊 Stats'}
            </button>
            <button
              onClick={() =>
                setSortOrder((prev) =>
                  prev === 'none' ? 'asc' : prev === 'asc' ? 'desc' : 'none'
                )
              }
              className="sort-btn"
            >
              {sortOrder === 'none' ? '⇅ Sort' : sortOrder === 'asc' ? '↓ A‑Z' : '↑ Z‑A'}
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

        {/* STATS */}
        {showStats && <StatsChart stats={calculateStats()} />}

        {/* TABLE */}
        {employees.length === 0 ? (
          <div className="no-employees"><p>No employees added yet.</p></div>
        ) : (
          <div className="rollcall-table-wrapper">
            <table className="rollcall-table">
              <thead>
                <tr>
                  <th className="sticky-col number-header">#</th>
                  <th className="sticky-col employee-header">Employee</th>
                  {daysArray.map((day) => (
                    <th key={day} className="day-header">{day}</th>
                  ))}
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
                          <input
                            type="text"
                            value={editEmployeeName}
                            onChange={(e) => setEditEmployeeName(e.target.value)}
                            onBlur={saveEditEmployee}
                            onKeyPress={(e) => e.key === 'Enter' && saveEditEmployee()}
                            className="edit-name-input"
                            autoFocus
                          />
                        ) : (
                          <span
                            className="emp-name clickable"
                            onClick={(e) => handleEmployeeClick(e, emp)}
                            title={isAdmin ? 'Click for options' : 'Click to view report'}
                          >
                            {emp.name}
                          </span>
                        )}
                      </td>
                      {daysArray.map((day) => {
                        const present = isPresent(emp.id, day);
                        const absent = isAbsent(emp.id, day);
                        const late = isLate(emp.id, day);
                        const early = isEarly(emp.id, day);
                        const edited = isEdited(emp.id, day);
                        const weekend = isWeekend(day);
                        const holiday = isHoliday(day);
                        const editors = getEditors(emp.id, day);
                        const note = getNote(emp.id, day);
                        const hasMark = present || absent || late || early;
                        const showEditors = hasMark && editors.length > 0;

                        let cellClass = 'day-cell';
                        if (present) cellClass += ' present';
                        if (absent) cellClass += ' absent';
                        if (late) cellClass += ' late';
                        if (early) cellClass += ' early';
                        if (edited) cellClass += ' edited';
                        if (weekend) cellClass += ' weekend';
                        if (holiday) cellClass += ' holiday';

                        let tooltip = `${emp.name} – ${day} ${monthNames[currentMonth]} ${currentYear}`;
                        if (weekend) tooltip += ' (Weekend)';
                        if (holiday) {
                          const holidayName = getSAHolidays(currentYear).find(
                            (h) => h.date === `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                          )?.name;
                          tooltip += ` (${holidayName})`;
                        }
                        if (late) tooltip += ' (Late)';
                        if (early) tooltip += ' (Early Leave)';
                        if (note) tooltip += ` – 📝 ${note}`;
                        if (showEditors) tooltip += ` (edited by ${editors.join(', ')})`;

                        return (
                          <td
                            key={day}
                            className={cellClass}
                            onClick={(e) => openPopup(e, emp.id, day)}
                            title={tooltip}
                          >
                            {present && <span className="check-mark">✓</span>}
                            {absent && <span className="absent-mark">✗</span>}
                            {late && <span className="late-mark">⏰</span>}
                            {early && <span className="early-mark">🚪</span>}
                            {note && <span className="note-dot" title={note}>📝</span>}
                            {edited && <span className="edit-indicator">✎</span>}
                          </td>
                        );
                      })}
                      <td className="total-cell">{total}</td>
                      {isAdmin && (
                        <td className="action-cell">
                          <button
                            onClick={() => deleteEmployee(emp.id)}
                            className="delete-btn"
                            title="Delete employee"
                          >
                            🗑️
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* FOOTER */}
        <footer className="app-footer">
          <p>Click a blank cell to mark attendance. Options: Present, Absent, Late, or Early Leave (with optional note). Locked after two edits.</p>
          {isAdmin && <p className="admin-hint">Admin: Click employee name for options. Use 🗑️ to delete.</p>}
        </footer>
      </div>

      {/* MODALS & POPUPS */}
      {showHistory && <HistoryModal history={history} onClose={() => setShowHistory(false)} />}
      {showPasswordModal && (
        <PasswordChangeModal currentUser={currentUser} onClose={() => setShowPasswordModal(false)} onPasswordChanged={onPasswordChanged} />
      )}
      {contextMenu && isAdmin && (
        <ContextMenu
          contextMenu={contextMenu}
          contextMenuRef={contextMenuRef}
          onViewReport={() => {
            setSelectedEmployee(contextMenu.employee);
            setContextMenu(null);
          }}
          onRename={() => startEditEmployee(contextMenu.employee)}
        />
      )}
      {selectedEmployee && (
        <EmployeeReportModal
          employee={selectedEmployee}
          report={getEmployeeReport(selectedEmployee.id)}
          year={currentYear}
          onClose={() => setSelectedEmployee(null)}
        />
      )}
      <AttendancePopup
        popup={popup}
        popupNote={popupNote}
        setPopupNote={setPopupNote}
        popupRef={popupRef}
        onMark={markAttendance}
      />
    </div>
  );
}

export default AttendanceRegister;