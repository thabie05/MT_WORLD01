import React, { useState, useEffect, useRef } from 'react';
import { doc, getDoc, setDoc, updateDoc, deleteField, arrayUnion, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { getSAHolidays, monthNames } from '../utils/holidays';
import PasswordChangeModal from './PasswordChangeModal';
import StatsPage from './StatsPage';
import HistoryModal from './HistoryModal';
import EmployeeReportModal from './EmployeeReportModal';
import ContextMenu from './ContextMenu';
import AttendancePopup from './AttendancePopup';
import EmailReportModal from './EmailReportModal';
import ConfirmModal from './ConfirmModal';
import EnrollFingerprintModal from './EnrollFingerprintModal';
import { useTheme } from '../contexts/ThemeContext'; 

function AttendanceRegister({ currentUser, onLogout, onPasswordChanged }) {
  const { theme, toggleTheme } = useTheme(); 

  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [edits, setEdits] = useState({});
  const [history, setHistory] = useState([]);
  const [notes, setNotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState('asc');
  const [showDeleted, setShowDeleted] = useState(false);
  const [showStatsPage, setShowStatsPage] = useState(false);
  const [editEmployeeId, setEditEmployeeId] = useState(null);
  const [editEmployeeName, setEditEmployeeName] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [popup, setPopup] = useState(null);
  const [popupNote, setPopupNote] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [addError, setAddError] = useState('');
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [highlightedEmployee, setHighlightedEmployee] = useState(null);
  const [highlightedDay, setHighlightedDay] = useState(null);
  const [highlightedColumn, setHighlightedColumn] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [enrollEmployee, setEnrollEmployee] = useState(null);
  const [lastEdit, setLastEdit] = useState(null);

  const popupRef = useRef(null);
  const contextMenuRef = useRef(null);

  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const isAdmin = currentUser.role === 'admin';

  // ---------- Data logic ----------
  useEffect(() => {
    const docRef = doc(db, 'rollcall', 'data');
    const unsubscribe = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const savedAttendance = data.attendance || {};
        const convertedAttendance = {};
        for (const empId in savedAttendance) {
          convertedAttendance[empId] = {};
          for (const dateKey in savedAttendance[empId]) {
            const value = savedAttendance[empId][dateKey];
            if (value === true) convertedAttendance[empId][dateKey] = 'present';
            else if (value === false) convertedAttendance[empId][dateKey] = 'absent';
            else convertedAttendance[empId][dateKey] = value;
          }
        }
        setEmployees(data.employees || []);
        setAttendance(convertedAttendance);
        setEdits(data.edits || {});
        setHistory(data.history || []);
        setNotes(data.notes || {});
      } else {
        const initialEmployees = [{ id: '1', name: 'John Doe' }, { id: '2', name: 'Jane Smith' }];
        setEmployees(initialEmployees);
        setAttendance({}); setEdits({}); setHistory([]); setNotes({});
        setDoc(docRef, { employees: initialEmployees, attendance: {}, edits: {}, history: [], notes: {} }).catch(console.error);
      }
      setLoading(false);
    }, (err) => { console.error('Failed to listen to data:', err); setLoading(false); });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleClick = (e) => {
      if (popupRef.current && popupRef.current.contains(e.target)) return;
      setPopup(null); setPopupNote('');
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
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const isWeekend = (day) => {
    const date = new Date(currentYear, currentMonth, day);
    return date.getDay() === 0 || date.getDay() === 6;
  };

  const isHoliday = (day) => {
    const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return getSAHolidays(currentYear).some((h) => h.date === dateKey);
  };

  const markAttendance = async (employeeId, day, status, noteText = '') => {
    const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const currentEditVal = edits[`${employeeId}-${dateKey}`];
    const currentCount = typeof currentEditVal === 'number' ? currentEditVal : currentEditVal ? 1 : 0;
    const newCount = currentCount + 1;
    const trimmedNote = noteText.trim();
    const employee = employees.find((emp) => emp.id === employeeId);
    const statusLabel = status === 'present' ? 'Present' : status === 'absent' ? 'Absent' : status === 'late' ? 'Late' : status === 'early' ? 'Early' : 'Off Duty';
    const historyEntry = { id: Date.now(), employeeId, employeeName: employee?.name || 'Unknown', day, date: dateKey, status: statusLabel, note: trimmedNote || '', editor: currentUser.fullName, editedAt: new Date().toISOString() };

    const previousStatus = getStatus(employeeId, day);
    const previousNote = getNote(employeeId, day);
    const previousEditCount = edits[`${employeeId}-${dateKey}`] || 0;
    setLastEdit({ employeeId, day, previousStatus, previousNote, previousEditCount, dateKey });

    setEdits((prev) => ({ ...prev, [`${employeeId}-${dateKey}`]: newCount }));
    setAttendance((prev) => {
      const updated = { ...prev };
      const empAttendance = { ...(updated[employeeId] || {}) };
      empAttendance[dateKey] = status;
      updated[employeeId] = empAttendance;
      return updated;
    });
    if (trimmedNote) setNotes((prev) => ({ ...prev, [`${employeeId}-${dateKey}`]: trimmedNote }));
    setHistory((prev) => [historyEntry, ...prev]);
    setPopup(null); setPopupNote('');

    try {
      const docRef = doc(db, 'rollcall', 'data');
      const updates = {
        [`attendance.${employeeId}.${dateKey}`]: status,
        [`edits.${employeeId}-${dateKey}`]: newCount,
        history: arrayUnion(historyEntry),
      };
      if (trimmedNote) updates[`notes.${employeeId}-${dateKey}`] = trimmedNote;
      await updateDoc(docRef, updates);
    } catch (err) { console.error('Failed to save attendance mark:', err); }
  };

  const clearAttendance = async (employeeId, day) => {
    const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const employee = employees.find((emp) => emp.id === employeeId);
    const historyEntry = { id: Date.now(), employeeId, employeeName: employee?.name || 'Unknown', day, date: dateKey, status: 'Cleared', note: '', editor: currentUser.fullName, editedAt: new Date().toISOString() };

    setAttendance((prev) => {
      const updated = { ...prev };
      if (updated[employeeId]) {
        const empAttendance = { ...updated[employeeId] };
        delete empAttendance[dateKey];
        if (Object.keys(empAttendance).length === 0) delete updated[employeeId];
        else updated[employeeId] = empAttendance;
      }
      return updated;
    });
    setNotes((prev) => { const updated = { ...prev }; delete updated[`${employeeId}-${dateKey}`]; return updated; });
    setEdits((prev) => { const updated = { ...prev }; delete updated[`${employeeId}-${dateKey}`]; return updated; });
    setHistory((prev) => [historyEntry, ...prev]);
    setPopup(null); setPopupNote('');

    try {
      const docRef = doc(db, 'rollcall', 'data');
      await updateDoc(docRef, {
        [`attendance.${employeeId}.${dateKey}`]: deleteField(),
        [`notes.${employeeId}-${dateKey}`]: deleteField(),
        [`edits.${employeeId}-${dateKey}`]: deleteField(),
        [`timeLogs.${employeeId}-${dateKey}`]: deleteField(),
        history: arrayUnion(historyEntry),
      });
    } catch (err) { console.error('Failed to save after clear:', err); }
  };

  const getStatus = (employeeId, day) => {
    const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return attendance[employeeId]?.[dateKey] || null;
  };
  const isPresent = (employeeId, day) => getStatus(employeeId, day) === 'present';
  const isAbsent = (employeeId, day) => getStatus(employeeId, day) === 'absent';
  const isLate = (employeeId, day) => getStatus(employeeId, day) === 'late';
  const isEarly = (employeeId, day) => getStatus(employeeId, day) === 'early';
  const isOff = (employeeId, day) => getStatus(employeeId, day) === 'off';
  const isEdited = (employeeId, day) => {
    const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const count = edits[`${employeeId}-${dateKey}`];
    return typeof count === 'number' && count >= 2;
  };
  const getEditors = (employeeId, day) => {
    const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const entries = history.filter((h) => h.employeeId === employeeId && h.date === dateKey).sort((a, b) => new Date(a.editedAt) - new Date(b.editedAt));
    const uniqueEditors = [], seen = new Set();
    for (const entry of entries) { if (!seen.has(entry.editor)) { seen.add(entry.editor); uniqueEditors.push(entry.editor); } }
    return uniqueEditors;
  };
  const getNote = (employeeId, day) => {
    const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return notes[`${employeeId}-${dateKey}`] || '';
  };
  const getTotalWorkedDays = (employeeId) => {
    const empAttendance = attendance[employeeId] || {};
    const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-`;
    return Object.keys(empAttendance).filter((key) => key.startsWith(monthPrefix) && (empAttendance[key] === 'present' || empAttendance[key] === 'late' || empAttendance[key] === 'early')).length;
  };

  const addEmployee = async () => {
    const name = newEmployeeName.trim();
    if (name === '') return;
    const isDuplicate = employees.some((emp) => emp.name.toLowerCase() === name.toLowerCase() && !emp.isDeleted);
    if (isDuplicate) { setAddError('This employee already exists!'); setTimeout(() => setAddError(''), 3000); return; }
    setAddError('');
    const newEmployee = { id: Date.now().toString(), name, isDeleted: false };
    const updatedEmployees = [...employees, newEmployee];
    setEmployees(updatedEmployees); setNewEmployeeName('');
    try {
      const docRef = doc(db, 'rollcall', 'data');
      await updateDoc(docRef, { employees: updatedEmployees });
    } catch (err) { console.error('Failed to save new employee:', err); }
  };

  const softDeleteEmployee = async (id) => {
    if (!isAdmin) return;
    const updatedEmployees = employees.map((emp) => emp.id === id ? { ...emp, isDeleted: true } : emp);
    setEmployees(updatedEmployees);
    try {
      const docRef = doc(db, 'rollcall', 'data');
      await updateDoc(docRef, { employees: updatedEmployees });
    } catch (err) { console.error('Failed to soft-delete employee:', err); }
  };

  const restoreEmployee = async (id) => {
    if (!isAdmin) return;
    const updatedEmployees = employees.map((emp) => emp.id === id ? { ...emp, isDeleted: false } : emp);
    setEmployees(updatedEmployees);
    try {
      const docRef = doc(db, 'rollcall', 'data');
      await updateDoc(docRef, { employees: updatedEmployees });
    } catch (err) { console.error('Failed to restore employee:', err); }
  };

  const permanentDeleteEmployee = async (id) => {
    if (!isAdmin) return;
    const updatedEmployees = employees.filter((emp) => emp.id !== id);
    setEmployees(updatedEmployees);
    setAttendance((prev) => { const updated = { ...prev }; delete updated[id]; return updated; });
    try {
      const docRef = doc(db, 'rollcall', 'data');
      await updateDoc(docRef, { employees: updatedEmployees, [`attendance.${id}`]: deleteField() });
    } catch (err) { console.error('Failed to permanently delete employee:', err); }
  };

  const startEditEmployee = (emp) => {
    if (!isAdmin) return;
    setContextMenu(null);
    setEditEmployeeId(emp.id);
    setEditEmployeeName(emp.name);
  };

  const saveEditEmployee = async () => {
    if (!isAdmin) return;
    const newName = editEmployeeName.trim();
    if (newName === '') { setEditEmployeeId(null); setEditEmployeeName(''); return; }
    const isDuplicate = employees.some((emp) => emp.id !== editEmployeeId && emp.name.toLowerCase() === newName.toLowerCase() && !emp.isDeleted);
    if (isDuplicate) { alert('An employee with this name already exists!'); return; }
    const updatedEmployees = employees.map((emp) => emp.id === editEmployeeId ? { ...emp, name: newName } : emp);
    setEmployees(updatedEmployees);
    setEditEmployeeId(null); setEditEmployeeName('');
    try {
      const docRef = doc(db, 'rollcall', 'data');
      await updateDoc(docRef, { employees: updatedEmployees });
    } catch (err) { console.error('Failed to save employee rename:', err); }
  };

  const handlePrevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear((prev) => prev - 1); } else setCurrentMonth((prev) => prev - 1);
  };
  const handleNextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear((prev) => prev + 1); } else setCurrentMonth((prev) => prev + 1);
  };

  const openPopup = (e, employeeId, day) => {
    e.stopPropagation();
    const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const currentEdits = edits[`${employeeId}-${dateKey}`];
    const editCount = typeof currentEdits === 'number' ? currentEdits : 0;
    if (editCount >= 2 && !isAdmin) return;
    setPopupNote(getNote(employeeId, day));
    const rect = e.currentTarget.getBoundingClientRect();
    setPopup({ employeeId, day, x: rect.left + window.scrollX, y: rect.bottom + window.scrollY });
  };

  const handleClearConfirm = (employeeId, day) => {
    const employee = employees.find((emp) => emp.id === employeeId);
    setPopup(null);
    setConfirmModal({
      message: `Clear the attendance mark for ${employee?.name || 'this employee'} on day ${day}? This cannot be undone.`,
      onConfirm: () => { clearAttendance(employeeId, day); setConfirmModal(null); }
    });
  };

  const handleEmployeeClick = (e, emp) => {
    e.stopPropagation();
    if (isAdmin) {
      const rect = e.currentTarget.getBoundingClientRect();
      setContextMenu({ employee: emp, x: rect.left + window.scrollX, y: rect.bottom + window.scrollY });
    } else setSelectedEmployee(emp);
  };

  const getSortedEmployees = () => {
    const filtered = employees.filter((emp) => (showDeleted ? emp.isDeleted : !emp.isDeleted));
    return [...filtered].sort((a, b) => sortOrder === 'asc' ? a.name.toLowerCase().localeCompare(b.name.toLowerCase()) : b.name.toLowerCase().localeCompare(a.name.toLowerCase()));
  };
  const toggleSort = () => setSortOrder((prev) => prev === 'asc' ? 'desc' : 'asc');

  const backupData = () => {
    const data = { employees, attendance, edits, history, notes };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mtworld-backup-${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}.json`;
    a.click(); URL.revokeObjectURL(url);
  };

  const restoreData = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setConfirmModal({
      message: 'This will merge the backup into the current cloud data. A safety copy is saved first. Continue?',
      onConfirm: () => {
        setConfirmModal(null);
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const data = JSON.parse(event.target.result);
            const docRef = doc(db, 'rollcall', 'data');
            try {
              const currentSnap = await getDoc(docRef);
              if (currentSnap.exists()) {
                const safetyRef = doc(db, 'rollcall_backups', `pre-restore-${Date.now()}`);
                await setDoc(safetyRef, currentSnap.data());
              }
            } catch (snapshotErr) { console.error('Failed to snapshot data before restore:', snapshotErr); }
            if (data.employees) setEmployees(data.employees.map((emp) => ({ ...emp, isDeleted: emp.isDeleted ?? false })));
            if (data.attendance) setAttendance(data.attendance);
            if (data.edits) setEdits(data.edits || {});
            if (data.history) setHistory(data.history || []);
            if (data.notes) setNotes(data.notes || {});
            try {
              await setDoc(docRef, { employees: data.employees || [], attendance: data.attendance || {}, edits: data.edits || {}, history: data.history || [], notes: data.notes || {} }, { merge: true });
              alert('Backup restored successfully!');
            } catch (err) { alert('Restored locally but failed to save to cloud.'); }
          } catch (err) { alert('Invalid backup file.'); }
        };
        reader.readAsText(file);
        e.target.value = '';
      }
    });
  };

  const handleUndo = async () => {
    if (!lastEdit || !isAdmin) return;
    const { employeeId, day, previousStatus, previousNote, previousEditCount, dateKey } = lastEdit;
    if (previousStatus) {
      setEdits((prev) => ({ ...prev, [`${employeeId}-${dateKey}`]: previousEditCount }));
      setAttendance((prev) => {
        const updated = { ...prev };
        if (!updated[employeeId]) updated[employeeId] = {};
        updated[employeeId][dateKey] = previousStatus;
        return updated;
      });
      if (previousNote) setNotes((prev) => ({ ...prev, [`${employeeId}-${dateKey}`]: previousNote }));
      else setNotes((prev) => { const upd = { ...prev }; delete upd[`${employeeId}-${dateKey}`]; return upd; });
      const employee = employees.find((emp) => emp.id === employeeId);
      const historyEntry = { id: Date.now(), employeeId, employeeName: employee?.name || 'Unknown', day, date: dateKey, status: 'Undo', note: '', editor: currentUser.fullName, editedAt: new Date().toISOString() };
      setHistory((prev) => [historyEntry, ...prev]);
      const docRef = doc(db, 'rollcall', 'data');
      await updateDoc(docRef, { [`attendance.${employeeId}.${dateKey}`]: previousStatus, [`edits.${employeeId}-${dateKey}`]: previousEditCount, history: arrayUnion(historyEntry) });
      setLastEdit(null);
    } else {
      clearAttendance(employeeId, day);
      setLastEdit(null);
    }
  };

  const calculateStats = () => {
    let presentCount = 0, absentCount = 0, lateCount = 0, earlyCount = 0, offCount = 0, weekendCount = 0, holidayCount = 0, blankCount = 0;
    for (const emp of employees) {
      if (emp.isDeleted) continue;
      for (const day of daysArray) {
        if (isWeekend(day)) weekendCount++;
        else if (isHoliday(day)) holidayCount++;
        else if (isPresent(emp.id, day)) presentCount++;
        else if (isLate(emp.id, day)) lateCount++;
        else if (isEarly(emp.id, day)) earlyCount++;
        else if (isOff(emp.id, day)) offCount++;
        else if (isAbsent(emp.id, day)) absentCount++;
        else blankCount++;
      }
    }
    return [
      { name: 'Present', value: presentCount, color: '#22c55e' },
      { name: 'Late', value: lateCount, color: '#f59e0b' },
      { name: 'Early Leave', value: earlyCount, color: '#8b5cf6' },
      { name: 'Absent', value: absentCount, color: '#ef4444' },
      { name: 'Off Duty', value: offCount, color: '#94a3b8' },
      { name: 'Weekend', value: weekendCount, color: '#cbd5e1' },
      { name: 'Holiday', value: holidayCount, color: '#fbbf24' },
      { name: 'Unmarked', value: blankCount, color: '#e2e8f0' },
    ].filter((d) => d.value > 0);
  };

  const getEmployeeReport = (empId) => {
    const months = [];
    for (let m = 0; m < 12; m++) {
      const daysInM = new Date(currentYear, m + 1, 0).getDate();
      let present = 0, absent = 0, late = 0, early = 0, off = 0, weekend = 0, holiday = 0, unmarked = 0;
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
        else if (attendance[empId]?.[dateKey] === 'off') off++;
        else if (attendance[empId]?.[dateKey] === 'absent') absent++;
        else unmarked++;
      }
      months.push({ month: monthNames[m], Present: present, Late: late, Early: early, Absent: absent, OffDuty: off, Weekend: weekend, Holiday: holiday, Unmarked: unmarked });
    }
    return months;
  };

  if (loading) return (
    <div className="min-h-screen bg-body text-accent font-['Inter',sans-serif] text-lg flex justify-center items-center">
      <div className="animate-pulse">Loading data…</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-body text-main font-['Inter',sans-serif]">
      {/* ========== HEADER ========== */}
      <header className="flex flex-col bg-[linear-gradient(rgba(26,35,126,0.7),rgba(13,71,161,0.2)),url('/background1.png')] bg-left bg-no-repeat bg-contain relative pt-[150px] pb-[10px] px-6 rounded-xl mb-6 shadow-lg max-sm:py-4 max-sm:px-2 transition-colors duration-300">
  
  {/* ⬇️ LIGHT MODE OVERLAY: White soft overlay to brighten the image ⬇️ */}
  <div className="absolute inset-0 bg-white/20 dark:bg-black/60 rounded-xl pointer-events-none transition-colors duration-300"></div>
  
  {/* ⬇️ CONTENT WRAPPER: Keeps content above the overlays ⬇️ */}
  <div className="flex justify-between items-start w-full relative z-10 max-sm:flex-col max-sm:items-center max-sm:gap-2.5">
    
    {/* Left side – empty */}
    <div></div>

    {/* Right side – theme toggle + user info + logout */}
    <div className="flex items-center gap-3 max-sm:flex-col max-sm:gap-2">
      {/* Dark Mode Toggle Button */}
      <button
        onClick={toggleTheme}
        className="bg-white/10 border border-white/20 text-black dark:bg-[#262A33] dark:border-[#3A3F4B] dark:text-[#EDEAE2] rounded-full p-2 text-sm hover:bg-white/20 dark:hover:bg-[#2E333F] transition-all"
        title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

      {/* User Info Badge */}
      <span
        className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 text-sm font-medium text-black dark:text-[#EDEAE2] dark:bg-[#262A33] dark:border-[#3A3F4B] cursor-pointer hover:bg-white/20 dark:hover:bg-[#2E333F] transition-all"
        onClick={() => setShowPasswordModal(true)}
        title="Click to change password"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        {currentUser.fullName}
        {isAdmin && <span className="text-[#0F91CC] dark:text-[#4DB8E8] text-xs ml-1 font-semibold">(Admin)</span>}
      </span>

      {/* Logout Button */}
      <button
        onClick={onLogout}
        className="bg-white/10 border border-white/20 text-black dark:text-[#EDEAE2] dark:bg-[#262A33] dark:border-[#3A3F4B] py-2 px-4 rounded-full font-medium text-sm transition hover:bg-white/20 hover:border-white/30 dark:hover:bg-[#2E333F]"
      >
        Logout
      </button>
    </div>
  </div>
</header>

      {/* ========== NAVIGATION BAR ========== */}
      <nav className="max-w-[1920px] mx-auto mt-6 px-5 max-sm:px-2.5">
        <div className="bg-card rounded-xl p-3 flex items-center gap-2 flex-wrap border border-main shadow-theme">
          <button onClick={() => setShowHistory(true)} className="bg-input text-main py-2 px-4 rounded-md font-medium text-sm hover:bg-accent-light transition flex items-center gap-2">
            <span className="text-accent">📋</span> History
          </button>
          <button onClick={() => setShowStatsPage(true)} className="bg-input text-main py-2 px-4 rounded-md font-medium text-sm hover:bg-accent-light transition flex items-center gap-2">
            <span className="text-accent">📊</span> Stats
          </button>
          <button onClick={() => setShowEmailModal(true)} className="bg-[#5B9279] text-white py-2 px-4 rounded-md font-medium text-sm hover:bg-[#4E8069] transition flex items-center gap-2">
            📧 Email
          </button>

          {isAdmin && (
            <>
              <div className="w-px h-6 bg-[var(--border)] mx-1" />
              <button onClick={backupData} className="btn-accent py-2 px-4 rounded-md font-semibold text-sm transition flex items-center gap-2">
                💾 Backup
              </button>
              {lastEdit && (
                <button onClick={handleUndo} className="bg-orange-600 text-white py-2 px-4 rounded-md text-sm hover:bg-orange-500 transition flex items-center gap-2">
                  ↩️ Undo
                </button>
              )}
              <label className="bg-input text-main py-2 px-4 rounded-md font-medium text-sm hover:bg-accent-light transition cursor-pointer flex items-center gap-2">
                📥 Restore
                <input type="file" accept=".json" onChange={restoreData} className="hidden" />
              </label>
            </>
          )}

          <div className="w-px h-6 bg-[var(--border)] mx-1" />
          <button onClick={() => window.location.assign(`${window.location.origin}${window.location.pathname}?kiosk=1`)} className="btn-accent py-2 px-4 rounded-md font-semibold text-sm transition flex items-center gap-2">
            🖐️ Kiosk
          </button>

          <button onClick={() => setShowDeleted(!showDeleted)}
            className={`py-2 px-4 rounded-md font-medium text-sm transition flex items-center gap-2 ml-auto ${showDeleted ? 'bg-[#B2604A] text-white hover:bg-[#9E5340]' : 'bg-input text-main hover:bg-accent-light'}`}
          >
            {showDeleted ? '👥 Active' : '🗑️ Trash'}
          </button>
        </div>
      </nav>

      <div className="max-w-[1920px] mx-auto p-5 max-sm:p-2.5">
        {/* ========== MAIN CARD ========== */}
        <div className="bg-card rounded-xl p-5 shadow-theme border border-main">
          {/* ========== CONTROLS ========== */}
          <div className="flex justify-between items-center flex-wrap gap-4 mb-5 pb-5 border-b border-main">
            <div className="flex items-center gap-4">
              <button onClick={handlePrevMonth} className="bg-body text-main rounded-full w-9 h-9 text-lg flex items-center justify-center hover:bg-accent-light transition border border-main">&lsaquo;</button>
              <span className="font-['Oswald',sans-serif] uppercase tracking-wide font-medium text-lg text-accent min-w-[150px] text-center">{monthNames[currentMonth]} {currentYear}</span>
              <button onClick={handleNextMonth} className="bg-body text-main rounded-full w-9 h-9 text-lg flex items-center justify-center hover:bg-accent-light transition border border-main">&rsaquo;</button>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <button onClick={toggleSort} className="bg-input text-main py-2 px-3.5 rounded-md font-medium text-sm hover:bg-accent-light transition min-w-[70px] border border-main">{sortOrder === 'asc' ? '↓ A‑Z' : '↑ Z‑A'}</button>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Employee name"
                  value={newEmployeeName}
                  onChange={(e) => { setNewEmployeeName(e.target.value); setAddError(''); }}
                  onKeyPress={(e) => e.key === 'Enter' && addEmployee()}
                  className="py-2 px-3 border border-main rounded-md text-sm text-main bg-input outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition placeholder-muted"
                />
                <button onClick={addEmployee} className="bg-[#5B9279] text-white py-2 px-4 rounded-md font-medium text-sm hover:bg-[#4E8069] transition">+ Add</button>
              </div>
            </div>
          </div>
          {addError && <p className="text-[#B2604A] text-xs mb-3 font-medium">{addError}</p>}

          {/* ========== TABLE ========== */}
          {employees.length === 0 ? (
            <div className="text-center py-10 text-muted"><p>No employees added yet.</p></div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-main custom-scrollbar">
              <table className="w-full border-collapse min-w-[700px]">
                <thead>
                  <tr>
                    <th className={`sticky left-0 z-[3] w-[30px] min-w-[30px] font-semibold py-1.5 px-1 text-center text-[0.65rem] border-b border-r border-main transition-colors duration-150 ${highlightedEmployee || popup ? 'bg-highlight text-highlight' : 'bg-input text-muted'}`}>#</th>
                    <th className={`sticky left-[30px] z-[2] font-semibold py-1.5 px-3 text-left text-[0.65rem] border-b border-r-2 border-strong transition-colors duration-150 ${highlightedEmployee || popup ? 'bg-highlight text-highlight' : 'bg-input text-muted'}`}>Employee</th>
                    {daysArray.map((day) => {
                      const date = new Date(currentYear, currentMonth, day);
                      const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
                      const dayName = dayNames[date.getDay()];
                      const isColHighlighted = highlightedColumn === day || (popup && popup.day === day);
                      return (
                        <th key={day} className={`font-semibold py-1.5 px-0.5 text-center text-[0.65rem] border-b border-r border-main transition-colors duration-150 ${isColHighlighted ? 'bg-accent-light text-highlight' : 'bg-input text-muted'}`}>
                          <div className={`text-[0.55rem] leading-tight ${isColHighlighted ? 'text-accent' : 'text-muted'}`}>{dayName}</div>
                          <div className={isColHighlighted ? 'text-accent' : 'text-main'}>{day}</div>
                        </th>
                      );
                    })}
                    <th className={`font-semibold py-1.5 px-2 text-center text-[0.65rem] border-b border-main transition-colors duration-150 ${highlightedEmployee || popup ? 'bg-highlight text-highlight' : 'bg-input text-muted'}`}>Total</th>
                    {showDeleted && isAdmin && <th className="font-semibold py-1.5 px-2 text-center text-[0.65rem] border-b border-main bg-input text-muted">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {getSortedEmployees().map((emp, index) => {
                    const total = getTotalWorkedDays(emp.id);
                    const isHighlighted = highlightedEmployee === emp.id || (popup && popup.employeeId === emp.id);

                    if (showDeleted) {
                      return (
                        <tr key={emp.id} className="bg-card">
                          <td className="sticky left-0 bg-card z-[3] text-center text-xs text-muted py-2 px-1 border-b border-r border-main">{index + 1}</td>
                          <td className="sticky left-[30px] bg-card z-[2] py-2 px-3 font-medium border-b border-r-2 border-main text-muted text-sm line-through">{emp.name}</td>
                          {daysArray.map(day => (
                            <td key={day} className="w-9 h-9 text-center text-sm border-b border-r border-main bg-card text-muted">—</td>
                          ))}
                          <td className="text-center font-bold text-muted border-b border-main text-sm">—</td>
                          {isAdmin && (
                            <td className="text-center border-b border-l border-main whitespace-nowrap py-1">
                              <button onClick={() => restoreEmployee(emp.id)} className="text-[#5B9279] hover:text-[#7EB096] text-xs mr-2 transition">↩️ Restore</button>
                              <button onClick={() => { if (window.confirm(`Permanently delete ${emp.name}?`)) permanentDeleteEmployee(emp.id); }} className="text-[#B2604A] hover:text-[#C97B63] text-xs transition">❌ Delete</button>
                            </td>
                          )}
                        </tr>
                      );
                    }

                    return (
                      <tr
                        key={emp.id}
                        className={`transition-colors duration-150 ${isHighlighted ? 'bg-highlight text-main' : 'bg-body even:bg-card'}`}
                        onMouseEnter={() => setHighlightedEmployee(emp.id)}
                        onMouseLeave={() => { setHighlightedEmployee(null); setHighlightedDay(null); setHighlightedColumn(null); }}
                      >
                        <td className={`sticky left-0 z-[3] text-center text-xs font-medium py-2 px-1 w-[30px] border-b border-r border-main transition-colors duration-150 ${isHighlighted ? 'bg-highlight text-highlight' : 'bg-card text-muted'}`}>{index + 1}</td>
                        <td className={`sticky left-[30px] z-[2] py-2 px-3 font-medium border-b border-r-2 border-main text-sm transition-colors duration-150 ${isHighlighted ? 'bg-highlight text-highlight' : 'bg-body text-main'}`}>
                          {editEmployeeId === emp.id ? (
                            <input type="text" value={editEmployeeName} onChange={(e) => setEditEmployeeName(e.target.value)} onBlur={saveEditEmployee} onKeyPress={(e) => e.key === 'Enter' && saveEditEmployee()} className="w-full py-1 px-2 border-2 border-accent rounded text-sm outline-none bg-input text-main" autoFocus />
                          ) : (
                            <span className="whitespace-nowrap cursor-pointer hover:text-accent transition-colors" onClick={(e) => handleEmployeeClick(e, emp)}>{emp.name}</span>
                          )}
                        </td>
                        {daysArray.map((day) => {
                          const present = isPresent(emp.id, day);
                          const absent = isAbsent(emp.id, day);
                          const late = isLate(emp.id, day);
                          const early = isEarly(emp.id, day);
                          const off = isOff(emp.id, day);
                          const edited = isEdited(emp.id, day);
                          const weekend = isWeekend(day);
                          const holiday = isHoliday(day);
                          const note = getNote(emp.id, day);
                          const editors = getEditors(emp.id, day);
                          const showEditors = (present || absent || late || early || off) && editors.length > 0;
                          const isColHighlighted = highlightedColumn === day || (popup && popup.day === day);

                          /* ===== SOFTER GREEN HIGHLIGHT ===== */
                          let cellBg = 'bg-transparent';
                          let cellText = 'text-transparent';
                          let content = '';

                          if (present) { 
                            cellBg = 'bg-[var(--status-green-bg)]'; 
                            cellText = 'text-[var(--status-green-text)] font-bold'; 
                            content = '✓'; 
                          }
                          else if (absent) { 
                            cellBg = 'bg-[var(--status-red-bg)]'; 
                            cellText = 'text-[var(--status-red-text)] font-bold'; 
                            content = '✗'; 
                          }
                          else if (late) { 
                            cellBg = 'bg-[var(--status-yellow-bg)]'; 
                            cellText = 'text-[var(--status-yellow-text)] font-bold'; 
                            content = '⏰'; 
                          }
                          else if (early) { 
                            cellBg = 'bg-[var(--status-purple-bg)]'; 
                            cellText = 'text-[var(--status-purple-text)] font-bold'; 
                            content = '🚪'; 
                          }
                          else if (off) { 
                            cellBg = 'bg-[var(--status-slate-bg)]'; 
                            cellText = 'text-[var(--status-slate-text)] font-bold'; 
                            content = 'OFF'; 
                          }
                          
                          if (weekend) { 
                            cellBg = 'bg-[var(--status-weekend-bg)]'; 
                            cellText = content ? cellText : 'text-[var(--status-slate-text)]'; 
                          }
                          if (holiday) { 
                            cellBg = 'bg-[var(--status-holiday-bg)]'; 
                            cellText = content ? cellText : 'text-[var(--status-yellow-text)] font-medium'; 
                          }

                          /* Dark mode overrides */
                          let darkClasses = '';
                          if (present) { darkClasses = 'dark:bg-green-900/30 dark:text-green-400'; }
                          else if (absent) { darkClasses = 'dark:bg-red-900/30 dark:text-red-400'; }
                          else if (late) { darkClasses = 'dark:bg-yellow-900/30 dark:text-yellow-400'; }
                          else if (early) { darkClasses = 'dark:bg-purple-900/30 dark:text-purple-400'; }
                          else if (off) { darkClasses = 'dark:bg-slate-800 dark:text-slate-400'; }
                          if (weekend) { darkClasses += ' dark:bg-[var(--status-weekend-bg)]'; }
                          if (holiday) { darkClasses += ' dark:bg-[var(--status-holiday-bg)]'; }

                          let tooltip = `${emp.name} – ${day} ${monthNames[currentMonth]} ${currentYear}`;
                          if (weekend) tooltip += ' (Weekend)';
                          if (holiday) { const holidayName = getSAHolidays(currentYear).find(h => h.date === `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`)?.name; tooltip += ` (${holidayName})`; }
                          if (late) tooltip += ' (Late)';
                          if (early) tooltip += ' (Early Leave)';
                          if (note) tooltip += ` – 📝 ${note}`;
                          if (showEditors) tooltip += ` (edited by ${editors.join(', ')})`;

                          return (
                            <td key={day}
                              className={`w-9 h-9 text-center cursor-pointer text-sm border-b border-r border-main transition relative ${cellBg} ${cellText} ${darkClasses} ${!weekend ? 'hover:bg-accent-light' : ''} ${isColHighlighted ? (cellBg === 'bg-transparent' || cellBg === 'bg-body' ? 'bg-highlight text-highlight' : 'brightness-90 saturate-150 shadow-inner') : ''}`}
                              onClick={(e) => openPopup(e, emp.id, day)}
                              onMouseEnter={() => { setHighlightedColumn(day); setHighlightedDay(day); }}
                              onMouseLeave={() => { setHighlightedColumn(null); setHighlightedDay(null); }}
                              title={tooltip}
                            >
                              {content}
                              {note && <span className="absolute bottom-0 left-0.5 text-[0.5rem] text-accent" title={note}>📝</span>}
                              {edited && <span className="absolute top-0 right-0.5 text-[0.45rem] text-orange-500" title="This day has been edited">✎</span>}
                            </td>
                          );
                        })}
                        <td className={`text-center font-bold text-[var(--status-green-total)] border-b border-main text-sm transition-colors duration-150 ${isHighlighted ? 'bg-[var(--status-green-bg)] dark:bg-green-900/30' : 'bg-[var(--status-green-bg)] dark:bg-green-900/20'}`}>{total}</td>
                      </tr>
                    );
                  })}

                  {!showDeleted && (
                    <tr className="bg-input">
                      <td className="sticky left-0 bg-card z-[3] text-center text-[0.65rem] text-muted font-semibold py-1.5 px-1 border-b border-r border-main" colSpan={2}>Present / day</td>
                      {daysArray.map((day) => {
                        let count = 0;
                        for (const emp of employees) {
                          if (!emp.isDeleted && (isPresent(emp.id, day) || isLate(emp.id, day) || isEarly(emp.id, day))) count++;
                        }
                        const isColHighlighted = highlightedColumn === day || (popup && popup.day === day);
                        return (
                          <td key={day} className={`text-center text-[0.7rem] font-bold text-[var(--status-green-text)] border-b border-r border-main py-1 transition-colors duration-150 ${isColHighlighted ? 'bg-highlight text-highlight' : 'bg-card'}`}>
                            {count > 0 ? count : ''}
                          </td>
                        );
                      })}
                      <td className="text-center font-bold text-[var(--status-green-total)] bg-[var(--status-green-bg)] dark:bg-green-900/20 border-b border-main text-sm py-1">
                        {(() => {
                          let grandTotal = 0;
                          for (const emp of employees) {
                            if (!emp.isDeleted) grandTotal += getTotalWorkedDays(emp.id);
                          }
                          return grandTotal;
                        })()}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <footer className="text-center mt-5 text-muted text-sm border-t border-main pt-4">
            <p>Click a blank cell to mark attendance. Locked after two edits.</p>
            {isAdmin && <p className="text-accent italic mt-1 text-xs">Admin: Click employee name for options. Use 💾 Backup to save data.</p>}
          </footer>
        </div>
      </div>

      {/* ========== MODALS ========== */}
      {showHistory && <HistoryModal history={history} onClose={() => setShowHistory(false)} />}
      {showPasswordModal && <PasswordChangeModal currentUser={currentUser} onClose={() => setShowPasswordModal(false)} onPasswordChanged={onPasswordChanged} />}
      {contextMenu && isAdmin && (
        <ContextMenu contextMenu={contextMenu} contextMenuRef={contextMenuRef}
          onViewReport={() => { setSelectedEmployee(contextMenu.employee); setContextMenu(null); }}
          onRename={() => startEditEmployee(contextMenu.employee)}
          onEnrollFingerprint={() => { setEnrollEmployee(contextMenu.employee); setContextMenu(null); }}
          onDelete={() => {
            setContextMenu(null);
            setConfirmModal({
              message: `Move "${contextMenu.employee.name}" to Trash? They can be restored later.`,
              onConfirm: () => { softDeleteEmployee(contextMenu.employee.id); setConfirmModal(null); }
            });
          }} />
      )}
      {selectedEmployee && (() => {
        const reportData = getEmployeeReport(selectedEmployee.id);
        if (!reportData) return null;
        return <EmployeeReportModal employee={selectedEmployee} report={reportData} year={currentYear} onClose={() => setSelectedEmployee(null)} />;
      })()}
      {showEmailModal && <EmailReportModal employees={employees.filter(emp => !emp.isDeleted)} attendance={attendance} currentYear={currentYear} currentMonth={currentMonth} onClose={() => setShowEmailModal(false)} />}
      {showStatsPage && <StatsPage stats={calculateStats()} currentMonth={currentMonth} currentYear={currentYear} onClose={() => setShowStatsPage(false)} />}
      {confirmModal && (
        <ConfirmModal message={confirmModal.message} onConfirm={confirmModal.onConfirm} onCancel={() => setConfirmModal(null)} />
      )}
      {enrollEmployee && (
        <EnrollFingerprintModal employee={enrollEmployee} onClose={() => setEnrollEmployee(null)} />
      )}
      <AttendancePopup
        popup={popup}
        popupNote={popupNote}
        setPopupNote={setPopupNote}
        popupRef={popupRef}
        onMark={markAttendance}
        isAdmin={isAdmin}
        onConfirmClear={handleClearConfirm}
        isLocked={popup ? (() => {
          const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(popup.day).padStart(2, '0')}`;
          const currentEdits = edits[`${popup.employeeId}-${dateKey}`];
          const editCount = typeof currentEdits === 'number' ? currentEdits : 0;
          return editCount >= 2;
        })() : false}
      />
    </div>
  );
}

export default AttendanceRegister;