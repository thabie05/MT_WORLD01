import React, { useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

function EnrollFingerprintModal({ employee, onClose }) {
  const [scanning, setScanning] = useState(false);
  const [status, setStatus] = useState('');

  // Simulate fingerprint capture – replace with actual SDK call
  const handleEnroll = async () => {
    setScanning(true);
    setStatus('Place your finger on the scanner...');
    // Simulate async capture
    setTimeout(() => {
      // In real implementation, call your Electron IPC or matcher API
      const dummyTemplate = 'dummy_fingerprint_template_base64';
      // Save to Firestore
      const docRef = doc(db, 'fingerprints', employee.id);
      setDoc(docRef, {
        employeeId: employee.id,
        template: dummyTemplate,
        enrolledAt: new Date().toISOString(),
      })
        .then(() => {
          setStatus('✅ Fingerprint enrolled successfully!');
          setTimeout(() => onClose(), 1500);
        })
        .catch((err) => {
          setStatus(`❌ Error: ${err.message}`);
          setScanning(false);
        });
    }, 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-[2000] p-5" onClick={onClose}>
      <div
        className="bg-card rounded-2xl p-6 w-full max-w-md shadow-2xl border border-main"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-accent mb-2">🖐️ Enroll Fingerprint</h2>
        <p className="text-muted text-sm mb-4">
          Enrolling: <strong className="text-main">{employee.name}</strong>
        </p>

        <div className="flex justify-center my-6">
          <div
            className={`w-28 h-28 rounded-full border-4 flex items-center justify-center text-4xl transition-all ${
              scanning
                ? 'border-[var(--accent-green)] bg-[var(--bg-green-soft)] animate-pulse'
                : 'border-main bg-input'
            }`}
          >
            {scanning ? '🖐️' : '👆'}
          </div>
        </div>

        <p className="text-center text-sm text-muted mb-4 h-6">{status}</p>

        <button
          onClick={handleEnroll}
          disabled={scanning}
          className="w-full py-3 btn-accent rounded-xl font-semibold text-sm hover:opacity-90 transition disabled:opacity-50"
        >
          {scanning ? 'Scanning...' : 'Start Enrollment'}
        </button>

        <button
          onClick={onClose}
          disabled={scanning}
          className="w-full mt-2 py-2.5 bg-input text-muted rounded-xl font-medium hover:bg-card transition disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default EnrollFingerprintModal;