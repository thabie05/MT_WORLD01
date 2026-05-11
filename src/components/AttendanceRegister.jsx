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
import EmailReportModal from './EmailReportModal';

function AttendanceRegister({ currentUser, onLogout, onPasswordChanged }) {
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [edits, setEdits] = useState({});
  const [history, setHistory] = useState([]);
  const [notes, setNotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState('asc');
  const [showStats, setShowStats] = useState(false);
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

  const popupRef = useRef(null);
  const contextMenuRef = useRef(null);

  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const isAdmin = currentUser.role === 'admin';

  useEffect(() => { seedUsersIfNeeded(db, doc, getDoc, setDoc); }, []);

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
    const saveData = async () => {
      try {
        const docRef = doc(db, 'rollcall', 'data');
        await setDoc(docRef, { employees, attendance, edits, history, notes }, { merge: true });
      } catch (err) { console.error('Failed to save data:', err); }
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
    const statusLabel = status === 'present' ? 'Present' : status === 'absent' ? 'Absent' : status === 'late' ? 'Late' : 'Early';
    setHistory((prev) => [{ id: Date.now(), employeeId, employeeName: employee?.name || 'Unknown', day, date: dateKey, status: statusLabel, note: noteText.trim() || '', editor: currentUser.fullName, editedAt: new Date().toISOString() }, ...prev]);
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
    if (editCount >= 2) return;
    setPopupNote(getNote(employeeId, day));
    const rect = e.currentTarget.getBoundingClientRect();
    setPopup({ employeeId, day, x: rect.left + window.scrollX, y: rect.bottom + window.scrollY });
  };

  const handleEmployeeClick = (e, emp) => {
    e.stopPropagation();
    if (isAdmin) {
      const rect = e.currentTarget.getBoundingClientRect();
      setContextMenu({ employee: emp, x: rect.left + window.scrollX, y: rect.bottom + window.scrollY });
    } else {
      setSelectedEmployee(emp);
    }
  };

  const getSortedEmployees = () => [...employees].sort((a, b) => sortOrder === 'asc' ? a.name.toLowerCase().localeCompare(b.name.toLowerCase()) : b.name.toLowerCase().localeCompare(a.name.toLowerCase()));
  const toggleSort = () => setSortOrder((prev) => prev === 'asc' ? 'desc' : 'asc');

  const calculateStats = () => {
    let presentCount = 0, absentCount = 0, lateCount = 0, earlyCount = 0, weekendCount = 0, holidayCount = 0, blankCount = 0;
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

  const clearAttendance = (employeeId, day) => {
  const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  // Remove the attendance status
  setAttendance((prev) => {
    const updated = { ...prev };
    if (updated[employeeId]) {
      delete updated[employeeId][dateKey];
      if (Object.keys(updated[employeeId]).length === 0) {
        delete updated[employeeId];
      }
    }
    return updated;
  });

  // Remove the note if exists
  setNotes((prev) => {
    const updated = { ...prev };
    delete updated[`${employeeId}-${dateKey}`];
    return updated;
  });

  // Remove edit count
  setEdits((prev) => {
    const updated = { ...prev };
    delete updated[`${employeeId}-${dateKey}`];
    return updated;
  });

  // Add to history
  const employee = employees.find((emp) => emp.id === employeeId);
  setHistory((prev) => [{
    id: Date.now(),
    employeeId,
    employeeName: employee?.name || 'Unknown',
    day,
    date: dateKey,
    status: 'Cleared',
    note: '',
    editor: currentUser.fullName,
    editedAt: new Date().toISOString(),
  }, ...prev]);

  setPopup(null);
  setPopupNote('');
};

  const getEmployeeReport = (empId) => {
    const months = [];
    for (let m = 0; m < 12; m++) {
      const daysInM = new Date(currentYear, m + 1, 0).getDate();
      let present = 0, absent = 0, late = 0, early = 0, weekend = 0, holiday = 0, unmarked = 0;
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
      months.push({ month: monthNames[m], Present: present, Late: late, Early: early, Absent: absent, Weekend: weekend, Holiday: holiday, Unmarked: unmarked });
    }
    return months;
  };

  if (loading) return (
    <div className="flex justify-center items-center min-h-screen text-2xl text-indigo-900">
      Loading data…
    </div>
  );

  return (
    <div className="max-w-[1920px] mx-auto p-5 max-sm:p-2.5">
      {/* ========== HEADER ========== */}
<header className="flex flex-col bg-[linear-gradient(rgba(26,35,126,0.7),rgba(13,71,161,0.2)),url('/background1.png')] bg-left bg-no-repeat bg-contain text-white pt-[150px] pb-[10px] px-6 rounded-xl mb-6 shadow-lg max-sm:py-4 max-sm:px-2">
  <div className="flex justify-between items-start w-full max-sm:flex-col max-sm:items-center max-sm:gap-2.5">
    <div className="flex items-center gap-3 flex-wrap max-sm:w-full max-sm:justify-between">
      <span className="text-[0.95rem] text-yellow-400 cursor-pointer hover:opacity-80 transition-opacity whitespace-nowrap" onClick={() => setShowPasswordModal(true)} title="Click to change password">
        Logged in as: {currentUser.fullName} {isAdmin && '(Admin)'}
      </span>
      <button onClick={onLogout} className="bg-white/15 border border-white/30 text-white py-1.5 px-3.5 rounded-lg font-medium text-[0.9rem] transition hover:bg-white/25 h-9">
        Logout
      </button>
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
            <button onClick={() => setShowStats(!showStats)} className="bg-purple-500 text-white py-2 px-3.5 rounded-lg font-medium text-sm hover:bg-purple-600 transition">{showStats ? 'Hide Stats' : '📊 Stats'}</button>
            <button onClick={() => setShowEmailModal(true)} className="bg-emerald-600 text-white py-2 px-3.5 rounded-lg font-medium text-sm hover:bg-emerald-700 transition">📧 Email</button>
            <button onClick={toggleSort} className="bg-slate-500 text-white py-2 px-3.5 rounded-lg font-medium text-sm hover:bg-slate-600 transition min-w-[70px]">{sortOrder === 'asc' ? '↓ A‑Z' : '↑ Z‑A'}</button>
            <div className="flex gap-2">
              <input type="text" placeholder="Employee name" value={newEmployeeName} onChange={(e) => { setNewEmployeeName(e.target.value); setAddError(''); }} onKeyPress={(e) => e.key === 'Enter' && addEmployee()} className="py-2 px-3 border border-slate-300 rounded-lg text-sm text-slate-800 bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition" />
              <button onClick={addEmployee} className="bg-green-600 text-white py-2 px-4 rounded-lg font-medium text-sm hover:bg-green-700 transition">+ Add</button>
            </div>
          </div>
        </div>
        {addError && <p className="text-red-600 text-xs mb-3 font-medium">{addError}</p>}

        {/* ========== STATS ========== */}
        {showStats && <StatsChart stats={calculateStats()} />}

        {/* ========== TABLE ========== */}
{employees.length === 0 ? (
  <div className="text-center py-10 text-slate-400"><p>No employees added yet.</p></div>
) : (
  <div className="overflow-x-auto rounded-xl border border-[#e2e8f0]">
    <table className="w-full border-collapse min-w-[700px]">
      <thead>
        <tr>
          <th className="sticky left-0 bg-[#f1f5f9] z-[3] w-[30px] min-w-[30px] font-semibold py-2.5 px-1 text-center text-xs border-b border-r border-[#e2e8f0] text-slate-700">#</th>
          <th className="sticky left-[30px] bg-[#f1f5f9] z-[2] font-semibold py-2.5 px-3 text-left text-xs border-b border-r-2 border-[#cbd5e1] text-slate-700">Names of Employees</th>
          {daysArray.map((day) => (
            <th key={day} className="bg-[#f1f5f9] font-semibold py-2.5 px-0.5 text-center text-[0.75rem] border-b border-r border-[#e2e8f0] text-slate-600">{day}</th>
          ))}
          <th className="bg-[#f1f5f9] font-semibold py-2.5 px-2 text-center text-xs border-b border-[#e2e8f0] text-slate-700">Total</th>
        </tr>
      </thead>
      <tbody>
        {getSortedEmployees().map((emp, index) => {
          const total = getTotalWorkedDays(emp.id);
          return (
            <tr key={emp.id}>
              <td className="sticky left-0 bg-[#f8fafc] z-[3] text-center text-xs text-slate-600 font-medium py-2 px-1 w-[30px] border-b border-r border-[#e2e8f0]">{index + 1}</td>
              <td className="sticky left-[30px] bg-white z-[2] py-2 px-3 font-medium border-b border-r-2 border-[#cbd5e1] text-slate-800 text-sm">
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
                const edited = isEdited(emp.id, day);
                const weekend = isWeekend(day);
                const holiday = isHoliday(day);
                const note = getNote(emp.id, day);
                const editors = getEditors(emp.id, day);
                const showEditors = (present || absent || late || early) && editors.length > 0;

                let cellBg = 'bg-white';
                let cellText = 'text-transparent';
                let content = '';

                if (present) { cellBg = 'bg-green-100'; cellText = 'text-green-700 font-bold'; content = '✓'; }
                else if (absent) { cellBg = 'bg-red-100'; cellText = 'text-red-700 font-bold'; content = '✗'; }
                else if (late) { cellBg = 'bg-yellow-100'; cellText = 'text-yellow-700 font-bold'; content = '⏰'; }
                else if (early) { cellBg = 'bg-purple-100'; cellText = 'text-purple-700 font-bold'; content = '🚪'; }
                if (weekend) { cellBg = 'bg-[#cbd5e1]'; cellText = content ? cellText : 'text-[#475569]'; }
                if (holiday) { cellBg = 'bg-[#fde047]'; cellText = content ? cellText : 'text-[#854d0e] font-medium'; }

                // Build tooltip with editor info
                let tooltip = `${emp.name} – ${day} ${monthNames[currentMonth]} ${currentYear}`;
                if (weekend) tooltip += ' (Weekend)';
                if (holiday) {
                  const holidayName = getSAHolidays(currentYear).find(h => h.date === `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`)?.name;
                  tooltip += ` (${holidayName})`;
                }
                if (late) tooltip += ' (Late)';
                if (early) tooltip += ' (Early Leave)';
                if (note) tooltip += ` – 📝 ${note}`;
                if (showEditors) tooltip += ` (edited by ${editors.join(', ')})`;

                return (
                  <td key={day}
                    className={`w-9 h-9 text-center cursor-pointer text-sm border-b border-r border-[#e2e8f0] transition relative ${cellBg} ${cellText} ${!weekend ? 'hover:bg-[#f1f5f9]' : ''}`}
                    onClick={(e) => openPopup(e, emp.id, day)}
                    title={tooltip}
                  >
                    {content}
                    {note && <span className="absolute bottom-0 left-0.5 text-[0.5rem]" title={note}>📝</span>}
                    {edited && <span className="absolute top-0 right-0.5 text-[0.45rem] text-orange-600" title="This day has been edited">✎</span>}
                  </td>
                );
              })}
              <td className="text-center font-bold bg-green-50 text-green-700 border-b border-[#e2e8f0] text-sm">{total}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
)}
        

        {/* ========== FOOTER ========== */}
<footer className="text-center mt-5 text-slate-500 text-sm">
  <p>Click a blank cell to mark attendance. Options: Present, Absent, Late, or Early Leave (with optional note). Locked after two edits.</p>
  {isAdmin && <p className="text-purple-500 italic mt-1 text-xs">Admin: Click employee name for options (View Report, Rename, Delete).</p>}
</footer>
      </div>

      {/* ========== MODALS ========== */}
      {showHistory && <HistoryModal history={history} onClose={() => setShowHistory(false)} />}
      {showPasswordModal && <PasswordChangeModal currentUser={currentUser} onClose={() => setShowPasswordModal(false)} onPasswordChanged={onPasswordChanged} />}
      {contextMenu && isAdmin && (
        <ContextMenu contextMenu={contextMenu} contextMenuRef={contextMenuRef}
          onViewReport={() => { setSelectedEmployee(contextMenu.employee); setContextMenu(null); }}
          onRename={() => startEditEmployee(contextMenu.employee)}
          onDelete={() => { deleteEmployee(contextMenu.employee.id); setContextMenu(null); }} />
      )}
      {selectedEmployee && (
        <EmployeeReportModal employee={selectedEmployee} report={getEmployeeReport(selectedEmployee.id)} year={currentYear} onClose={() => setSelectedEmployee(null)} />
      )}
      {showEmailModal && (
        <EmailReportModal employees={employees} attendance={attendance} currentYear={currentYear} currentMonth={currentMonth} onClose={() => setShowEmailModal(false)} />
      )}
      <AttendancePopup 
  popup={popup} 
  popupNote={popupNote} 
  setPopupNote={setPopupNote} 
  popupRef={popupRef} 
  onMark={markAttendance} 
  onClear={clearAttendance}
  isAdmin={isAdmin}
/>
    </div>
  );
}

export default AttendanceRegister;