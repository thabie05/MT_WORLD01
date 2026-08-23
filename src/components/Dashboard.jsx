import React, { useState, useEffect, useMemo, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useTheme } from '../contexts/ThemeContext';
import { useSyncStatus } from '../contexts/SyncStatusContext';
import AttendanceRegister from './AttendanceRegister';
import SettingsPage from './SettingsPage';
import EmailReportsPage from './EmailReportsPage';
import StatsPage from './StatsPage';
import HistoryPage from './HistoryPage';
import EmployeeProfilePage from './EmployeeProfilePage';
import PasswordChangeModal from './PasswordChangeModal';
import {
  LayoutDashboard,
  CalendarCheck,
  Clock,
  BarChart3,
  Mail,
  Settings,
  LogOut,
  Sun,
  Moon,
  Bell,
  ChevronDown,
  Menu,
  X,
  Users,
  UserCheck,
  UserX,
  ClipboardList,
  Database,
  HardDrive,
  Upload,
  DollarSign,
} from 'lucide-react';
import { monthNames } from '../utils/holidays';

function Dashboard({ currentUser, onLogout, onPasswordChanged }) {
  const { theme, toggleTheme } = useTheme();
  const { syncStatus } = useSyncStatus();

  const registerRef = useRef();

  const [view, setView] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [openStatsAfterRegister, setOpenStatsAfterRegister] = useState(false);

  // Month/year for dashboard stats
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());

  const [showSettings, setShowSettings] = useState(false);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [dataManagementOpen, setDataManagementOpen] = useState(false);

  // Modal states (some used by Register)
  const [showHistory, setShowHistory] = useState(false);
  const [showStatsPage, setShowStatsPage] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [lastEdit, setLastEdit] = useState(null);

  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [history, setHistory] = useState([]);
  const [timeLogs, setTimeLogs] = useState({});
  const [loading, setLoading] = useState(true);

  // Employee profile
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);

  // Firestore listener
  useEffect(() => {
    const docRef = doc(db, 'rollcall', 'data');
    const unsubscribe = onSnapshot(
      docRef,
      { includeMetadataChanges: true },
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const activeEmployees = (data.employees || []).filter((emp) => !emp.isDeleted);
          setEmployees(activeEmployees);
          setAttendance(data.attendance || {});
          setHistory(data.history || []);
          setTimeLogs(data.timeLogs || {});
        } else {
          setEmployees([]);
          setAttendance({});
          setHistory([]);
          setTimeLogs({});
        }
        setLoading(false);
      },
      (err) => {
        console.error('Dashboard listener error:', err);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Auto‑open stats after switching to register view
  useEffect(() => {
    if (view === 'register' && openStatsAfterRegister) {
      setShowStatsPage(true);
      setOpenStatsAfterRegister(false);
    }
  }, [view, openStatsAfterRegister]);

  // Metrics for the selected month/year (Dashboard)
  const metrics = useMemo(() => {
    const activeEmployees = employees.filter((emp) => !emp.isDeleted);
    const totalActive = activeEmployees.length;

    const monthPrefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-`;
    let presentCount = 0,
      absentCount = 0,
      lateCount = 0,
      earlyCount = 0,
      offCount = 0,
      markedCount = 0;

    activeEmployees.forEach((emp) => {
      const empAttendance = attendance[emp.id] || {};
      const days = Object.keys(empAttendance).filter((key) => key.startsWith(monthPrefix));
      days.forEach((dateKey) => {
        const status = empAttendance[dateKey];
        if (status === 'present' || status === 'late' || status === 'early') {
          presentCount++;
          if (status === 'late') lateCount++;
          else if (status === 'early') earlyCount++;
          markedCount++;
        } else if (status === 'absent') {
          absentCount++;
          markedCount++;
        } else if (status === 'off') {
          offCount++;
          markedCount++;
        }
      });
    });

    return {
      totalActive,
      presentCount,
      absentCount,
      lateCount,
      earlyCount,
      offCount,
      markedCount,
    };
  }, [employees, attendance, selectedMonth, selectedYear]);

  // Handlers for register actions (via ref)
  const handleBackup = () => registerRef.current?.backupData();
  const handleRestore = (e) => registerRef.current?.restoreData(e);
  const handleUndo = () => registerRef.current?.handleUndo();

  // Quick Actions (Dashboard)
  const handleManageEmployees = () => {
    setView('register');
    setShowSettings(false);
  };
  const handleDailyAttendance = () => {
    setView('register');
    setShowSettings(false);
  };
  const handleGeneratePayroll = () => {
    setView('register');
    setOpenStatsAfterRegister(true);
    setShowSettings(false);
  };

  // Employee profile handler
  const openEmployeeProfile = (employeeId) => {
    setSelectedEmployeeId(employeeId);
    setView('profile');
    setShowSettings(false);
  };

  const handlePasswordChange = () => setShowPasswordModal(true);

  const isAdmin = currentUser.role === 'admin';
  const isUser = currentUser.role === 'user';
  const isViewer = currentUser.role === 'viewer';

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-10 h-10 border-[3px] border-main border-t-accent rounded-full animate-spin" />
        <p className="text-muted text-sm uppercase tracking-[0.2em]">Loading dashboard…</p>
      </div>
    );
  }

  const updateEmployee = (updatedEmployee) => {
  setEmployees((prev) =>
    prev.map((emp) => (emp.id === updatedEmployee.id ? updatedEmployee : emp))
  );
};

  // Navigation items
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'register', label: 'Attendance Register', icon: CalendarCheck },
    { id: 'history', label: 'History & Logs', icon: Clock },
    { id: 'stats', label: 'Analytics / Stats', icon: BarChart3 },
    { id: 'email', label: 'Email Reports', icon: Mail },
  ];
  if (isAdmin) navItems.push({ id: 'settings', label: 'System Settings', icon: Settings });

  const handleNavClick = (id) => {
    if (id === 'dashboard') {
      setView('dashboard');
      setShowSettings(false);
    } else if (id === 'register') {
      setView('register');
      setShowSettings(false);
    } else if (id === 'history') {
      setView('history');
      setShowSettings(false);
      setShowHistory(false);
    } else if (id === 'stats') {
      setView('stats');
      setShowSettings(false);
      setShowStatsPage(false);
    } else if (id === 'email') {
      setView('email');
      setShowSettings(false);
    } else if (id === 'settings') {
      setView('dashboard');
      setShowSettings(true);
    }
  };

  // Year options for picker
  const yearOptions = [];
  for (let y = today.getFullYear() - 5; y <= today.getFullYear() + 5; y++) {
    yearOptions.push(y);
  }

  return (
    <div className="flex overflow-hidden bg-body text-main font-sans h-full">
      {/* ===== SIDEBAR ===== */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-16'
        } bg-card border-main transition-all duration-300 flex-shrink-0 flex flex-col overflow-hidden`}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between h-26 px-4 border-b border-main relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('./background1.png')] bg-cover bg-center opacity-70 dark:opacity-70" />
          <div className="flex items-center gap-2 relative z-10">
            {sidebarOpen && <span className="text-lg font-semibold tracking-tight text-main"> </span>}
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-black dark:text-white hover:text-black/70 dark:hover:text-white/70 transition-colors p-1 border bg-card border-main rounded-lg hover:bg-accent-light relative z-10"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              (item.id === 'dashboard' && view === 'dashboard' && !showSettings) ||
              (item.id === 'register' && view === 'register' && !showHistory && !showStatsPage && !showEmailModal) ||
              (item.id === 'history' && view === 'history') ||
              (item.id === 'stats' && view === 'stats') ||
              (item.id === 'email' && view === 'email') ||
              (item.id === 'settings' && showSettings);
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-gray-200 dark:bg-gray-700 text-black dark:text-white shadow-md'
                    : 'text-muted hover:bg-accent-light hover:text-main hover:scale-[1.02] hover:shadow-sm'
                }`}
                title={!sidebarOpen ? item.label : ''}
              >
                <Icon size={20} className="flex-shrink-0" />
                {sidebarOpen && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}

          <div className="border-t border-main my-2" />

          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted hover:bg-accent-light hover:text-main hover:scale-[1.02] hover:shadow-sm transition-all duration-200"
            title={!sidebarOpen ? (theme === 'dark' ? 'Light Mode' : 'Dark Mode') : ''}
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            {sidebarOpen && <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>

          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-accent-red hover:bg-red-100 hover:text-accent-red-hover hover:scale-[1.02] hover:shadow-sm dark:hover:bg-red-900/30 transition-all duration-200"
            title={!sidebarOpen ? 'Logout' : ''}
          >
            <LogOut size={20} />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </nav>

        {sidebarOpen && (
          <div className="border-t border-main p-4 text-sm">
            <p className="font-medium text-main truncate">{currentUser.fullName}</p>
            <p className="text-muted truncate text-xs">{currentUser.email}</p>
          </div>
        )}
      </aside>

      {/* ===== MAIN CONTENT ===== */}
      <div className="flex-1 flex flex-col overflow-hidden bg-body">
        {/* ===== TOP NAVBAR (optional – you can also include this in App.jsx) ===== */}
        {/* If you have a separate TitleBar, remove this section */}
        <header className="sticky top-0 z-10 bg-card border-b border-main h-26 flex items-center justify-between px-4 md:px-6">
          <div className="flex-1 flex justify-center">
            <div className="flex flex-col items-center leading-tight">
              <span className="text-[10px] font-medium text-muted tracking-widest">EMPLOYEES</span>
              <span className="text-xl font-bold text-accent tracking-wide">ATTENDANCE</span>
              <span className="text-[10px] font-medium text-muted tracking-[0.2em]">R E G I S T E R</span>
            </div>
          </div>
          {/* User dropdown - you can keep or remove if you have a title bar */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 text-sm text-main hover:bg-accent-light rounded-lg px-2 py-1.5 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white font-semibold text-xs">
                  {currentUser.fullName?.charAt(0).toUpperCase() || 'U'}
                </div>
                <span className="hidden md:inline">{currentUser.fullName}</span>
                <ChevronDown size={16} className="text-muted" />
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-card border border-main rounded-lg shadow-theme overflow-hidden z-50">
                  <div className="py-1">
                    <div className="px-4 py-2 border-b border-main">
                      <p className="text-sm font-medium text-main">{currentUser.fullName}</p>
                      <p className="text-xs text-muted">{currentUser.email}</p>
                      <p className="text-xs text-accent mt-1 capitalize">{currentUser.role}</p>
                    </div>
                    <button
                      onClick={() => { toggleTheme(); setDropdownOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-muted hover:bg-accent-light hover:text-main transition-colors"
                    >
                      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                      {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                    </button>
                    <button
                      onClick={() => { handlePasswordChange(); setDropdownOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-muted hover:bg-accent-light hover:text-main transition-colors"
                    >
                      <Settings size={16} />
                      Change Password
                    </button>
                    <button
                      onClick={() => { onLogout(); setDropdownOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-accent-red hover:bg-red-100 hover:text-accent-red-hover dark:hover:bg-red-900/30 transition-colors border-t border-main"
                    >
                      <LogOut size={16} />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ===== PAGE CONTENT ===== */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-[1920px] mx-auto w-full flex flex-col gap-6">
            {view === 'profile' ? (
              <EmployeeProfilePage
                employeeId={selectedEmployeeId}
                employees={employees}
                attendance={attendance}
                history={history}
                timeLogs={timeLogs}
                onBack={() => setView('register')}
                onUpdateEmployee={updateEmployee}
              />
            ) : view === 'stats' ? (
              <StatsPage employees={employees} attendance={attendance} />
            ) : view === 'history' ? (
              <HistoryPage history={history} />
            ) : view === 'email' ? (
              <EmailReportsPage
                employees={employees}
                attendance={attendance}
                currentUser={currentUser}
              />
            ) : showSettings ? (
              <SettingsPage
                currentUser={currentUser}
                onPasswordChange={handlePasswordChange}
                onBackup={handleBackup}
                onRestore={handleRestore}
              />
            ) : view === 'dashboard' ? (
              // ===== DASHBOARD VIEW =====
              <div className="space-y-6">
                {/* Dashboard Header with Month/Year Picker */}
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div>
                    <h1 className="text-2xl font-semibold text-main">Dashboard</h1>
                    <p className="text-muted text-sm">
                      {today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 bg-card border border-main rounded-lg p-1.5 shadow-theme">
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                      className="bg-input text-main text-sm rounded-md px-2 py-1 outline-none focus:border-accent border border-main"
                    >
                      {monthNames.map((name, idx) => (
                        <option key={idx} value={idx}>{name}</option>
                      ))}
                    </select>
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                      className="bg-input text-main text-sm rounded-md px-2 py-1 outline-none focus:border-accent border border-main"
                    >
                      {yearOptions.map((year) => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  <div className="bg-card border border-main rounded-xl p-5 shadow-theme">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-accent/10 rounded-lg">
                        <Users size={20} className="text-accent" />
                      </div>
                      <p className="text-muted text-xs uppercase tracking-wider font-medium">Total Employees</p>
                    </div>
                    <p className="text-3xl font-bold text-main mt-2">{metrics.totalActive}</p>
                    <p className="text-xs text-muted mt-1">{metrics.totalActive} active</p>
                  </div>

                  <div className="bg-card border border-main rounded-xl p-5 shadow-theme">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-500/10 rounded-lg">
                        <UserCheck size={20} className="text-emerald-400" />
                      </div>
                      <p className="text-muted text-xs uppercase tracking-wider font-medium">Present This Month</p>
                    </div>
                    <p className="text-3xl font-bold text-main mt-2">{metrics.presentCount}</p>
                    <p className="text-xs text-muted mt-1">{metrics.markedCount} marked</p>
                  </div>

                  <div className="bg-card border border-main rounded-xl p-5 shadow-theme">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-red-500/10 rounded-lg">
                        <UserX size={20} className="text-red-400" />
                      </div>
                      <p className="text-muted text-xs uppercase tracking-wider font-medium">Absent This Month</p>
                    </div>
                    <p className="text-3xl font-bold text-main mt-2">{metrics.absentCount}</p>
                    <p className="text-xs text-muted mt-1">0 on leave</p>
                  </div>

                  <div className="bg-card border border-main rounded-xl p-5 shadow-theme">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-accent/10 rounded-lg">
                        <ClipboardList size={20} className="text-accent" />
                      </div>
                      <p className="text-muted text-xs uppercase tracking-wider font-medium">Attendance Entries</p>
                    </div>
                    <p className="text-3xl font-bold text-main mt-2">{metrics.markedCount}</p>
                    <p className="text-xs text-muted mt-1">{metrics.markedCount} entries</p>
                  </div>
                </div>

                {/* Two‑column: Attendance Breakdown + Quick Actions */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-card border border-main rounded-xl p-5 shadow-theme">
                    <h2 className="text-sm font-semibold text-main uppercase tracking-wide mb-4">
                      {monthNames[selectedMonth]} {selectedYear} – Attendance Breakdown
                    </h2>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-muted text-sm">Present</span>
                        <span className="text-sm font-medium text-emerald-400">{metrics.presentCount}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted text-sm">Late</span>
                        <span className="text-sm font-medium text-blue-400">{metrics.lateCount}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted text-sm">Early Leave</span>
                        <span className="text-sm font-medium text-purple-400">{metrics.earlyCount}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted text-sm">Absent</span>
                        <span className="text-sm font-medium text-red-400">{metrics.absentCount}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted text-sm">Off Duty</span>
                        <span className="text-sm font-medium text-gray-400">{metrics.offCount}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-card border border-main rounded-xl p-5 shadow-theme">
                    <h2 className="text-sm font-semibold text-main uppercase tracking-wide mb-4">Quick Actions</h2>
                    <div className="space-y-2">
                      <button
                        onClick={handleManageEmployees}
                        className="w-full flex items-center gap-3 bg-input hover:bg-accent-light text-main px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border border-main"
                      >
                        <Users size={18} className="text-accent" />
                        <span>Manage Employees</span>
                        <span className="ml-auto text-xs text-muted">Add or edit</span>
                      </button>
                      <button
                        onClick={handleDailyAttendance}
                        className="w-full flex items-center gap-3 bg-input hover:bg-accent-light text-main px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border border-main"
                      >
                        <CalendarCheck size={18} className="text-accent" />
                        <span>Daily Attendance</span>
                        <span className="ml-auto text-xs text-muted">Mark for any date</span>
                      </button>
                      <button
                        onClick={handleGeneratePayroll}
                        className="w-full flex items-center gap-3 bg-input hover:bg-accent-light text-main px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border border-main"
                      >
                        <DollarSign size={18} className="text-accent" />
                        <span>Generate Payroll</span>
                        <span className="ml-auto text-xs text-muted">Calculate salaries</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // ===== REGISTER VIEW =====
              <>
                <div className="bg-card border border-main rounded-lg px-4 py-2 flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => { setView('history'); }}
                    className="bg-input text-main py-1.5 px-3 rounded-md text-sm font-medium hover:bg-accent-light transition flex items-center gap-2 border border-main"
                  >
                    <Clock size={16} />
                    History
                  </button>
                  <button
                    onClick={() => { setView('stats'); }}
                    className="bg-input text-main py-1.5 px-3 rounded-md text-sm font-medium hover:bg-accent-light transition flex items-center gap-2 border border-main"
                  >
                    <BarChart3 size={16} />
                    Stats
                  </button>
                  <button
                    onClick={() => { setView('email'); }}
                    className="bg-input text-main py-1.5 px-3 rounded-md text-sm font-medium hover:bg-accent-light transition flex items-center gap-2 border border-main"
                  >
                    <Mail size={16} />
                    Email
                  </button>

                  {isAdmin && (
                    <>
                      <div className="w-px h-6 bg-main" />

                      {lastEdit && (
                        <button
                          onClick={handleUndo}
                          className="bg-orange-600 text-white py-1.5 px-3 rounded-md text-sm hover:bg-orange-500 transition flex items-center gap-2"
                        >
                          ↩️ Undo
                        </button>
                      )}

                      <div className="relative">
                        <button
                          onClick={() => setDataManagementOpen(!dataManagementOpen)}
                          className="bg-input text-main py-1.5 px-3 rounded-md text-sm font-medium hover:bg-accent-light transition flex items-center gap-2 border border-main"
                        >
                          <Database size={16} />
                          Data Management
                          <ChevronDown size={14} className={`transition-transform ${dataManagementOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {dataManagementOpen && (
                          <div className="absolute left-0 mt-1 w-48 bg-card border border-main rounded-lg shadow-theme overflow-hidden z-50">
                            <div className="py-1">
                              <button
                                onClick={() => { handleBackup(); setDataManagementOpen(false); }}
                                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-main hover:bg-accent-light transition-colors"
                              >
                                <HardDrive size={16} />
                                Backup
                              </button>
                              <label className="w-full flex items-center gap-3 px-4 py-2 text-sm text-main hover:bg-accent-light transition-colors cursor-pointer">
                                <Upload size={16} />
                                Restore
                                <input type="file" accept=".json" onChange={handleRestore} className="hidden" />
                              </label>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  <div className="w-px h-6 bg-main" />

                  <button
                    onClick={() => window.location.assign(`${window.location.origin}${window.location.pathname}?kiosk=1`)}
                    className="bg-input text-main py-1.5 px-3 rounded-md text-sm font-medium hover:bg-accent-light transition flex items-center gap-2 border border-main"
                  >
                    <img src="./fingerprint-icon.png" alt="" className="w-5 h-5 dark:invert" />
                    Kiosk
                  </button>

                  <button
                    onClick={() => setShowDeleted(!showDeleted)}
                    className={`py-1.5 px-3 rounded-md text-sm font-medium transition flex items-center gap-2 ml-auto ${
                      showDeleted ? 'bg-accent-red text-white hover:bg-accent-red-hover' : 'bg-input text-main hover:bg-accent-light border border-main'
                    }`}
                  >
                    {showDeleted ? '👥 Active' : '🗑️ Trash'}
                  </button>
                </div>

                <AttendanceRegister
                  ref={registerRef}
                  currentUser={currentUser}
                  showHistory={showHistory}
                  setShowHistory={setShowHistory}
                  showStatsPage={showStatsPage}
                  setShowStatsPage={setShowStatsPage}
                  showEmailModal={showEmailModal}
                  setShowEmailModal={setShowEmailModal}
                  showDeleted={showDeleted}
                  setShowDeleted={setShowDeleted}
                  lastEdit={lastEdit}
                  setLastEdit={setLastEdit}
                  onViewProfile={openEmployeeProfile}
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <PasswordChangeModal
          currentUser={currentUser}
          onClose={() => setShowPasswordModal(false)}
          onPasswordChanged={onPasswordChanged}
        />
      )}
    </div>
  );
}

export default Dashboard;