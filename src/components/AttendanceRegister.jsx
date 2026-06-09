import React, { useState, useEffect, useRef } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
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

function AttendanceRegister({ currentUser, onLogout, onPasswordChanged }) {
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [edits, setEdits] = useState({});
  const [history, setHistory] = useState([]);
  const [notes, setNotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState('asc');
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

  const popupRef = useRef(null);
  const contextMenuRef = useRef(null);

  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const isAdmin = currentUser.role === 'admin';

  // Fetch data from Firestore
  useEffect(() => {
    const fetchData = async () => {
      try {
        const docRef = doc(db, 'rollcall', 'data');
        const snap = await getDoc(docRef);
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
          setEmployees([{ id: '1', name: 'John Doe' }, { id: '2', name: 'Jane Smith' }]);
        }
      } catch (err) { console.error('Failed to load data:', err); }
      finally { setLoading(false); }
    };
    fetchData();
  }, []);

  // Save data to Firestore
useEffect(() => {
  if (loading) return;
  
  // ONLY save if there's actual data
  if (!employees || employees.length === 0) {
    console.warn('⚠️ Skipped save: No employees data');
    return;
  }
  
  const saveData = async () => {
    try {
      const docRef = doc(db, 'rollcall', 'data');
      await setDoc(docRef, { 
        employees, 
        attendance, 
        edits, 
        history, 
        notes,
        _lastSaved: new Date().toISOString(),
        _savedBy: currentUser?.fullName || 'Unknown'
      }, { merge: true });
      console.log('✅ Data saved by:', currentUser?.fullName);
    } catch (err) { 
      console.error('❌ Failed to save data:', err); 
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

  const markAttendance = (employeeId, day, status, noteText = '') => {
    const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setEdits((prev) => { const current = prev[`${employeeId}-${dateKey}`]; const count = typeof current === 'number' ? current : current ? 1 : 0; return { ...prev, [`${employeeId}-${dateKey}`]: count + 1 }; });
    setAttendance((prev) => { const updated = { ...prev }; const empAttendance = { ...(updated[employeeId] || {}) }; empAttendance[dateKey] = status; if (Object.keys(empAttendance).length === 0) delete updated[employeeId]; else updated[employeeId] = empAttendance; return updated; });
    if (noteText.trim()) setNotes((prev) => ({ ...prev, [`${employeeId}-${dateKey}`]: noteText.trim() }));
    const employee = employees.find((emp) => emp.id === employeeId);
    const statusLabel = status === 'present' ? 'Present' : status === 'absent' ? 'Absent' : status === 'late' ? 'Late' : status === 'early' ? 'Early' : 'Off Duty';
    setHistory((prev) => [{ id: Date.now(), employeeId, employeeName: employee?.name || 'Unknown', day, date: dateKey, status: statusLabel, note: noteText.trim() || '', editor: currentUser.fullName, editedAt: new Date().toISOString() }, ...prev]);
    setPopup(null);
    setPopupNote('');
  };

  const clearAttendance = async (employeeId, day) => {
    const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    let updatedAttendance = { ...attendance };
    if (updatedAttendance[employeeId]) {
      delete updatedAttendance[employeeId][dateKey];
      if (Object.keys(updatedAttendance[employeeId]).length === 0) delete updatedAttendance[employeeId];
    }
    let updatedNotes = { ...notes };
    delete updatedNotes[`${employeeId}-${dateKey}`];
    let updatedEdits = { ...edits };
    delete updatedEdits[`${employeeId}-${dateKey}`];
    setAttendance(updatedAttendance);
    setNotes(updatedNotes);
    setEdits(updatedEdits);
    const employee = employees.find((emp) => emp.id === employeeId);
    const updatedHistory = [{ id: Date.now(), employeeId, employeeName: employee?.name || 'Unknown', day, date: dateKey, status: 'Cleared', note: '', editor: currentUser.fullName, editedAt: new Date().toISOString() }, ...history];
    setHistory(updatedHistory);
    try {
      const docRef = doc(db, 'rollcall', 'data');
      await setDoc(docRef, { employees, attendance: updatedAttendance, edits: updatedEdits, history: updatedHistory, notes: updatedNotes });
    } catch (err) { console.error('Failed to save after clear:', err); }
    setPopup(null);
    setPopupNote('');
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

  const addEmployee = () => {
    const name = newEmployeeName.trim();
    if (name === '') return;
    const isDuplicate = employees.some((emp) => emp.name.toLowerCase() === name.toLowerCase());
    if (isDuplicate) { setAddError('This employee already exists!'); setTimeout(() => setAddError(''), 3000); return; }
    setAddError('');
    setEmployees((prev) => [...prev, { id: Date.now().toString(), name }]);
    setNewEmployeeName('');
  };

  const deleteEmployee = (id) => {
    if (!isAdmin) return;
    setEmployees((prev) => prev.filter((emp) => emp.id !== id));
    setAttendance((prev) => { const updated = { ...prev }; delete updated[id]; return updated; });
  };

  const startEditEmployee = (emp) => {
    if (!isAdmin) return;
    setContextMenu(null);
    setEditEmployeeId(emp.id);
    setEditEmployeeName(emp.name);
  };

  const saveEditEmployee = () => {
    if (!isAdmin || editEmployeeName.trim() === '') return;
    const newName = editEmployeeName.trim();
    const isDuplicate = employees.some((emp) => emp.id !== editEmployeeId && emp.name.toLowerCase() === newName.toLowerCase());
    if (isDuplicate) { alert('An employee with this name already exists!'); return; }
    setEmployees((prev) => prev.map((emp) => emp.id === editEmployeeId ? { ...emp, name: newName } : emp));
    setEditEmployeeId(null);
    setEditEmployeeName('');
  };

  const handlePrevMonth = () => { if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear((prev) => prev - 1); } else setCurrentMonth((prev) => prev - 1); };
  const handleNextMonth = () => { if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear((prev) => prev + 1); } else setCurrentMonth((prev) => prev + 1); };

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
    onConfirm: () => {
      clearAttendance(employeeId, day);
      setConfirmModal(null);
    }
  });
};

  const handleEmployeeClick = (e, emp) => {
    e.stopPropagation();
    if (isAdmin) { const rect = e.currentTarget.getBoundingClientRect(); setContextMenu({ employee: emp, x: rect.left + window.scrollX, y: rect.bottom + window.scrollY }); }
    else setSelectedEmployee(emp);
  };

  const getSortedEmployees = () => [...employees].sort((a, b) => sortOrder === 'asc' ? a.name.toLowerCase().localeCompare(b.name.toLowerCase()) : b.name.toLowerCase().localeCompare(a.name.toLowerCase()));
  const toggleSort = () => setSortOrder((prev) => prev === 'asc' ? 'desc' : 'asc');

  const backupData = () => {
    const data = { employees, attendance, edits, history, notes };
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
    message: 'This will replace ALL current data with the backup. Are you sure?',
    onConfirm: () => {
      setConfirmModal(null);
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = JSON.parse(event.target.result);
          if (data.employees) setEmployees(data.employees);
          if (data.attendance) setAttendance(data.attendance);
          if (data.edits) setEdits(data.edits || {});
          if (data.history) setHistory(data.history || []);
          if (data.notes) setNotes(data.notes || {});
          try {
            const docRef = doc(db, 'rollcall', 'data');
            await setDoc(docRef, { employees: data.employees || [], attendance: data.attendance || {}, edits: data.edits || {}, history: data.history || [], notes: data.notes || {} });
            alert('Backup restored successfully!');
          } catch (err) { alert('Restored locally but failed to save to cloud.'); }
        } catch (err) { alert('Invalid backup file.'); }
      };
      reader.readAsText(file);
      e.target.value = '';
    }
  });
};

  const calculateStats = () => {
  let presentCount = 0, absentCount = 0, lateCount = 0, earlyCount = 0, offCount = 0, weekendCount = 0, holidayCount = 0, blankCount = 0;
  for (const emp of employees) {
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
    <div className="flex justify-center items-center min-h-screen text-2xl text-indigo-900">Loading data…</div>
  );

  return (
    <div className="max-w-[1920px] mx-auto p-5 max-sm:p-2.5">
      {/* ========== HEADER ========== */}
      <header className="flex flex-col bg-[linear-gradient(rgba(26,35,126,0.7),rgba(13,71,161,0.2)),url('/background1.png')] bg-left bg-no-repeat bg-contain text-white pt-[150px] pb-[10px] px-6 rounded-xl mb-6 shadow-lg max-sm:py-4 max-sm:px-2">
        <div className="flex justify-between items-start w-full max-sm:flex-col max-sm:items-center max-sm:gap-2.5">
          <div className="flex items-center gap-3 flex-wrap max-sm:w-full max-sm:justify-between">
            <span className="text-[0.95rem] font-bold text-black [text-stroke:0.5px_white] [-webkit-text-stroke:0.5px_white] cursor-pointer hover:opacity-80 transition-opacity whitespace-nowrap" onClick={() => setShowPasswordModal(true)} title="Click to change password">
              Logged in as: {currentUser.fullName} {isAdmin && '(Admin)'}
            </span>
            <button onClick={onLogout} className="bg-white/15 border border-white/30 text-white py-1.5 px-3.5 rounded-lg font-medium text-[0.9rem] transition hover:bg-white/25 h-9">Logout</button>
          </div>
        </div>
      </header>

      {/* ========== MAIN CARD ========== */}
      <div className="bg-white rounded-xl p-5 shadow-md">
        {/* ========== CONTROLS ========== */}
        <div className="flex justify-between items-center flex-wrap gap-4 mb-5 pb-5 border-b border-slate-200">
          <div className="flex items-center gap-4">
            <button onClick={handlePrevMonth} className="bg-slate-800 text-white rounded-full w-9 h-9 text-lg flex items-center justify-center hover:bg-slate-700 transition">&lsaquo;</button>
            <span className="font-semibold text-lg text-slate-800 min-w-[150px] text-center">{monthNames[currentMonth]} {currentYear}</span>
            <button onClick={handleNextMonth} className="bg-slate-800 text-white rounded-full w-9 h-9 text-lg flex items-center justify-center hover:bg-slate-700 transition">&rsaquo;</button>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <button onClick={() => setShowHistory(true)} className="bg-slate-500 text-white py-2 px-3.5 rounded-lg font-medium text-sm hover:bg-slate-600 transition">View History</button>
            <button onClick={() => setShowStatsPage(true)} className="bg-purple-500 text-white py-2 px-3.5 rounded-lg font-medium text-sm hover:bg-purple-600 transition">📊 Stats</button>
            <button onClick={() => setShowEmailModal(true)} className="bg-emerald-600 text-white py-2 px-3.5 rounded-lg font-medium text-sm hover:bg-emerald-700 transition">📧 Email</button>
            <button onClick={toggleSort} className="bg-slate-500 text-white py-2 px-3.5 rounded-lg font-medium text-sm hover:bg-slate-600 transition min-w-[70px]">{sortOrder === 'asc' ? '↓ A‑Z' : '↑ Z‑A'}</button>
            {isAdmin && (
              <button onClick={backupData} className="bg-amber-500 text-white py-2 px-3.5 rounded-lg font-medium text-sm hover:bg-amber-600 transition" title="Download backup">💾 Backup</button>
            )}
            {isAdmin && (
              <label className="bg-cyan-600 text-white py-2 px-3.5 rounded-lg font-medium text-sm hover:bg-cyan-700 transition cursor-pointer" title="Restore from backup">
                📥 Restore
                <input type="file" accept=".json" onChange={restoreData} className="hidden" />
              </label>
            )}
            <div className="flex gap-2">
              <input type="text" placeholder="Employee name" value={newEmployeeName} onChange={(e) => { setNewEmployeeName(e.target.value); setAddError(''); }} onKeyPress={(e) => e.key === 'Enter' && addEmployee()} className="py-2 px-3 border border-slate-300 rounded-lg text-sm text-slate-800 bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition" />
              <button onClick={addEmployee} className="bg-green-600 text-white py-2 px-4 rounded-lg font-medium text-sm hover:bg-green-700 transition">+ Add</button>
            </div>
          </div>
        </div>
        {addError && <p className="text-red-600 text-xs mb-3 font-medium">{addError}</p>}

        {/* ========== TABLE ========== */}
        {employees.length === 0 ? (
          <div className="text-center py-10 text-slate-400"><p>No employees added yet.</p></div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#e2e8f0]">
            <table className="w-full border-collapse min-w-[700px]">
              <thead>
                <tr>
                  <th className={`sticky left-0 z-[3] w-[30px] min-w-[30px] font-semibold py-1.5 px-1 text-center text-[0.65rem] border-b border-r border-[#e2e8f0] transition-colors duration-150 ${highlightedEmployee || popup ? 'bg-blue-200 text-blue-800' : 'bg-[#f1f5f9] text-slate-500'}`}>#</th>
                  <th className={`sticky left-[30px] z-[2] font-semibold py-1.5 px-3 text-left text-[0.65rem] border-b border-r-2 border-[#cbd5e1] transition-colors duration-150 ${highlightedEmployee || popup ? 'bg-blue-200 text-blue-800' : 'bg-[#f1f5f9] text-slate-500'}`}>Name of Employees</th>
                  {daysArray.map((day) => {
                    const date = new Date(currentYear, currentMonth, day);
                    const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
                    const dayName = dayNames[date.getDay()];
                    const isColHighlighted = highlightedColumn === day || (popup && popup.day === day);
                    return (
                      <th key={day} className={`font-semibold py-1.5 px-0.5 text-center text-[0.65rem] border-b border-r border-[#e2e8f0] transition-colors duration-150 ${isColHighlighted ? 'bg-blue-300 text-blue-900' : 'bg-[#f1f5f9] text-slate-500'}`}>
                        <div className={`text-[0.55rem] leading-tight ${isColHighlighted ? 'text-blue-700' : 'text-slate-400'}`}>{dayName}</div>
                        <div className={isColHighlighted ? 'text-blue-900' : 'text-slate-600'}>{day}</div>
                      </th>
                    );
                  })}
                  <th className={`font-semibold py-1.5 px-2 text-center text-[0.65rem] border-b border-[#e2e8f0] transition-colors duration-150 ${highlightedEmployee || popup ? 'bg-blue-200 text-blue-800' : 'bg-[#f1f5f9] text-slate-500'}`}>Total</th>
                </tr>
              </thead>
              <tbody>
                {getSortedEmployees().map((emp, index) => {
                  const total = getTotalWorkedDays(emp.id);
                  const isHighlighted = highlightedEmployee === emp.id || (popup && popup.employeeId === emp.id);
                  
                  return (
                    <tr 
                      key={emp.id}
                      className={`transition-colors duration-150 ${isHighlighted ? 'bg-blue-50' : ''}`}
                      onMouseEnter={() => setHighlightedEmployee(emp.id)}
                      onMouseLeave={() => { setHighlightedEmployee(null); setHighlightedDay(null); setHighlightedColumn(null); }}
                    >
                      <td className={`sticky left-0 z-[3] text-center text-xs text-slate-600 font-medium py-2 px-1 w-[30px] border-b border-r border-[#e2e8f0] transition-colors duration-150 ${isHighlighted ? 'bg-blue-100' : 'bg-[#f8fafc]'}`}>{index + 1}</td>
                      <td className={`sticky left-[30px] z-[2] py-2 px-3 font-medium border-b border-r-2 border-[#cbd5e1] text-slate-800 text-sm transition-colors duration-150 ${isHighlighted ? 'bg-blue-100' : 'bg-white'}`}>
                        {editEmployeeId === emp.id ? (
                          <input type="text" value={editEmployeeName} onChange={(e) => setEditEmployeeName(e.target.value)} onBlur={saveEditEmployee} onKeyPress={(e) => e.key === 'Enter' && saveEditEmployee()} className="w-full py-1 px-2 border-2 border-blue-400 rounded text-sm outline-none text-slate-800" autoFocus />
                        ) : (
                          <span className="whitespace-nowrap cursor-pointer hover:text-blue-600 transition-colors text-slate-800" onClick={(e) => handleEmployeeClick(e, emp)}>{emp.name}</span>
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
                        const showEditors = (present || absent || late || early) && editors.length > 0;
                        const isColHighlighted = highlightedColumn === day || (popup && popup.day === day);

                        let cellBg = 'bg-white';
                        let cellText = 'text-transparent';
                        let content = '';

                        if (present) { cellBg = 'bg-green-100'; cellText = 'text-green-700 font-bold'; content = '✓'; }
                        else if (absent) { cellBg = 'bg-red-100'; cellText = 'text-red-700 font-bold'; content = '✗'; }
                        else if (late) { cellBg = 'bg-yellow-100'; cellText = 'text-yellow-700 font-bold'; content = '⏰'; }
                        else if (early) { cellBg = 'bg-purple-100'; cellText = 'text-purple-700 font-bold'; content = '🚪'; }
                        else if (off) { cellBg = 'bg-slate-200'; cellText = 'text-slate-700 font-bold'; content = 'OFF'; }
                        if (weekend) { cellBg = 'bg-[#cbd5e1]'; cellText = content ? cellText : 'text-[#475569]'; }
                        if (holiday) { cellBg = 'bg-[#fde047]'; cellText = content ? cellText : 'text-[#854d0e] font-medium'; }

                        let tooltip = `${emp.name} – ${day} ${monthNames[currentMonth]} ${currentYear}`;
                        if (weekend) tooltip += ' (Weekend)';
                        if (holiday) { const holidayName = getSAHolidays(currentYear).find(h => h.date === `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`)?.name; tooltip += ` (${holidayName})`; }
                        if (late) tooltip += ' (Late)';
                        if (early) tooltip += ' (Early Leave)';
                        if (note) tooltip += ` – 📝 ${note}`;
                        if (showEditors) tooltip += ` (edited by ${editors.join(', ')})`;

                        return (
                          <td key={day}
                            className={`w-9 h-9 text-center cursor-pointer text-sm border-b border-r border-[#e2e8f0] transition relative ${cellBg} ${cellText} ${!weekend ? 'hover:bg-[#e2e8f0]' : ''} ${isColHighlighted ? (cellBg === 'bg-white' ? 'bg-blue-100' : 'brightness-90 saturate-150 shadow-inner') : ''}`}
                            onClick={(e) => openPopup(e, emp.id, day)}
                            onMouseEnter={() => { setHighlightedColumn(day); setHighlightedDay(day); }}
                            onMouseLeave={() => { setHighlightedColumn(null); setHighlightedDay(null); }}
                            title={tooltip}
                          >
                            {content}
                            {note && <span className="absolute bottom-0 left-0.5 text-[0.5rem]" title={note}>📝</span>}
                            {edited && <span className="absolute top-0 right-0.5 text-[0.45rem] text-orange-600" title="This day has been edited">✎</span>}
                          </td>
                        );
                      })}
                      <td className={`text-center font-bold text-green-700 border-b border-[#e2e8f0] text-sm transition-colors duration-150 ${isHighlighted ? 'bg-green-200' : 'bg-green-50'}`}>{total}</td>
                    </tr>
                  );
                })}

                {/* ========== DAILY PRESENT COUNT ROW ========== */}
                <tr className="bg-[#f8fafc]">
                  <td className="sticky left-0 bg-[#e2e8f0] z-[3] text-center text-[0.65rem] text-slate-600 font-semibold py-1.5 px-1 border-b border-r border-[#e2e8f0]" colSpan={2}>Present per day</td>
                  {daysArray.map((day) => {
                    let count = 0;
                    for (const emp of employees) {
                      if (isPresent(emp.id, day) || isLate(emp.id, day) || isEarly(emp.id, day)) count++;
                    }
                    const isColHighlighted = highlightedColumn === day || (popup && popup.day === day);
                    return (
                      <td key={day} className={`text-center text-[0.7rem] font-bold text-green-700 border-b border-r border-[#e2e8f0] py-1 transition-colors duration-150 ${isColHighlighted ? 'bg-blue-200' : 'bg-[#e2e8f0]'}`}>
                        {count > 0 ? count : ''}
                      </td>
                    );
                  })}
                  <td className="text-center font-bold text-green-700 bg-green-100 border-b border-[#e2e8f0] text-sm py-1">
                    {(() => { let grandTotal = 0; for (const emp of employees) { grandTotal += getTotalWorkedDays(emp.id); } return grandTotal; })()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* ========== FOOTER ========== */}
        <footer className="text-center mt-5 text-slate-500 text-sm">
          <p>Click a blank cell to mark attendance. Options: Present, Absent, Late, or Early Leave (with optional note). Locked after two edits.</p>
          {isAdmin && <p className="text-purple-500 italic mt-1 text-xs">Admin: Click employee name for options. Use 💾 Backup to save data.</p>}
        </footer>
      </div>

            {/* ========== MODALS ========== */}
      {showHistory && <HistoryModal history={history} onClose={() => setShowHistory(false)} />}
      {showPasswordModal && <PasswordChangeModal currentUser={currentUser} onClose={() => setShowPasswordModal(false)} onPasswordChanged={onPasswordChanged} />}
      {contextMenu && isAdmin && (
        <ContextMenu contextMenu={contextMenu} contextMenuRef={contextMenuRef}
          onViewReport={() => { setSelectedEmployee(contextMenu.employee); setContextMenu(null); }}
          onRename={() => startEditEmployee(contextMenu.employee)}
          onDelete={() => { 
            setContextMenu(null);
            setConfirmModal({
              message: `Delete "${contextMenu.employee.name}" and all their attendance data? This cannot be undone.`,
              onConfirm: () => {
                deleteEmployee(contextMenu.employee.id);
                setConfirmModal(null);
              }
            });
          }} />
      )}
      {selectedEmployee && (() => {
        const reportData = getEmployeeReport(selectedEmployee.id);
        if (!reportData) return null;
        return <EmployeeReportModal employee={selectedEmployee} report={reportData} year={currentYear} onClose={() => setSelectedEmployee(null)} />;
      })()}
      {showEmailModal && <EmailReportModal employees={employees} attendance={attendance} currentYear={currentYear} currentMonth={currentMonth} onClose={() => setShowEmailModal(false)} />}
      {showStatsPage && <StatsPage stats={calculateStats()} currentMonth={currentMonth} currentYear={currentYear} onClose={() => setShowStatsPage(false)} />}
      {confirmModal && (
        <ConfirmModal 
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}
      <AttendancePopup 
  popup={popup} 
  popupNote={popupNote} 
  setPopupNote={setPopupNote} 
  popupRef={popupRef} 
  onMark={markAttendance} 
  onClear={clearAttendance} 
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