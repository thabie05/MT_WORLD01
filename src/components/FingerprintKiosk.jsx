import React, { useEffect, useRef, useState, useCallback } from 'react';
import { doc, collection, onSnapshot, getDoc, updateDoc } from 'firebase/firestore';
import { loadUsers } from '../data/users';
import { verifyPassword } from '../utils/Passwords';
import { db } from '../firebase';
import { recordFingerprintAction } from '../utils/attendanceWrites';
import { monthDocRef, migrateLegacy } from '../utils/rollcallStore';
import EnrollFingerprintModal from './EnrollFingerprintModal';
import { useSyncStatus } from '../contexts/SyncStatusContext';

const MATCHER_API = 'http://127.0.0.1:4000';
const RESULT_DISPLAY_MS = 4000;
const STRICT_MODE_TEARDOWN_DELAY_MS = 300;

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function AnalogClock({ now }) {
  const seconds = now.getSeconds();
  const minutes = now.getMinutes();
  const hours = now.getHours() % 12;

  const secDeg = seconds * 6;
  const minDeg = minutes * 6 + seconds * 0.1;
  const hourDeg = hours * 30 + minutes * 0.5;

  const ticks = Array.from({ length: 12 }, (_, i) => i);

  return (
    <svg viewBox="0 0 200 200" className="w-40 h-40 md:w-48 md:h-48 drop-shadow-[0_4px_20px_rgba(59,130,246,0.2)]">
      <circle cx="100" cy="100" r="96" fill="var(--bg-card)" stroke="var(--accent)" strokeWidth="3" />
      <circle cx="100" cy="100" r="88" fill="none" stroke="var(--border-strong)" strokeWidth="1" />
      {ticks.map((i) => {
        const angle = (i * 30 * Math.PI) / 180;
        const isQuarter = i % 3 === 0;
        const r1 = isQuarter ? 74 : 80;
        const r2 = 86;
        const x1 = 100 + r1 * Math.sin(angle);
        const y1 = 100 - r1 * Math.cos(angle);
        const x2 = 100 + r2 * Math.sin(angle);
        const y2 = 100 - r2 * Math.cos(angle);
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={isQuarter ? 'var(--accent)' : 'var(--text-muted)'}
            strokeWidth={isQuarter ? 2.5 : 1.5}
            strokeLinecap="round"
          />
        );
      })}
      <line
        x1="100"
        y1="100"
        x2="100"
        y2="58"
        stroke="var(--text-main)"
        strokeWidth="5"
        strokeLinecap="round"
        style={{ transformOrigin: '100px 100px', transform: `rotate(${hourDeg}deg)` }}
      />
      <line
        x1="100"
        y1="100"
        x2="100"
        y2="38"
        stroke="var(--text-main)"
        strokeWidth="3.5"
        strokeLinecap="round"
        style={{ transformOrigin: '100px 100px', transform: `rotate(${minDeg}deg)` }}
      />
      <line
        x1="100"
        y1="106"
        x2="100"
        y2="30"
        stroke="var(--accent-red)"
        strokeWidth="1.5"
        strokeLinecap="round"
        className="clock-second-hand"
        style={{ transformOrigin: '100px 100px', transform: `rotate(${secDeg}deg)` }}
      />
      <circle cx="100" cy="100" r="4.5" fill="var(--accent)" />
    </svg>
  );
}

function FingerprintKiosk() {
  const { setSyncStatus } = useSyncStatus();

  const [status, setStatus] = useState('init');
  const [message, setMessage] = useState('Starting fingerprint reader…');
  const [matchedEmployee, setMatchedEmployee] = useState(null);
  const [now, setNow] = useState(new Date());
  const [stampPulse, setStampPulse] = useState(false);

  const [employees, setEmployees] = useState([]);
  const [timeLogs, setTimeLogs] = useState({});
  const [showHistory, setShowHistory] = useState(false);
  const [todayLogs, setTodayLogs] = useState([]);

  const [isOffline, setIsOffline] = useState(false);

  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [enrollingNewEmployee, setEnrollingNewEmployee] = useState(null);

  const sdkRef = useRef(null);
  const teardownTimerRef = useRef(null);
  const cooldownTimerRef = useRef(null);
  const employeesRef = useRef(employees);

  useEffect(() => { employeesRef.current = employees; }, [employees]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Real-time listeners. Employees live in rollcall/data; clock logs live in the
  // monthly document (see utils/rollcallStore.js). Re-subscribes when the month rolls over.
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  useEffect(() => {
    // One-time move of the old single document into monthly documents (safe to call every load).
    migrateLegacy().catch((err) => console.error('Data migration failed (will retry on next load):', err));

    let activeEmployees = [];
    let monthLogs = {};

    const publishToday = () => {
      // "-YYYY-MM-DD" is always 11 chars; employee ids may contain hyphens, so slice from the end.
      const d = new Date();
      const suffix = `-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const employeeMap = {};
      activeEmployees.forEach((emp) => { employeeMap[emp.id] = emp.name; });
      const logs = [];
      for (const key of Object.keys(monthLogs)) {
        if (!key.endsWith(suffix)) continue;
        const entry = monthLogs[key];
        const employeeId = key.slice(0, -suffix.length);
        logs.push({
          employeeId,
          employeeName: employeeMap[employeeId] || 'Unknown',
          clockIn: entry.clockIn ? new Date(entry.clockIn) : null,
          clockOut: entry.clockOut ? new Date(entry.clockOut) : null,
        });
      }
      logs.sort((a, b) => (a.clockIn || 0) - (b.clockIn || 0) || a.employeeName.localeCompare(b.employeeName));
      setTodayLogs(logs);
    };

    const unsubEmployees = onSnapshot(
      doc(db, 'rollcall', 'data'),
      { includeMetadataChanges: true },
      (snap) => {
        setSyncStatus({ fromCache: snap.metadata.fromCache, hasPendingWrites: snap.metadata.hasPendingWrites });
        setIsOffline(snap.metadata.fromCache);
        if (!snap.exists()) return;
        activeEmployees = (snap.data().employees || []).filter((emp) => !emp.isDeleted);
        setEmployees(activeEmployees);
        publishToday();
      },
      (err) => {
        console.error('Failed to listen to employees:', err);
        setSyncStatus({ fromCache: true, hasPendingWrites: false });
      }
    );
    const unsubLogs = onSnapshot(
      monthDocRef(monthKey),
      (snap) => {
        monthLogs = snap.exists() ? snap.data().timeLogs || {} : {};
        setTimeLogs(monthLogs);
        publishToday();
      },
      (err) => console.error('Failed to listen to time logs:', err)
    );
    return () => { unsubEmployees(); unsubLogs(); };
  }, [setSyncStatus, monthKey]);

  // Fingerprint sync (unchanged)
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'fingerprints'),
      (snapshot) => {
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (!data.employeeId || !Array.isArray(data.templates) || data.templates.length === 0) return;
          fetch(`${MATCHER_API}/load-templates`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeId: data.employeeId, templates: data.templates }),
          }).catch((err) => {
            console.error(`Failed to sync templates for ${data.employeeId} to matcher:`, err);
          });
        });
      },
      (err) => console.error('Failed to listen to fingerprints collection:', err)
    );
    return () => unsubscribe();
  }, []);

  const resetToSelection = () => {
    setStatus('ready');
    setMessage('Scan your finger to clock in/out.');
    setMatchedEmployee(null);
    setStampPulse(false);
  };

  const handleQuickAdd = async () => {
    // Check against the real admin accounts instead of a hard-coded password.
    let users;
    try {
      const credSnap = await getDoc(doc(db, 'users', 'credentials'));
      users = credSnap.exists() && credSnap.data().users?.length ? credSnap.data().users : loadUsers();
    } catch {
      users = loadUsers();
    }
    let isAdminPassword = false;
    for (const u of users.filter((x) => x.role === 'admin')) {
      if (await verifyPassword(u.password, adminPassword)) { isAdminPassword = true; break; }
    }
    if (!isAdminPassword) {
      setAdminError('Incorrect admin password');
      return;
    }
    const name = newEmployeeName.trim();
    if (!name) return;
    const newEmp = { id: Date.now().toString(), name, isDeleted: false };
    const docRef = doc(db, 'rollcall', 'data');
    const snap = await getDoc(docRef);
    const currentEmployees = snap.exists() ? snap.data().employees || [] : [];
    await updateDoc(docRef, { employees: [...currentEmployees, newEmp] });
    setEnrollingNewEmployee(newEmp);
    setShowAdminLogin(false);
    setAdminPassword('');
    setAdminError('');
    setNewEmployeeName('');
  };

  const handleSample = useCallback(async (event) => {
    if (cooldownTimerRef.current) {
      setMessage('Please wait a moment before scanning again.');
      return;
    }

    setStatus('scanning');
    setMessage('Checking fingerprint…');
    try {
      const parsed = typeof event.samples === 'string' ? JSON.parse(event.samples) : event.samples;
      const rawSample = Array.isArray(parsed) ? parsed[0] : parsed;
      if (!rawSample) throw new Error('No sample data received from reader.');

      const imageBase64 = window.Fingerprint.b64UrlTo64(rawSample);

      const res = await fetch(`${MATCHER_API}/identify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64 }),
      });
      const result = await res.json();

      if (result.matched) {
        const employee = employeesRef.current.find((e) => e.id === result.employeeId);
        if (!employee) {
          setStatus('no-match');
          setMessage('Fingerprint matched an employee ID that no longer exists. Ask an admin to re-enroll.');
          setTimeout(() => resetToSelection(), RESULT_DISPLAY_MS);
        } else {
          setMatchedEmployee(employee);
          const todayKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
          const log = timeLogs[`${employee.id}-${todayKey}`];
          const action = (log && log.clockIn && !log.clockOut) ? 'end' : 'start';

          // 30-minute rule
          if (action === 'end' && log && log.clockIn) {
            const startTime = new Date(log.clockIn);
            const currentTime = new Date();
            const diffMs = currentTime - startTime;
            const diffMinutes = Math.floor(diffMs / (1000 * 60));
            if (diffMinutes < 30) {
              const remaining = 30 - diffMinutes;
              setStatus('error');
              setMessage(`Cannot end shift yet. ${remaining} minutes remaining.`);
              setTimeout(() => resetToSelection(), RESULT_DISPLAY_MS);
              return;
            }
          }

          const clockResult = await recordFingerprintAction(employee, action);
          setStampPulse(true);
          setTimeout(() => setStampPulse(false), 500);
          if (clockResult.error) {
            setStatus('no-match');
            setMessage(`${employee.name}: ${clockResult.error}`);
            setTimeout(() => resetToSelection(), RESULT_DISPLAY_MS);
          } else {
            setStatus('matched');
            if (clockResult.action === 'clock-in') {
              setMessage(`Clocked IN at ${clockResult.time.toLocaleTimeString()}`);
            } else {
              setMessage(`Clocked OUT at ${clockResult.time.toLocaleTimeString()}`);
            }
            cooldownTimerRef.current = true;
            setTimeout(() => {
              cooldownTimerRef.current = false;
              resetToSelection();
            }, 5000);
          }
        }
      } else {
        setStatus('no-match');
        setMessage('Fingerprint not recognized. Try again.');
        setTimeout(() => resetToSelection(), RESULT_DISPLAY_MS);
      }
    } catch (err) {
      console.error('Fingerprint identify failed:', err);
      setStatus('error');
      setMessage('Could not reach the fingerprint matching service. Try again.');
      setTimeout(() => resetToSelection(), RESULT_DISPLAY_MS);
    }
  }, [timeLogs]);

  // SDK init (unchanged)
  useEffect(() => {
    let mounted = true;
    let retryTimeout = null;

    if (enrollingNewEmployee) {
      if (sdkRef.current) {
        try { sdkRef.current.stopAcquisition(); } catch (e) {}
        sdkRef.current = null;
      }
      setStatus('Enrollment in progress...');
      return;
    }

    if (teardownTimerRef.current) {
      clearTimeout(teardownTimerRef.current);
      teardownTimerRef.current = null;
    }

    const initializeSDK = () => {
      if (!mounted) return;

      if (!sdkRef.current) {
        if (!window.Fingerprint || !window.Fingerprint.WebApi) {
          setStatus('error');
          setMessage('Fingerprint SDK script did not load. Retrying in 1 second...');
          retryTimeout = setTimeout(() => {
            if (mounted) initializeSDK();
          }, 1000);
          return;
        }

        const sdk = new window.Fingerprint.WebApi();
        sdkRef.current = sdk;

        sdk.onDeviceConnected = () => {
          if (mounted) { setStatus('ready'); setMessage('Scan your finger to clock in/out.'); }
        };
        sdk.onDeviceDisconnected = () => {
          if (mounted) { setStatus('error'); setMessage('Fingerprint scanner disconnected. Check the USB cable.'); }
        };
        sdk.onCommunicationFailed = () => {
          if (mounted) {
            setStatus('error');
            setMessage('Cannot reach the DigitalPersona agent on this PC. Make sure the Lite Client is installed and running.');
          }
        };
        sdk.onErrorOccurred = (event) => {
          if (mounted) { setStatus('error'); setMessage(`Reader error: ${event.error || 'unknown error'}`); }
        };
        sdk.onSamplesAcquired = handleSample;

        sdk.startAcquisition(window.Fingerprint.SampleFormat.PngImage).then(
          () => {
            if (mounted) { setStatus('ready'); setMessage('Scan your finger to clock in/out.'); }
          },
          (error) => {
            console.error('Failed to start fingerprint acquisition:', error);
            sdkRef.current = null;
            if (mounted) {
              setStatus('error');
              setMessage('Cannot connect to the fingerprint reader. Make sure the DigitalPersona Lite Client is running.');
            }
          }
        );
      }

      if (sdkRef.current) {
        sdkRef.current.onSamplesAcquired = handleSample;
        setStatus('ready');
        setMessage('Scan your finger to clock in/out.');
      }
    };

    initializeSDK();

    return () => {
      mounted = false;
      if (retryTimeout) clearTimeout(retryTimeout);
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
      teardownTimerRef.current = setTimeout(() => {
        if (sdkRef.current) {
          try { sdkRef.current.stopAcquisition(); } catch (e) { /* ignore */ }
          sdkRef.current = null;
        }
        teardownTimerRef.current = null;
      }, STRICT_MODE_TEARDOWN_DELAY_MS);
    };
  }, [handleSample, enrollingNewEmployee]);

  // Go straight to the app root (works even if the kiosk was opened directly).
  const goHome = () => window.location.assign(window.location.pathname);

  const canPickAction = status === 'ready' || status === 'no-match';

  const dateLabel = `${WEEKDAYS[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  const timeLabel = now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  if (status === 'init') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-body text-main font-['Inter',sans-serif] gap-6 p-6">
        <img src="./logo.png" alt="MT World" className="h-16 w-auto object-contain animate-pulse" />
        <div className="w-12 h-12 border-4 border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin" />
        <p className="text-sm text-muted animate-pulse">{message}</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-body text-main p-6 relative overflow-hidden font-[Inter,sans-serif]">
      {/* CSS animations (unchanged) */}
      <style>{`
        @keyframes stampPunch {
          0%   { transform: scale(1); }
          30%  { transform: scale(0.9); }
          60%  { transform: scale(1.04); }
          100% { transform: scale(1); }
        }
        @keyframes ticketSlideIn {
          0%   { transform: translateY(16px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes idlePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .stamp-active { animation: stampPunch 0.5s ease-out; }
        .ticket-stub { animation: ticketSlideIn 0.35s ease-out; }
        .porthole-idle-pulse { animation: idlePulse 2.6s ease-in-out infinite; }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
        @media (prefers-reduced-motion: reduce) {
          .clock-second-hand { transition: none !important; }
          .stamp-active, .ticket-stub, .porthole-idle-pulse, .animate-fadeIn { animation: none !important; }
        }
      `}</style>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,var(--radial-glow),transparent_60%)]" />

      {/* Optional: Back button – placed inside content, not in a fixed header */}
      <button
        onClick={goHome}
        className="absolute top-4 left-4 flex items-center gap-1.5 bg-input hover:bg-card border border-main text-muted hover:text-main py-2 px-3.5 rounded-md text-sm font-medium transition z-10"
      >
        ← Home
      </button>

      <button
        onClick={() => setShowHistory(!showHistory)}
        className="absolute top-4 left-28 flex items-center gap-1.5 bg-input hover:bg-card border border-main text-muted hover:text-main py-2 px-3.5 rounded-md text-sm font-medium transition z-10"
      >
        🕒 {showHistory ? 'Hide History' : "Today's History"}
      </button>

      <div className="absolute top-4 right-4 text-right z-10">
        <p className="text-[10px] uppercase tracking-[0.25em] text-muted">{dateLabel}</p>
        {isOffline && (
          <p className="text-[10px] uppercase tracking-[0.25em] text-[var(--status-red-text)] mt-1">
            📴 Offline — scans still recorded, will sync automatically
          </p>
        )}
      </div>

      <div className="flex flex-row w-full max-w-6xl items-start justify-center mt-8">
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="text-center mb-6">
            <p className="text-[11px] uppercase tracking-[0.35em] text-accent mb-1">MT World</p>
            <h1 className="font-[Oswald,sans-serif] uppercase tracking-wide text-2xl md:text-3xl font-semibold text-accent-dark">
              Attendance Register
            </h1>
          </div>

          <div className="flex flex-col items-center mb-8">
            <AnalogClock now={now} />
            <p className="mt-3 font-[IBM_Plex_Mono,monospace] text-2xl tracking-widest text-accent tabular-nums">
              {timeLabel}
            </p>
          </div>

          <div className="flex justify-center mb-7">
            <img
              src="./fingerprint-icon.png"
              alt="Fingerprint"
              className={`w-36 h-36 object-contain transition-all duration-300 ${
                status === 'scanning'
                  ? 'drop-shadow-[0_0_20px_var(--accent)] animate-pulse'
                  : status === 'matched'
                  ? 'drop-shadow-[0_0_20px_var(--accent-green)]'
                  : status === 'no-match' || status === 'error'
                  ? 'drop-shadow-[0_0_20px_var(--accent-red)]'
                  : ''
              }`}
            />
          </div>

          <div className="min-h-[130px] flex flex-col items-center justify-start w-full max-w-sm">
            {status === 'matched' || status === 'no-match' || status === 'error' ? (
              <div
                className="ticket-stub w-full bg-[var(--bg-card)] text-main rounded-sm px-5 py-4 relative"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(90deg, transparent, transparent 6px, var(--stripe-color) 6px, var(--stripe-color) 7px)',
                  backgroundSize: '100% 1px',
                  backgroundPosition: 'top',
                  backgroundRepeat: 'no-repeat',
                }}
              >
                <div className="absolute -top-2 left-0 right-0 flex justify-between px-3">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <span key={i} className="w-2 h-2 rounded-full bg-[var(--bg-body)]" />
                  ))}
                </div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-muted mb-1">
                  {status === 'matched' ? (message.includes('IN') ? 'Clock-In Ticket' : 'Clock-Out Ticket') : 'Not Recorded'}
                </p>
                {matchedEmployee && (
                  <p className="font-[Oswald,sans-serif] text-xl font-semibold mb-0.5">{matchedEmployee.name}</p>
                )}
                <p className="text-sm text-muted">{message}</p>
                {matchedEmployee && (
                  (() => {
                    const todayKey = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-${String(new Date().getDate()).padStart(2,'0')}`;
                    const log = timeLogs[`${matchedEmployee.id}-${todayKey}`];
                    if (log?.clockIn && !log?.clockOut) {
                      return <p className="text-sm text-accent mt-1">⏳ Currently Clocked In</p>;
                    } else if (log?.clockIn && log?.clockOut) {
                      return <p className="text-sm text-green-600 dark:text-green-400 mt-1">✅ Clocked Out</p>;
                    }
                    return null;
                  })()
                )}
              </div>
            ) : canPickAction ? (
              <>
                <p className="text-muted text-sm mb-4">{message}</p>
                <p className="text-center text-sm text-main">Scan your finger to automatically clock in or out.</p>
              </>
            ) : (
              <p className="text-muted text-sm">{message}</p>
            )}

            {(status === 'no-match' || status === 'error') && !showAdminLogin && !enrollingNewEmployee && (
              <button
                onClick={() => setShowAdminLogin(true)}
                className="mt-4 text-sm underline text-accent hover:text-[var(--accent-hover)]"
              >
                Admin: Enroll New Employee
              </button>
            )}

            {showAdminLogin && (
              <div className="mt-4 bg-card border border-main p-4 rounded-md w-full max-w-xs animate-fadeIn">
                <input
                  type="password"
                  placeholder="Admin password"
                  value={adminPassword}
                  onChange={(e) => { setAdminPassword(e.target.value); setAdminError(''); }}
                  className="w-full py-2 px-3 bg-body border border-main rounded-md text-sm text-main placeholder-muted mb-2 outline-none"
                />
                <input
                  type="text"
                  placeholder="New employee name"
                  value={newEmployeeName}
                  onChange={(e) => setNewEmployeeName(e.target.value)}
                  className="w-full py-2 px-3 bg-body border border-main rounded-md text-sm text-main placeholder-muted mb-2 outline-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleQuickAdd}
                    className="flex-1 bg-[var(--accent-green)] text-white py-2 rounded-md text-sm font-semibold hover:bg-[var(--accent-green-hover)] transition"
                  >
                    Create & Enroll
                  </button>
                  <button
                    onClick={() => setShowAdminLogin(false)}
                    className="flex-1 bg-input text-muted py-2 rounded-md text-sm hover:bg-card transition"
                  >
                    Cancel
                  </button>
                </div>
                {adminError && <p className="text-[var(--accent-red)] text-xs mt-2">{adminError}</p>}
              </div>
            )}
          </div>
        </div>

        {showHistory && (
          <div className="w-72 bg-card border border-main rounded-md p-4 ml-8 animate-fadeIn flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-accent uppercase tracking-wide">Today's Clock History</h3>
              <button
                onClick={() => setShowHistory(false)}
                className="text-muted hover:text-main text-lg leading-none"
              >
                &times;
              </button>
            </div>
            {todayLogs.length === 0 ? (
              <p className="text-muted text-sm">No clock events today.</p>
            ) : (
              <div className="max-h-96 overflow-y-auto space-y-2 custom-scrollbar">
                {todayLogs.map((log, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm border-b border-main pb-1 last:border-0">
                    <span className="text-main truncate">{log.employeeName}</span>
                    <div className="flex gap-2 text-muted flex-shrink-0">
                      <span className="text-[var(--accent-green)] text-xs w-12 text-right">
                        {log.clockIn ? log.clockIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </span>
                      <span className="text-[var(--accent-red)] text-xs w-12 text-right">
                        {log.clockOut ? log.clockOut.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {enrollingNewEmployee && (
        <EnrollFingerprintModal
          employee={enrollingNewEmployee}
          onClose={() => setEnrollingNewEmployee(null)}
        />
      )}
    </div>
  );
}

export default FingerprintKiosk;