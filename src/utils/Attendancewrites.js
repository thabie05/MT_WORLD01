import { doc, updateDoc, getDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';

const pad = (n) => String(n).padStart(2, '0');

export const dateKeyFor = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/**
 * Records a fingerprint scan as a clock-in (first scan of the day) or
 * clock-out (second scan of the day) for the given employee, "now".
 *
 * Uses the same safe, targeted dot-path Firestore updates as the rest of
 * the app (see AttendanceRegister.js) — a kiosk scan only ever touches this
 * employee's own fields for today, so it can never clobber another user's
 * concurrent edit elsewhere in the document.
 *
 * Adds a new top-level `timeLogs` field to the rollcall/data document,
 * keyed the same way as `edits`/`notes`: `${employeeId}-${dateKey}`, each
 * holding `{ clockIn, clockOut }` ISO timestamp strings. This is additive —
 * it doesn't change or remove any existing field the rest of the app reads.
 */
export async function recordFingerprintClock(employee) {
  const now = new Date();
  const dateKey = dateKeyFor(now);
  const logKey = `${employee.id}-${dateKey}`;
  const docRef = doc(db, 'rollcall', 'data');

  const snap = await getDoc(docRef);
  const existingLog = snap.exists() ? (snap.data().timeLogs || {})[logKey] : undefined;
  const nowIso = now.toISOString();

  const baseHistoryEntry = {
    id: Date.now(),
    employeeId: employee.id,
    employeeName: employee.name,
    day: now.getDate(),
    date: dateKey,
    note: '',
    editor: 'Fingerprint Kiosk',
    editedAt: nowIso,
  };

  if (!existingLog || !existingLog.clockIn) {
    await updateDoc(docRef, {
      [`timeLogs.${logKey}.clockIn`]: nowIso,
      [`attendance.${employee.id}.${dateKey}`]: 'present',
      history: arrayUnion({ ...baseHistoryEntry, status: 'Present (fingerprint clock-in)' }),
    });
    return { action: 'clock-in', time: now };
  }

  if (!existingLog.clockOut) {
    await updateDoc(docRef, {
      [`timeLogs.${logKey}.clockOut`]: nowIso,
      history: arrayUnion({ ...baseHistoryEntry, status: 'Clock-out (fingerprint)' }),
    });
    return { action: 'clock-out', time: now, clockInTime: new Date(existingLog.clockIn) };
  }

  return {
    action: 'already-done',
    clockInTime: new Date(existingLog.clockIn),
    clockOutTime: new Date(existingLog.clockOut),
  };
}