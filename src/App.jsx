import React, { useState, useEffect } from 'react';
import './App.css';

const STORAGE_KEY = 'mtworld_rollcall_data';

function App() {
  const [employees, setEmployees] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.employees || [];
      } catch {
        return [];
      }
    }
    return [
      { id: '1', name: 'John Doe' },
      { id: '2', name: 'Jane Smith' },
    ];
  });

  const [attendance, setAttendance] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.attendance || {};
      } catch {
        return {};
      }
    }
    return {};
  });

  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth()); // 0-indexed
  const [newEmployeeName, setNewEmployeeName] = useState('');

  // Save to localStorage whenever data changes
  useEffect(() => {
    const data = { employees, attendance };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [employees, attendance]);

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const toggleAttendance = (employeeId, day) => {
    const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setAttendance(prev => {
      const updated = { ...prev };
      const empAttendance = { ...(updated[employeeId] || {}) };
      empAttendance[dateKey] = !empAttendance[dateKey];
      updated[employeeId] = empAttendance;
      return updated;
    });
  };

  const isPresent = (employeeId, day) => {
    const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const empAttendance = attendance[employeeId] || {};
    return !!empAttendance[dateKey];
  };

  const getTotalWorkedDays = (employeeId) => {
    const empAttendance = attendance[employeeId] || {};
    const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-`;
    return Object.keys(empAttendance).filter(key => key.startsWith(monthPrefix) && empAttendance[key]).length;
  };

  const addEmployee = () => {
    const name = newEmployeeName.trim();
    if (name === '') return;
    const newId = Date.now().toString();
    setEmployees(prev => [...prev, { id: newId, name }]);
    setNewEmployeeName('');
  };

  // Remove employee function removed – no longer needed in UI

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="App">
      <header className="app-header">
        {/* Add your logo here – place the file in the public folder */}
        <img
          src="/Screenshot 2026-05-07 084413.png"
          alt="MT WORLD Logo"
          className="logo"
        />
        <h1>MT WORLD</h1>
        <p className="tagline">Electronic Security Equipment & Solutions</p>
        <h2>Monthly Work Rollcall</h2>
      </header>

      <div className="controls">
        <div className="month-navigation">
          <button onClick={handlePrevMonth}>&lt;</button>
          <span className="month-display">
            {monthNames[currentMonth]} {currentYear}
          </span>
          <button onClick={handleNextMonth}>&gt;</button>
        </div>

        <div className="add-employee">
          <input
            type="text"
            placeholder="New employee name"
            value={newEmployeeName}
            onChange={(e) => setNewEmployeeName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addEmployee()}
          />
          <button onClick={addEmployee}>Add</button>
        </div>
      </div>

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
                {daysArray.map(day => (
                  <th key={day} className="day-header">
                    {day}
                  </th>
                ))}
                <th className="total-header">Total</th>
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => {
                const total = getTotalWorkedDays(emp.id);
                return (
                  <tr key={emp.id}>
                    <td className="sticky-col employee-name">
                      <span className="emp-name">{emp.name}</span>
                      {/* Remove button completely hidden/removed */}
                    </td>
                    {daysArray.map(day => {
                      const present = isPresent(emp.id, day);
                      return (
                        <td
                          key={day}
                          className={`day-cell ${present ? 'present' : 'absent'}`}
                          onClick={() => toggleAttendance(emp.id, day)}
                          title={`${emp.name} – ${day} ${monthNames[currentMonth]} ${currentYear}`}
                        >
                          {present ? '✓' : ''}
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
        <p>Click a cell to mark/unmark attendance for that day.</p>
      </footer>
    </div>
  );
}

export default App;