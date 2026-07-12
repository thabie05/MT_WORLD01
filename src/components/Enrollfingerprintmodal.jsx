import React, { useEffect, useRef, useState } from 'react';

// See FingerprintKiosk.js for the full explanation of this approach — this
// uses the CDN-loaded window.Fingerprint.WebApi (from @digitalpersona/websdk
// + @digitalpersona/fingerprint script tags in public/index.html) instead of
// needing to locate a websdk.client.ui.min.js file locally.

const MATCHER_API = 'http://127.0.0.1:4000';
const SAMPLES_NEEDED = 3; // multiple scans make matching more reliable

function EnrollFingerprintModal({ employee, onClose }) {
  const [status, setStatus] = useState('init'); // init | ready | scanning | done | error
  const [message, setMessage] = useState('Starting fingerprint reader…');
  const [samplesCaptured, setSamplesCaptured] = useState(0);

  const sdkRef = useRef(null);
  const capturingRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    function init() {
      if (!window.Fingerprint || !window.Fingerprint.WebApi) {
        setStatus('error');
        setMessage('Fingerprint SDK script did not load. Check the <script> tags in public/index.html.');
        return;
      }

      const sdk = new window.Fingerprint.WebApi();
      sdkRef.current = sdk;

      sdk.onDeviceConnected = () => {
        if (mounted) { setStatus('ready'); setMessage(`Scan finger 1 of ${SAMPLES_NEEDED}.`); }
      };
      sdk.onDeviceDisconnected = () => {
        if (mounted) { setStatus('error'); setMessage('Scanner disconnected.'); }
      };
      sdk.onCommunicationFailed = () => {
        if (mounted) { setStatus('error'); setMessage('Cannot reach the DigitalPersona agent on this PC.'); }
      };
      sdk.onErrorOccurred = (event) => {
        if (mounted) { setStatus('error'); setMessage(`Reader error: ${event.error || 'unknown error'}`); }
      };

      sdk.onSamplesAcquired = async (event) => {
        if (capturingRef.current) return; // ignore double-fires while a scan is being saved
        capturingRef.current = true;
        try {
          const parsed = typeof event.samples === 'string' ? JSON.parse(event.samples) : event.samples;
          const rawSample = Array.isArray(parsed) ? parsed[0] : parsed;
          if (!rawSample) throw new Error('No sample data received.');

          const imageBase64 = window.Fingerprint.b64UrlTo64(rawSample);

          const res = await fetch(`${MATCHER_API}/enroll`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeId: employee.id, imageBase64 }),
          });
          const result = await res.json();
          if (!result.success) throw new Error(result.error || 'Enrollment failed.');

          setSamplesCaptured((prev) => {
            const next = prev + 1;
            if (next >= SAMPLES_NEEDED) {
              setStatus('done');
              setMessage(`Done! ${employee.name}'s fingerprint is enrolled.`);
            } else {
              setStatus('ready');
              setMessage(`Good scan. Now scan finger ${next + 1} of ${SAMPLES_NEEDED}.`);
            }
            return next;
          });
        } catch (err) {
          console.error('Enrollment sample failed:', err);
          setStatus('error');
          setMessage('Could not save that scan. Try again.');
        } finally {
          capturingRef.current = false;
        }
      };

      sdk.startAcquisition(window.Fingerprint.SampleFormat.PngImage).then(
        () => { if (mounted) { setStatus('ready'); setMessage(`Scan finger 1 of ${SAMPLES_NEEDED}.`); } },
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee.id]);

  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-[2000] p-5" onClick={onClose}>
      <div className="bg-white rounded-2xl p-7 w-full max-w-md shadow-2xl text-center" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-slate-900 mb-1">🖐️ Enroll Fingerprint</h2>
        <p className="text-slate-500 text-sm mb-5">{employee.name}</p>

        <div className={`w-28 h-28 mx-auto rounded-full flex items-center justify-center text-5xl mb-5 border-4 ${
          status === 'done' ? 'border-green-400 bg-green-50' :
          status === 'error' ? 'border-red-400 bg-red-50' :
          'border-blue-300 bg-blue-50 animate-pulse'
        }`}>
          🖐️
        </div>

        <p className="text-slate-700 mb-5">{message}</p>

        <div className="flex justify-center gap-1.5 mb-5">
          {Array.from({ length: SAMPLES_NEEDED }).map((_, i) => (
            <span key={i} className={`w-3 h-3 rounded-full ${i < samplesCaptured ? 'bg-green-500' : 'bg-slate-200'}`} />
          ))}
        </div>

        <button onClick={onClose} className="py-2.5 px-5 bg-slate-100 border border-slate-200 rounded-xl font-semibold text-sm text-slate-600 hover:bg-slate-200 transition">
          {status === 'done' ? 'Close' : 'Cancel'}
        </button>
      </div>
    </div>
  );
}

export default EnrollFingerprintModal;