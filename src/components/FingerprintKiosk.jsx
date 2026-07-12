import React, { useEffect, useRef, useState, useCallback } from 'react';
import { recordFingerprintClock } from '../utils/attendanceWrites';

const MATCHER_API = 'http://127.0.0.1:4000';
const RESULT_DISPLAY_MS = 3500;

function FingerprintKiosk({ employees }) {
  const [status, setStatus] = useState('init');
  const [message, setMessage] = useState('Starting fingerprint reader…');
  const [matchedEmployee, setMatchedEmployee] = useState(null);

  const sdkRef = useRef(null);
  const employeesRef = useRef(employees);

  useEffect(() => { employeesRef.current = employees; }, [employees]);

  const handleSample = useCallback(async (event) => {
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
        } else {
          setMatchedEmployee(employee);
          const clockResult = await recordFingerprintClock(employee);
          if (clockResult.action === 'clock-in') {
            setMessage(`Welcome, ${employee.name}! Clocked IN at ${clockResult.time.toLocaleTimeString()}.`);
          } else if (clockResult.action === 'clock-out') {
            setMessage(`Goodbye, ${employee.name}! Clocked OUT at ${clockResult.time.toLocaleTimeString()}.`);
          } else {
            setMessage(`${employee.name}, you've already clocked in and out today.`);
          }
          setStatus('matched');
        }
      } else {
        setStatus('no-match');
        setMessage("Fingerprint not recognized. If you're a new employee, ask an admin to enroll your fingerprint.");
      }
    } catch (err) {
      console.error('Fingerprint identify failed:', err);
      setStatus('error');
      setMessage('Could not reach the fingerprint matching service. Is it running on this PC?');
    } finally {
      setTimeout(() => {
        setStatus('ready');
        setMessage('Place your finger on the scanner to clock in or out.');
        setMatchedEmployee(null);
      }, RESULT_DISPLAY_MS);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    function init() {
      if (!window.Fingerprint || !window.Fingerprint.WebApi) {
        setStatus('error');
        setMessage('Fingerprint SDK script did not load. Check the <script> tags in public/index.html and your internet/CDN access.');
        return;
      }

      const sdk = new window.Fingerprint.WebApi();
      sdkRef.current = sdk;

      sdk.onDeviceConnected = () => {
        if (mounted) { setStatus('ready'); setMessage('Place your finger on the scanner to clock in or out.'); }
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
      sdk.onQualityReported = () => { /* known limitation noted in SETUP */ };
      sdk.onSamplesAcquired = handleSample;

      sdk.startAcquisition(window.Fingerprint.SampleFormat.PngImage).then(
        () => { if (mounted) { setStatus('ready'); setMessage('Place your finger on the scanner to clock in or out.'); } },
        (error) => {
          console.error('Failed to start fingerprint acquisition:', error);
          if (mounted) {
            setStatus('error');
            setMessage('Cannot connect to the fingerprint reader. Make sure the DigitalPersona Lite Client is running and the scanner is plugged in.');
          }
        }
      );
    }

    init();

    return () => {
      mounted = false;
      if (sdkRef.current) {
        try { sdkRef.current.stopAcquisition(); } catch (e) { /* ignore */ }
      }
    };
  }, [handleSample]);

  const ringColor =
    status === 'matched' ? 'border-green-400 bg-green-400/10' :
    status === 'no-match' || status === 'error' ? 'border-red-400 bg-red-400/10' :
    status === 'scanning' ? 'border-amber-400 bg-amber-400/10 animate-pulse' :
    'border-white/30 bg-white/5';

  const handleGoHome = () => {
    // Navigate back to the main app (remove the ?kiosk=1 query parameter)
    window.location.href = window.location.origin + window.location.pathname;
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-8 text-center relative">
      {/* Home button – top left */}
      <button
        onClick={handleGoHome}
        className="absolute top-4 left-4 flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white transition-colors"
      >
        <span className="text-lg">🏠</span>
        <span className="text-sm font-medium">Home</span>
      </button>

      <h1 className="text-3xl font-bold mb-2 tracking-wide">MT WORLD Clock In / Out</h1>
      <p className="text-white/60 mb-10">Fingerprint Kiosk</p>

      <div className={`w-40 h-40 rounded-full flex items-center justify-center text-6xl mb-8 border-4 transition-colors ${ringColor}`}>
        🖐️
      </div>

      {matchedEmployee && <p className="text-2xl font-semibold mb-2">{matchedEmployee.name}</p>}
      <p className="text-lg max-w-md">{message}</p>
    </div>
  );
}

export default FingerprintKiosk;