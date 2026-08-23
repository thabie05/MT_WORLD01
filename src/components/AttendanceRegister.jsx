import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
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
import { closeStaleShifts } from '../utils/attendanceWrites';
import { useTheme } from '../contexts/ThemeContext';
import { useSyncStatus } from '../contexts/SyncStatusContext';

const AttendanceRegister = forwardRef((
  {
    currentUser,
    showHistory,
    setShowHistory,
    onViewProfile,     
    showStatsPage,
    setShowStatsPage,
    showEmailModal,
    setShowEmailModal,
    showDeleted,
    setShowDeleted,
    lastEdit,
    setLastEdit,
  },
  ref
) => {
  const { theme, toggleTheme } = useTheme();
  const { syncStatus, setSyncStatus } = useSyncStatus();

  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [edits, setEdits] = useState({});
  const [history, setHistory] = useState([]);
  const [notes, setNotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(false);
  const [sortOrder, setSortOrder] = useState('asc');
  const [editEmployeeId, setEditEmployeeId] = useState(null);
  const [editEmployeeName, setEditEmployeeName] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [popup, setPopup] = useState(null);
  const [popupNote, setPopupNote] = useState('');
  const [addError, setAddError] = useState('');
  const [highlightedEmployee, setHighlightedEmployee] = useState(null);
  const [highlightedDay, setHighlightedDay] = useState(null);
  const [highlightedColumn, setHighlightedColumn] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [enrollEmployee, setEnrollEmployee] = useState(null);
  const [timeLogs, setTimeLogs] = useState({});
  const closedStaleShiftsRef = useRef(false);

  const popupRef = useRef(null);
  const contextMenuRef = useRef(null);

  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const isAdmin = currentUser.role === 'admin';
  const isUser = currentUser.role === 'user';
  const isViewer = currentUser.role === 'viewer';

  // ---------- Firestore real‑time listener ----------
  useEffect(() => {
    const docRef = doc(db, 'rollcall', 'data');
    const unsubscribe = onSnapshot(
      docRef,
      { includeMetadataChanges: true },
      (snap) => {
        setSyncStatus({
          fromCache: snap.metadata.fromCache,
          hasPendingWrites: snap.metadata.hasPendingWrites,
        });
        setConnectionError(false);

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
          setTimeLogs(data.timeLogs || {});

          if (!closedStaleShiftsRef.current) {
            closedStaleShiftsRef.current = true;
            closeStaleShifts().catch((err) => console.error('Failed to close stale shifts:', err));
          }
        } else {
          setEmployees([]);
          setAttendance({});
          setEdits({});
          setHistory([]);
          setNotes({});
          setTimeLogs({});
        }
        setLoading(false);
      },
      (err) => {
        console.error('Failed to listen to data:', err);
        setConnectionError(true);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [setSyncStatus]);

  // ---------- UI helpers ----------
  useEffect(() => {
    const handleClick = (e) => {
      if (popupRef.current && popupRef.current.contains(e.target)) return;
      setPopup(null);
      setPopupNote('');
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

  // ---------- Core attendance functions ----------
  const markAttendance = async (employeeId, day, status, noteText = '') => {
    const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const currentEditVal = edits[`${employeeId}-${dateKey}`];
    const currentCount = typeof currentEditVal === 'number' ? currentEditVal : currentEditVal ? 1 : 0;
    const newCount = currentCount + 1;
    const trimmedNote = noteText.trim();
    const employee = employees.find((emp) => emp.id === employeeId);
    const statusLabel = status === 'present' ? 'Present' : status === 'absent' ? 'Absent' : status === 'late' ? 'Late' : status === 'early' ? 'Early' : 'Off Duty';
    const historyEntry = {
      id: Date.now(),
      employeeId,
      employeeName: employee?.name || 'Unknown',
      day,
      date: dateKey,
      status: statusLabel,
      note: trimmedNote || '',
      editor: currentUser.fullName,
      editedAt: new Date().toISOString(),
    };

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
    setPopup(null);
    setPopupNote('');

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
    const historyEntry = {
      id: Date.now(),
      employeeId,
      employeeName: employee?.name || 'Unknown',
      day,
      date: dateKey,
      status: 'Cleared',
      note: '',
      editor: currentUser.fullName,
      editedAt: new Date().toISOString(),
    };

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
    setTimeLogs((prev) => { const updated = { ...prev }; delete updated[`${employeeId}-${dateKey}`]; return updated; });
    setHistory((prev) => [historyEntry, ...prev]);
    setPopup(null);
    setPopupNote('');

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

  // ---------- Status helpers ----------
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

  const getTimeLog = (employeeId, day) => {
    const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return timeLogs[`${employeeId}-${dateKey}`];
  };

  const getTotalWorkedDays = (employeeId) => {
    const empAttendance = attendance[employeeId] || {};
    const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-`;
    return Object.keys(empAttendance).filter((key) => key.startsWith(monthPrefix) && (empAttendance[key] === 'present' || empAttendance[key] === 'late' || empAttendance[key] === 'early')).length;
  };

  // ---------- Employee management ----------
  const addEmployee = async () => {
    const name = newEmployeeName.trim();
    if (name === '') return;
    const isDuplicate = employees.some((emp) => emp.name.toLowerCase() === name.toLowerCase() && !emp.isDeleted);
    if (isDuplicate) { setAddError('This employee already exists!'); setTimeout(() => setAddError(''), 3000); return; }
    setAddError('');
    const newEmployee = { id: Date.now().toString(), name, isDeleted: false };
    const updatedEmployees = [...employees, newEmployee];
    setEmployees(updatedEmployees);
    setNewEmployeeName('');
    try {
      const docRef = doc(db, 'rollcall', 'data');
      await updateDoc(docRef, { employees: updatedEmployees });
    } catch (err) { console.error('Failed to save new employee:', err); }
  };

  const softDeleteEmployee = async (id) => {
    if (!isAdmin) return;
    const updatedEmployees = employees.map((emp) =>
      emp.id === id ? { ...emp, isDeleted: true } : emp
    );
    setEmployees(updatedEmployees);
    try {
      const docRef = doc(db, 'rollcall', 'data');
      await updateDoc(docRef, { employees: updatedEmployees });
    } catch (err) { console.error('Failed to soft-delete employee:', err); }
  };

  const restoreEmployee = async (id) => {
    if (!isAdmin) return;
    const updatedEmployees = employees.map((emp) =>
      emp.id === id ? { ...emp, isDeleted: false } : emp
    );
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
      await updateDoc(docRef, {
        employees: updatedEmployees,
        [`attendance.${id}`]: deleteField(),
      });
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
    const isDuplicate = employees.some(
      (emp) => emp.id !== editEmployeeId && emp.name.toLowerCase() === newName.toLowerCase() && !emp.isDeleted
    );
    if (isDuplicate) { alert('An employee with this name already exists!'); return; }
    const updatedEmployees = employees.map((emp) =>
      emp.id === editEmployeeId ? { ...emp, name: newName } : emp
    );
    setEmployees(updatedEmployees);
    setEditEmployeeId(null);
    setEditEmployeeName('');
    try {
      const docRef = doc(db, 'rollcall', 'data');
      await updateDoc(docRef, { employees: updatedEmployees });
    } catch (err) { console.error('Failed to save employee rename:', err); }
  };

  // ---------- Navigation ----------
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((prev) => prev - 1);
    } else setCurrentMonth((prev) => prev - 1);
  };
  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((prev) => prev + 1);
    } else setCurrentMonth((prev) => prev + 1);
  };

  // ---------- Popups ----------
  const openPopup = (e, employeeId, day) => {
    e.stopPropagation();
    const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setPopupNote(getNote(employeeId, day));
    const rect = e.currentTarget.getBoundingClientRect();
    setPopup({ employeeId, day, x: rect.left + window.scrollX, y: rect.bottom + window.scrollY });
  };

  const handleClearConfirm = (employeeId, day) => {
    const employee = employees.find((emp) => emp.id === employeeId);
    setPopup(null);
    setConfirmModal({
      message: `Clear the attendance mark for ${employee?.name || 'this employee'} on day ${day}? This cannot be undone.`,
      onConfirm: () => {
        clearAttendance(employeeId, day);
        setConfirmModal(null);
      },
    });
  };

  const handleEmployeeClick = (e, emp) => {
    e.stopPropagation();
    if (isAdmin) {
      const rect = e.currentTarget.getBoundingClientRect();
      setContextMenu({ employee: emp, x: rect.left + window.scrollX, y: rect.bottom + window.scrollY });
    } else setSelectedEmployee(emp);
  };

  // ---------- Sorting ----------
  const getSortedEmployees = () => {
    const filtered = employees.filter((emp) => (showDeleted ? emp.isDeleted : !emp.isDeleted));
    return [...filtered].sort((a, b) =>
      sortOrder === 'asc'
        ? a.name.toLowerCase().localeCompare(b.name.toLowerCase())
        : b.name.toLowerCase().localeCompare(a.name.toLowerCase())
    );
  };
  const toggleSort = () => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));

  // ---------- Backup / Restore (exposed via ref) ----------
  const backupData = () => {
    const data = { employees, attendance, edits, history, notes, timeLogs };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mtworld-backup-${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const restoreData = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setConfirmModal({
      message:
        'This will merge the backup into the current cloud data. A safety copy of the current cloud data is saved automatically first, so nothing is ever permanently lost. Continue?',
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
            } catch (snapshotErr) {
              console.error('Failed to snapshot data before restore:', snapshotErr);
            }

            if (data.employees) setEmployees(data.employees.map((emp) => ({ ...emp, isDeleted: emp.isDeleted ?? false })));
            if (data.attendance) setAttendance(data.attendance);
            if (data.edits) setEdits(data.edits || {});
            if (data.history) setHistory(data.history || []);
            if (data.notes) setNotes(data.notes || {});
            if (data.timeLogs) setTimeLogs(data.timeLogs || {});

            try {
              await setDoc(
                docRef,
                {
                  employees: data.employees || [],
                  attendance: data.attendance || {},
                  edits: data.edits || {},
                  history: data.history || [],
                  notes: data.notes || {},
                  timeLogs: data.timeLogs || {},
                },
                { merge: true }
              );
              alert('Backup restored successfully! (A safety copy of the previous cloud data was saved automatically.)');
            } catch (err) {
              alert('Restored locally but failed to save to cloud.');
            }
          } catch (err) {
            alert('Invalid backup file.');
          }
        };
        reader.readAsText(file);
        e.target.value = '';
      },
    });
  };

  // ---------- Undo ----------
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
      const historyEntry = {
        id: Date.now(),
        employeeId,
        employeeName: employee?.name || 'Unknown',
        day,
        date: dateKey,
        status: 'Undo',
        note: '',
        editor: currentUser.fullName,
        editedAt: new Date().toISOString(),
      };
      setHistory((prev) => [historyEntry, ...prev]);
      const docRef = doc(db, 'rollcall', 'data');
      await updateDoc(docRef, {
        [`attendance.${employeeId}.${dateKey}`]: previousStatus,
        [`edits.${employeeId}-${dateKey}`]: previousEditCount,
        history: arrayUnion(historyEntry),
      });
      setLastEdit(null);
    } else {
      clearAttendance(employeeId, day);
      setLastEdit(null);
    }
  };

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    backupData,
    restoreData,
    handleUndo,
  }));

  // ---------- Stats & Reports ----------
  const calculateStats = () => {
    let presentCount = 0,
      absentCount = 0,
      lateCount = 0,
      earlyCount = 0,
      offCount = 0,
      weekendCount = 0,
      holidayCount = 0,
      blankCount = 0;
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
      { name: 'Present', value: presentCount, color: '#10B981' },
      { name: 'Late', value: lateCount, color: '#3B82F6' },
      { name: 'Early Leave', value: earlyCount, color: '#8B5CF6' },
      { name: 'Absent', value: absentCount, color: '#EF4444' },
      { name: 'Off Duty', value: offCount, color: '#6B7280' },
      { name: 'Weekend', value: weekendCount, color: '#4B5563' },
      { name: 'Holiday', value: holidayCount, color: '#FBBF24' },
      { name: 'Unmarked', value: blankCount, color: '#374151' },
    ].filter((d) => d.value > 0);
  };

  const getEmployeeReport = (empId) => {
    const months = [];
    for (let m = 0; m < 12; m++) {
      const daysInM = new Date(currentYear, m + 1, 0).getDate();
      let present = 0,
        absent = 0,
        late = 0,
        early = 0,
        off = 0,
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
        else if (attendance[empId]?.[dateKey] === 'off') off++;
        else if (attendance[empId]?.[dateKey] === 'absent') absent++;
        else unmarked++;
      }
      months.push({
        month: monthNames[m],
        Present: present,
        Late: late,
        Early: early,
        Absent: absent,
        OffDuty: off,
        Weekend: weekend,
        Holiday: holiday,
        Unmarked: unmarked,
      });
    }
    return months;
  };

  // ---------- Loading state ----------
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-10 h-10 border-[3px] border-main border-t-accent rounded-full animate-spin" />
        <p className="text-muted text-sm uppercase tracking-[0.2em]">Loading register…</p>
      </div>
    );
  }

  // ========== MAIN RENDER ==========
  return (
    <div className="w-full">
      <div className="bg-card rounded-2xl p-5 border border-main shadow-theme">
        {/* -------- Controls (month navigation, add employee, sort) -------- */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrevMonth}
              className="p-2 rounded-lg bg-input hover:bg-accent-light text-muted hover:text-main transition border border-main"
            >
              ‹
            </button>
            <span className="text-lg font-semibold text-main min-w-[160px] text-center">
              {monthNames[currentMonth]} {currentYear}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-2 rounded-lg bg-input hover:bg-accent-light text-muted hover:text-main transition border border-main"
            >
              ›
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={toggleSort}
              className="bg-input text-main py-1.5 px-3 rounded-md text-sm font-medium hover:bg-accent-light transition border border-main"
            >
              {sortOrder === 'asc' ? '↓ A‑Z' : '↑ Z‑A'}
            </button>
            {isAdmin && (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Employee name"
                  value={newEmployeeName}
                  onChange={(e) => {
                    setNewEmployeeName(e.target.value);
                    setAddError('');
                  }}
                  onKeyPress={(e) => e.key === 'Enter' && addEmployee()}
                  className="py-1.5 px-3 bg-input border border-main rounded-md text-sm text-main placeholder-muted outline-none focus:border-accent"
                />
                <button
                  onClick={addEmployee}
                  className="bg-accent hover:bg-accent-hover text-white py-1.5 px-4 rounded-md text-sm font-medium transition"
                >
                  + Add
                </button>
              </div>
            )}
          </div>
        </div>
        {addError && <p className="text-accent-red text-xs mb-3">{addError}</p>}

        {/* -------- Table -------- */}
        {employees.length === 0 ? (
          <div className="text-center py-10 text-muted">
            {connectionError ? (
              <div>
                <p className="text-accent-red font-medium">Unable to connect to the database.</p>
                <p className="text-sm mt-2">Please check your internet connection and try again.</p>
              </div>
            ) : (
              <p>No employees added yet.</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-main">
                  <th className="sticky left-0 z-10 bg-card text-left py-2 px-2 text-xs font-medium text-muted uppercase tracking-wider min-w-[30px]">
                    #
                  </th>
                  <th className="sticky left-[30px] z-10 bg-card text-left py-2 px-3 text-xs font-medium text-muted uppercase tracking-wider min-w-[160px]">
                    Employee
                  </th>
                  {daysArray.map((day) => {
                    const date = new Date(currentYear, currentMonth, day);
                    const dayName = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][date.getDay()];
                    const isWeekendDay = date.getDay() === 0 || date.getDay() === 6;
                    return (
                      <th key={day} className="py-2 px-0.5 text-center">
                        <div className={`text-[10px] font-medium ${isWeekendDay ? 'text-muted/60' : 'text-muted'}`}>
                          {dayName}
                        </div>
                        <div className={`text-sm font-semibold ${isWeekendDay ? 'text-muted/60' : 'text-main'}`}>
                          {day}
                        </div>
                      </th>
                    );
                  })}
                  <th className="py-2 px-2 text-center text-xs font-medium text-muted uppercase tracking-wider">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {getSortedEmployees().map((emp, index) => {
                  const total = getTotalWorkedDays(emp.id);
                  const isHighlighted = highlightedEmployee === emp.id || (popup && popup.employeeId === emp.id);

                  if (showDeleted) {
                    return (
                      <tr key={emp.id} className="border-b border-main text-muted">
                        <td className="sticky left-0 bg-card py-2 px-2 text-sm">{index + 1}</td>
                        <td className="sticky left-[30px] bg-card py-2 px-3 text-sm line-through">{emp.name}</td>
                        {daysArray.map((day) => (
                          <td key={day} className="py-2 px-0.5 text-center text-sm">—</td>
                        ))}
                        <td className="py-2 px-2 text-center text-sm">—</td>
                      </tr>
                    );
                  }

                  return (
                    <tr
                      key={emp.id}
                      className={`border-b border-main transition-colors ${
                        isHighlighted ? 'bg-accent-light' : 'hover:bg-accent-light'
                      }`}
                      onMouseEnter={() => setHighlightedEmployee(emp.id)}
                      onMouseLeave={() => {
                        setHighlightedEmployee(null);
                        setHighlightedDay(null);
                        setHighlightedColumn(null);
                      }}
                    >
                      <td className="sticky left-0 bg-card py-2 px-2 text-sm text-muted">{index + 1}</td>
                      <td className="sticky left-[30px] bg-card py-2 px-3 text-sm font-medium text-main">
                        {editEmployeeId === emp.id ? (
                          <input
                            type="text"
                            value={editEmployeeName}
                            onChange={(e) => setEditEmployeeName(e.target.value)}
                            onBlur={saveEditEmployee}
                            onKeyPress={(e) => e.key === 'Enter' && saveEditEmployee()}
                            className="w-full py-1 px-2 bg-input border border-accent rounded text-sm text-main outline-none"
                            autoFocus
                          />
                        ) : (
                          <span
                            className="cursor-pointer hover:text-accent transition"
                            onClick={(e) => handleEmployeeClick(e, emp)}
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
                        const off = isOff(emp.id, day);
                        const edited = isEdited(emp.id, day);
                        const weekend = isWeekend(day);
                        const holiday = isHoliday(day);
                        const note = getNote(emp.id, day);
                        const editors = getEditors(emp.id, day);
                        const showEditors = (present || absent || late || early || off) && editors.length > 0;
                        const isColHighlighted = highlightedColumn === day || (popup && popup.day === day);
                        const timeLog = getTimeLog(emp.id, day);
                        const isCurrentlyWorking = timeLog && timeLog.clockIn && !timeLog.clockOut;
                        const hasClockedOut = timeLog && timeLog.clockIn && timeLog.clockOut;

                        // ---- CLASSIC STYLING ----
                        let bgColor = '';
                        let textColor = '';
                        let content = '';

                        if (present) {
                          bgColor = 'bg-[var(--status-green-bg)]';
                          textColor = 'text-[var(--status-green-text)] font-bold';
                          content = '✓';
                        } else if (absent) {
                          bgColor = 'bg-[var(--status-red-bg)]';
                          textColor = 'text-[var(--status-red-text)] font-bold';
                          content = '✗';
                        } else if (late) {
                          bgColor = 'bg-[var(--status-blue-bg)]';
                          textColor = 'text-[var(--status-blue-text)] font-bold';
                          content = '⏰';
                        } else if (early) {
                          bgColor = 'bg-[var(--status-purple-bg)]';
                          textColor = 'text-[var(--status-purple-text)] font-bold';
                          content = '🚪';
                        } else if (off) {
                          bgColor = 'bg-[var(--status-slate-bg)]';
                          textColor = 'text-[var(--status-slate-text)] font-bold';
                          content = 'OFF';
                        }
                        if (weekend) {
                          bgColor = 'bg-[var(--status-weekend-bg)]';
                        }
                        // Holiday highlight – only if no status mark
                        if (holiday && !present && !absent && !late && !early && !off) {
                          bgColor = 'bg-[var(--status-holiday-bg)]';
                        }

                        // ---- Tooltip ----
                        let tooltip = `${emp.name} – ${day} ${monthNames[currentMonth]} ${currentYear}`;
                        if (weekend) tooltip += ' (Weekend)';
                        if (holiday) {
                          const holidayName = getSAHolidays(currentYear).find(
                            (h) =>
                              h.date ===
                              `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                          )?.name;
                          tooltip += ` (${holidayName})`;
                        }
                        if (late) tooltip += ' (Late)';
                        if (early) tooltip += ' (Early Leave)';
                        if (note) tooltip += ` – 📝 ${note}`;
                        if (showEditors) tooltip += ` (edited by ${editors.join(', ')})`;
                        if (isCurrentlyWorking) tooltip += ` – 🟢 Still on shift (clocked in ${new Date(timeLog.clockIn).toLocaleTimeString()})`;
                        if (hasClockedOut) {
                          tooltip += ` – ✓ Clocked out ${new Date(timeLog.clockOut).toLocaleTimeString()}`;
                          if (timeLog.autoClockOut) tooltip += ' (auto — forgot to clock out)';
                        }

                        return (
                          <td
                            key={day}
                            className={`w-9 h-9 text-center cursor-pointer text-sm border-b border-r border-main transition relative ${bgColor} ${textColor} ${!weekend ? 'hover:bg-accent-light' : ''} ${
                              isColHighlighted ? 'bg-accent-light' : ''
                            }`}
                            onClick={(e) => openPopup(e, emp.id, day)}
                            onMouseEnter={() => {
                              setHighlightedColumn(day);
                              setHighlightedDay(day);
                            }}
                            onMouseLeave={() => {
                              setHighlightedColumn(null);
                              setHighlightedDay(null);
                            }}
                            title={tooltip}
                          >
                            {content}
                            {note && (
                              <span className="absolute bottom-0 left-0.5 text-[0.5rem] text-accent" title={note}>
                                📝
                              </span>
                            )}
                            {edited && (
                              <span className="absolute top-0 right-0.5 text-[0.45rem] text-yellow-400" title="Edited">
                                ✎
                              </span>
                            )}
                            {isCurrentlyWorking && (
                              <span
                                className="absolute top-0.5 left-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"
                                title={`Still on shift — clocked in ${new Date(timeLog.clockIn).toLocaleTimeString()}`}
                              />
                            )}
                            {hasClockedOut && (
                              <span
                                className="absolute top-0 left-0.5 text-[0.5rem] text-emerald-400"
                                title={`Clocked out ${new Date(timeLog.clockOut).toLocaleTimeString()}${
                                  timeLog.autoClockOut ? ' (auto — forgot to clock out)' : ''
                                }`}
                              >
                                {timeLog.autoClockOut ? '⏱' : '✓'}
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td className="py-2 px-2 text-center font-mono font-bold text-emerald-400">{total}</td>
                    </tr>
                  );
                })}

                {!showDeleted && (
                  // "Present per day" row – horizontal blue background
                  <tr className="border-t border-main bg-accent-soft">
                    <td className="sticky left-0 bg-accent-soft py-2 px-2 text-xs text-muted font-medium" colSpan={2}>
                      Present per day
                    </td>
                    {daysArray.map((day) => {
                      let count = 0;
                      for (const emp of employees) {
                        if (!emp.isDeleted && (isPresent(emp.id, day) || isLate(emp.id, day) || isEarly(emp.id, day)))
                          count++;
                      }
                      return (
                        <td key={day} className="py-2 px-0.5 text-center text-sm font-mono text-emerald-400">
                          {count > 0 ? count : ''}
                        </td>
                      );
                    })}
                    <td className="py-2 px-2 text-center font-mono font-bold text-emerald-400">
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

        {/* -------- Footer -------- */}
        <footer className="text-center mt-5 text-muted text-sm border-t border-main pt-4">
          <p>Click a blank cell to mark attendance. Options: Present, Absent, Late (Blue), or Early Leave (with optional note). Locked after two edits.</p>
          <p className="mt-1 text-xs">🟢 pulsing = still clocked in &nbsp;·&nbsp; ✓ = clocked out &nbsp;·&nbsp; ⏱ = auto clocked out at midnight (forgot to end shift)</p>
          {isAdmin && (
            <p className="text-accent italic mt-1 text-xs">
              Admin: Click employee name for options. Use 💾 Backup to save data.
            </p>
          )}
          {(isUser || isViewer) && (
            <p className="text-muted italic mt-1 text-xs">Limited access. Fingerprint scanning enabled.</p>
          )}
        </footer>
      </div>

      {/* ---------- Modals ---------- */}
      {showHistory && <HistoryModal history={history} onClose={() => setShowHistory(false)} />}
      {showPasswordModal && (
        <PasswordChangeModal
          currentUser={currentUser}
          onClose={() => setShowPasswordModal(false)}
          onPasswordChanged={() => {}}
        />
      )}
      {contextMenu && isAdmin && (
  <ContextMenu
    contextMenu={contextMenu}
    contextMenuRef={contextMenuRef}
    onViewReport={() => {
      setSelectedEmployee(contextMenu.employee);
      setContextMenu(null);
    }}
    onViewProfile={() => {
      onViewProfile(contextMenu.employee.id);
      setContextMenu(null);
    }}
    onRename={() => startEditEmployee(contextMenu.employee)}
    onEnrollFingerprint={() => {
      setEnrollEmployee(contextMenu.employee);
      setContextMenu(null);
    }}
    onDelete={() => {
      setContextMenu(null);
      setConfirmModal({
        message: `Move "${contextMenu.employee.name}" to Trash? They can be restored later.`,
        onConfirm: () => {
          softDeleteEmployee(contextMenu.employee.id);
          setConfirmModal(null);
        },
      });
    }}
  />
)}
      {selectedEmployee &&
        (() => {
          const reportData = getEmployeeReport(selectedEmployee.id);
          if (!reportData) return null;
          return (
            <EmployeeReportModal
              employee={selectedEmployee}
              report={reportData}
              year={currentYear}
              onClose={() => setSelectedEmployee(null)}
            />
          );
        })()}
      {showEmailModal && (
        <EmailReportModal
          employees={employees.filter((emp) => !emp.isDeleted)}
          attendance={attendance}
          currentYear={currentYear}
          currentMonth={currentMonth}
          onClose={() => setShowEmailModal(false)}
        />
      )}
      {showStatsPage && (
        <StatsPage
          stats={calculateStats()}
          currentMonth={currentMonth}
          currentYear={currentYear}
          onClose={() => setShowStatsPage(false)}
        />
      )}
      {confirmModal && (
        <ConfirmModal
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
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
        isUser={isUser}
        onConfirmClear={handleClearConfirm}
        isLocked={popup
          ? (() => {
              const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(popup.day).padStart(2, '0')}`;
              const currentEdits = edits[`${popup.employeeId}-${dateKey}`];
              const editCount = typeof currentEdits === 'number' ? currentEdits : 0;
              return editCount >= 2;
            })()
          : false}
      />
    </div>
  );
});

export default AttendanceRegister;