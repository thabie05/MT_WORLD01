import React, { useEffect, useRef, useState, useCallback } from 'react';
import { doc, collection, onSnapshot, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { recordFingerprintAction } from '../utils/attendanceWrites';
import EnrollFingerprintModal from './EnrollFingerprintModal';

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
    <svg viewBox="0 0 200 200" className="w-40 h-40 md:w-48 md:h-48 drop-shadow-[0_4px_20px_rgba(201,164,92,0.15)]">
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
  const [status, setStatus] = useState('init');
  const [message, setMessage] = useState('Starting fingerprint reader…');
  const [matchedEmployee, setMatchedEmployee] = useState(null);
  const [selectedAction, setSelectedAction] = useState(null);
  const [now, setNow] = useState(new Date());
  const [stampPulse, setStampPulse] = useState(false);

  const [employees, setEmployees] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [todayLogs, setTodayLogs] = useState([]);

  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [enrollingNewEmployee, setEnrollingNewEmployee] = useState(null);

  const sdkRef = useRef(null);
  const teardownTimerRef = useRef(null);
  const employeesRef = useRef(employees);
  const selectedActionRef = useRef(null);

  useEffect(() => { employeesRef.current = employees; }, [employees]);
  useEffect(() => { selectedActionRef.current = selectedAction; }, [selectedAction]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Real-time listener for employees and today's time logs.
  // NOTE: filters out soft-deleted employees — otherwise a trashed
  // employee's enrolled fingerprint would still be able to clock in/out.
  useEffect(() => {
    const docRef = doc(db, 'rollcall', 'data');
    const unsubscribe = onSnapshot(
      docRef,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        const activeEmployees = (data.employees || []).filter((emp) => !emp.isDeleted);
        setEmployees(activeEmployees);

        const timeLogs = data.timeLogs || {};
        const todayKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
        const employeeMap = {};
        activeEmployees.forEach((emp) => {
          employeeMap[emp.id] = emp.name;
        });

        const logs = [];
        for (const key of Object.keys(timeLogs)) {
          if (!key.endsWith(todayKey)) continue;
          const entry = timeLogs[key];
          const employeeId = key.split('-')[0];
          const employeeName = employeeMap[employeeId];
          if (!employeeName) continue; // skip logs belonging to deleted employees
          logs.push({
            employeeId,
            employeeName,
            clockIn: entry.clockIn ? new Date(entry.clockIn) : null,
            clockOut: entry.clockOut ? new Date(entry.clockOut) : null,
          });
        }
        logs.sort(
          (a, b) =>
            (a.clockIn || 0) - (b.clockIn || 0) ||
            a.employeeName.localeCompare(b.employeeName)
        );
        setTodayLogs(logs);
      },
      (err) => console.error('Failed to listen to data:', err)
    );
    return () => unsubscribe();
  }, []);

  // Keeps the local Java matcher's template cache in sync with Firestore.
  // The matcher has no direct Firestore access (no credentials set up for
  // that), so whenever the `fingerprints` collection changes — including on
  // kiosk startup — we push every employee's templates down to it. Without
  // this, restarting the matcher process would make it "forget" everyone
  // enrolled before that restart.
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
    setMessage('Select your action, then scan your finger.');
    setMatchedEmployee(null);
    setSelectedAction(null);
  };

  const handleQuickAdd = async () => {
    if (adminPassword !== 'admin123') {
      setAdminError('Incorrect password');
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
    const action = selectedActionRef.current;
    if (!action) {
      setMessage('Please select Start Shift or End Shift first.');
      return;
    }

    setStatus('scanning');
    setMessage('Checking fingerprint…');
    try {
      const parsed =
        typeof event.samples === 'string'
          ? JSON.parse(event.samples)
          : event.samples;
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
        const employee = employeesRef.current.find(
          (e) => e.id === result.employeeId
        );
        if (!employee) {
          setStatus('no-match');
          setMessage(
            'Fingerprint matched an employee ID that no longer exists. Ask an admin to re-enroll.'
          );
          setTimeout(() => {
            setStatus('ready');
            setMessage('Scan your finger to try again.');
            setMatchedEmployee(null);
          }, RESULT_DISPLAY_MS);
        } else {
          setMatchedEmployee(employee);
          const clockResult = await recordFingerprintAction(employee, action);
          setStampPulse(true);
          setTimeout(() => setStampPulse(false), 500);
          if (clockResult.error) {
            setStatus('no-match');
            setMessage(`${employee.name}: ${clockResult.error}`);
            setTimeout(() => {
              setStatus('ready');
              setMessage('Scan your finger to try again.');
              setMatchedEmployee(null);
            }, RESULT_DISPLAY_MS);
          } else {
            setStatus('matched');
            if (clockResult.action === 'clock-in') {
              setMessage(`Clocked IN at ${clockResult.time.toLocaleTimeString()}`);
            } else {
              setMessage(`Clocked OUT at ${clockResult.time.toLocaleTimeString()}`);
            }
            setTimeout(() => {
              resetToSelection();
            }, RESULT_DISPLAY_MS);
          }
        }
      } else {
        setStatus('no-match');
        setMessage('Fingerprint not recognized. Try again.');
        setTimeout(() => {
          setStatus('ready');
          setMessage('Scan your finger to try again.');
          setMatchedEmployee(null);
        }, RESULT_DISPLAY_MS);
      }
    } catch (err) {
      console.error('Fingerprint identify failed:', err);
      setStatus('error');
      setMessage('Could not reach the fingerprint matching service. Try again.');
      setTimeout(() => {
        setStatus('ready');
        setMessage('Scan your finger to try again.');
        setMatchedEmployee(null);
      }, RESULT_DISPLAY_MS);
    }
  }, []);

  // ========== SDK INITIALIZATION WITH ENROLLMENT GUARD & AUTO RETRY ==========
  useEffect(() => {
    let mounted = true;
    let retryTimeout = null;

    // Pause the kiosk reader while the enrollment modal owns the scanner.
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
          if (mounted) { setStatus('ready'); setMessage('Select your action, then scan your finger.'); }
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
            if (mounted) { setStatus('ready'); setMessage('Select your action, then scan your finger.'); }
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
      } else {
        setStatus('ready');
        setMessage('Select your action, then scan your finger.');
      }
    };

    initializeSDK();

    return () => {
      mounted = false;
      if (retryTimeout) clearTimeout(retryTimeout);
      teardownTimerRef.current = setTimeout(() => {
        if (sdkRef.current) {
          try { sdkRef.current.stopAcquisition(); } catch (e) { /* ignore */ }
          sdkRef.current = null;
        }
        teardownTimerRef.current = null;
      }, STRICT_MODE_TEARDOWN_DELAY_MS);
    };
  }, [handleSample, enrollingNewEmployee]);

  const goHome = () => {
    window.location.href = window.location.origin + window.location.pathname;
  };

  const canPickAction = status === 'ready' || status === 'no-match';

  const portholeGlow =
    status === 'matched'
      ? 'border-[var(--accent-green)] shadow-[0_0_40px_var(--shadow-green)]'
      : status === 'no-match' || status === 'error'
      ? 'border-[var(--accent-red)] shadow-[0_0_40px_var(--shadow-red)]'
      : status === 'scanning'
      ? 'border-[var(--accent)] shadow-[0_0_40px_var(--shadow-gold)]'
      : selectedAction
      ? 'border-[var(--accent)] shadow-[0_0_25px_var(--shadow-gold)]'
      : 'border-[var(--border-strong)]';

  const dateLabel = `${WEEKDAYS[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  const timeLabel = now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-body text-main p-6 relative overflow-hidden font-[Inter,sans-serif]">
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

      <button
        onClick={goHome}
        className="absolute top-5 left-5 flex items-center gap-1.5 bg-input hover:bg-card border border-main text-muted hover:text-main py-2 px-3.5 rounded-md text-sm font-medium transition z-10"
      >
        ← Home
      </button>

      <button
        onClick={() => setShowHistory(!showHistory)}
        className="absolute top-5 left-32 flex items-center gap-1.5 bg-input hover:bg-card border border-main text-muted hover:text-main py-2 px-3.5 rounded-md text-sm font-medium transition z-10"
      >
        🕒 {showHistory ? 'Hide History' : "Today's History"}
      </button>

      <div className="absolute top-5 right-5 text-right z-10">
        <p className="text-[10px] uppercase tracking-[0.25em] text-muted">
          {dateLabel}
        </p>
      </div>

      <div className="flex flex-row w-full max-w-6xl items-start justify-center mt-10">
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="text-center mb-6">
            <p className="text-[11px] uppercase tracking-[0.35em] text-accent mb-1">MT World</p>
            <h1 className="font-[Oswald,sans-serif] uppercase tracking-wide text-2xl md:text-3xl font-semibold text-accent-dark">Attendance Register</h1>
          </div>

          <div className="flex flex-col items-center mb-8">
            <AnalogClock now={now} />
            <p className="mt-3 font-[IBM_Plex_Mono,monospace] text-2xl tracking-widest text-accent tabular-nums">
              {timeLabel}
            </p>
          </div>

          <div
            className={`relative w-36 h-36 rounded-full flex items-center justify-center border-[3px] bg-card transition-all duration-300 mb-7 ${portholeGlow} ${stampPulse ? 'stamp-active' : ''} ${status === 'ready' && !selectedAction ? 'porthole-idle-pulse' : ''}`}
          >
            <div className="absolute inset-2 rounded-full border border-[var(--border-strong)]" />
            <span className="text-5xl">🖐️</span>
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
                  {status === 'matched'
                    ? selectedAction === 'start' || message.includes('IN')
                      ? 'Clock-In Ticket'
                      : 'Clock-Out Ticket'
                    : 'Not Recorded'}
                </p>
                {matchedEmployee && (
                  <p className="font-[Oswald,sans-serif] text-xl font-semibold mb-0.5">
                    {matchedEmployee.name}
                  </p>
                )}
                <p className="text-sm text-muted">{message}</p>
              </div>
            ) : canPickAction ? (
              <>
                <p className="text-muted text-sm mb-4">{message}</p>
                {!selectedAction ? (
                  <div className="flex gap-3 w-full">
                    <button
                      onClick={() => {
                        setSelectedAction('start');
                        setMessage('Scan your finger to start your shift.');
                      }}
                      className="flex-1 flex flex-col items-center gap-1 bg-[var(--bg-green-soft)] hover:bg-[var(--bg-green-soft)]/80 border-l-4 border-[var(--accent-green)] py-4 px-4 rounded-md transition"
                    >
                      <span className="text-2xl">🟢</span>
                      <span className="font-[Oswald,sans-serif] uppercase tracking-wide text-sm font-medium text-[var(--accent-green)]">
                        Start Shift
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        setSelectedAction('end');
                        setMessage('Scan your finger to end your shift.');
                      }}
                      className="flex-1 flex flex-col items-center gap-1 bg-[var(--bg-red-soft)] hover:bg-[var(--bg-red-soft)]/80 border-l-4 border-[var(--accent-red)] py-4 px-4 rounded-md transition"
                    >
                      <span className="text-2xl">🔴</span>
                      <span className="font-[Oswald,sans-serif] uppercase tracking-wide text-sm font-medium text-[var(--accent-red)]">
                        End Shift
                      </span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setSelectedAction(null);
                      setMessage('Select your action, then scan your finger.');
                    }}
                    className="text-muted hover:text-main text-sm underline transition"
                  >
                    Cancel
                  </button>
                )}
              </>
            ) : (
              <p className="text-muted text-sm">{message}</p>
            )}

            {(status === 'no-match' || status === 'error') &&
              !showAdminLogin &&
              !enrollingNewEmployee && (
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
                  onChange={(e) => {
                    setAdminPassword(e.target.value);
                    setAdminError('');
                  }}
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
                {adminError && (
                  <p className="text-[var(--accent-red)] text-xs mt-2">
                    {adminError}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {showHistory && (
          <div className="w-72 bg-card border border-main rounded-md p-4 ml-8 animate-fadeIn flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-accent uppercase tracking-wide">
                Today's Clock History
              </h3>
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
                  <div
                    key={idx}
                    className="flex items-center justify-between text-sm border-b border-main pb-1 last:border-0"
                  >
                    <span className="text-main truncate">{log.employeeName}</span>
                    <div className="flex gap-2 text-muted flex-shrink-0">
                      <span className="text-[var(--accent-green)] text-xs w-12 text-right">
                        {log.clockIn
                          ? log.clockIn.toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </span>
                      <span className="text-[var(--accent-red)] text-xs w-12 text-right">
                        {log.clockOut
                          ? log.clockOut.toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
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