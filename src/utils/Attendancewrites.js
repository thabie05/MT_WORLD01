import { runTransaction, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { dataRef, monthDocRef, historyDocRef, monthKeyOf } from './rollcallStore';

const pad = (n) => String(n).padStart(2, '0');
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export const dateKeyFor = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/**
 * Splits a timeLogs key "{employeeId}-{YYYY-MM-DD}" into its parts. The date is
 * always the last 10 characters, so ids containing hyphens are handled.
 * Returns null for malformed keys.
 */
export function parseLogKey(logKey) {
  if (typeof logKey !== 'string' || logKey.length < 12) return null;
  const dateKey = logKey.slice(-10);
  if (logKey[logKey.length - 11] !== '-' || !DATE_KEY.test(dateKey)) return null;
  return { employeeId: logKey.slice(0, -11), dateKey };
}

// The kiosk UI uses 'clock-in' / 'clock-out'; older callers use 'start' / 'end'. Accept both.
const normaliseAction = (action) =>
  action === 'clock-in' ? 'start' : action === 'clock-out' ? 'end' : action;

/**
 * Records a fingerprint action (start or end shift) with validation.
 * Runs in a Firestore transaction, so two near-simultaneous scans can never both
 * clock the same person in (or out). Data lives in the monthly documents
 * (see rollcallStore.js).
 * Returns { action, time, clockInTime, clockOutTime, error }
 */
export async function recordFingerprintAction(employee, rawAction) {
  const action = normaliseAction(rawAction);
  const now = new Date();
  const dateKey = dateKeyFor(now);
  const logKey = `${employee.id}-${dateKey}`;
  const nowIso = now.toISOString();
  const monthRef = monthDocRef(dateKey);
  const histRef = historyDocRef(dateKey);

  if (action !== 'start' && action !== 'end') return { error: 'Invalid action.' };

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

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(monthRef);
    const existingLog = snap.exists() ? (snap.data().timeLogs || {})[logKey] : undefined;

    if (action === 'start') {
      if (existingLog?.clockIn) {
        return {
          error: `Your shift already started at ${new Date(existingLog.clockIn).toLocaleTimeString()}`,
          clockInTime: new Date(existingLog.clockIn),
        };
      }
      tx.set(monthRef, {
        timeLogs: { [logKey]: { clockIn: nowIso } },
        attendance: { [employee.id]: { [dateKey]: 'present' } },
      }, { merge: true });
      tx.set(histRef, { history: arrayUnion({ ...baseHistoryEntry, status: 'Present (fingerprint clock-in)' }) }, { merge: true });
      return { action: 'clock-in', time: now };
    }

    if (!existingLog?.clockIn) {
      return { error: 'You have not started your shift today.' };
    }
    if (existingLog.clockOut) {
      return {
        error: `Your shift already ended at ${new Date(existingLog.clockOut).toLocaleTimeString()}`,
        clockInTime: new Date(existingLog.clockIn),
        clockOutTime: new Date(existingLog.clockOut),
      };
    }
    tx.set(monthRef, { timeLogs: { [logKey]: { clockOut: nowIso } } }, { merge: true });
    tx.set(histRef, { history: arrayUnion({ ...baseHistoryEntry, status: 'Clock-out (fingerprint)' }) }, { merge: true });
    return { action: 'clock-out', time: now, clockInTime: new Date(existingLog.clockIn) };
  });
}

/**
 * Closes (at 23:59:59 of that day) every shift from a PAST day that has a clockIn
 * but no clockOut. Looks at the current month and the two before it (a shift left
 * open for longer than that is not expected - this runs on every kiosk/register
 * load). Runs in a transaction, so several open screens calling it at once never
 * close the same shift - or write its history entry - twice.
 */
export async function closeStaleShifts() {
  const todayKey = dateKeyFor(new Date());
  const monthKeys = [];
  const cursor = new Date();
  cursor.setDate(1);
  for (let i = 0; i < 3; i++) {
    monthKeys.push(monthKeyOf(dateKeyFor(cursor)));
    cursor.setMonth(cursor.getMonth() - 1);
  }

  return runTransaction(db, async (tx) => {
    const empSnap = await tx.get(dataRef());
    const nameById = {};
    ((empSnap.exists() ? empSnap.data().employees : []) || []).forEach((e) => { nameById[e.id] = e.name; });

    const monthSnaps = [];
    for (const ym of monthKeys) monthSnaps.push([ym, await tx.get(monthDocRef(ym))]);

    let closed = 0;
    const writes = [];
    for (const [ym, snap] of monthSnaps) {
      if (!snap.exists()) continue;
      const timeLogs = snap.data().timeLogs || {};
      const logUpdates = {};
      const entries = [];

      for (const logKey of Object.keys(timeLogs)) {
        const entry = timeLogs[logKey];
        if (!entry || !entry.clockIn || entry.clockOut) continue; // only open shifts
        const parsed = parseLogKey(logKey);
        if (!parsed) continue;
        const { employeeId, dateKey } = parsed;
        if (dateKey >= todayKey) continue; // today's shift is still active

        const midnightIso = new Date(`${dateKey}T23:59:59`).toISOString();
        logUpdates[logKey] = { clockOut: midnightIso, autoClockOut: true };
        entries.push({
          id: Date.now() + Math.random(),
          employeeId,
          employeeName: nameById[employeeId] || 'Unknown',
          day: Number(dateKey.slice(-2)),
          date: dateKey,
          status: 'Auto clock-out (forgot to end shift)',
          note: '',
          editor: 'System (midnight auto clock-out)',
          editedAt: midnightIso,
        });
      }
      if (entries.length) writes.push({ ym, logUpdates, entries });
    }

    for (const { ym, logUpdates, entries } of writes) {
      tx.set(monthDocRef(ym), { timeLogs: logUpdates }, { merge: true });
      tx.set(historyDocRef(ym), { history: arrayUnion(...entries) }, { merge: true });
      closed += entries.length;
    }
    return { closed };
  });
}