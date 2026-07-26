import { doc, updateDoc, getDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';

const pad = (n) => String(n).padStart(2, '0');

export const dateKeyFor = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/**
 * Records a fingerprint action (start or end shift) with validation.
 * Returns { action, time, clockInTime, clockOutTime, error }
 */
export async function recordFingerprintAction(employee, action) {
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

  if (action === 'start') {
    if (existingLog?.clockIn) {
      return {
        error: `Your shift already started at ${new Date(existingLog.clockIn).toLocaleTimeString()}`,
        clockInTime: new Date(existingLog.clockIn),
      };
    }
    await updateDoc(docRef, {
      [`timeLogs.${logKey}.clockIn`]: nowIso,
      [`attendance.${employee.id}.${dateKey}`]: 'present',
      history: arrayUnion({ ...baseHistoryEntry, status: 'Present (fingerprint clock-in)' }),
    });
    return { action: 'clock-in', time: now };
  }

  if (action === 'end') {
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
    await updateDoc(docRef, {
      [`timeLogs.${logKey}.clockOut`]: nowIso,
      history: arrayUnion({ ...baseHistoryEntry, status: 'Clock-out (fingerprint)' }),
    });
    return { action: 'clock-out', time: now, clockInTime: new Date(existingLog.clockIn) };
  }

  return { error: 'Invalid action.' };
}

/**
 * Finds every timeLogs entry from a PAST day (strictly before today) that
 * has a clockIn but no clockOut — meaning someone forgot to end their
 * shift — and closes it out at 23:59:59 of that day.
 *
 * Safe to call repeatedly (it's a no-op once everything is already closed
 * out) and safe to call from multiple places at once (each write only
 * touches the specific stale timeLogs entries found, via the same targeted
 * dot-path pattern used everywhere else, plus a single arrayUnion of
 * history entries — no whole-document overwrite).
 *
 * Call this on load from anywhere that might be open around midnight
 * (the kiosk screen, which tends to run unattended all day) as well as
 * anywhere an admin might load the app after a missed midnight (the main
 * AttendanceRegister view) — there's no server-side cron here, so this is
 * a "catch up whenever something is open" approach rather than a guaranteed
 * exact-midnight trigger. If you're on Firebase's Blaze plan, a scheduled
 * Cloud Function calling the same logic would guarantee exact timing even
 * with nothing open — ask if you want that built instead/as well.
 */
export async function closeStaleShifts() {
  const docRef = doc(db, 'rollcall', 'data');
  const snap = await getDoc(docRef);
  if (!snap.exists()) return { closed: 0 };

  const data = snap.data();
  const timeLogs = data.timeLogs || {};
  const employees = data.employees || [];
  const nameById = {};
  employees.forEach((e) => { nameById[e.id] = e.name; });

  const todayKey = dateKeyFor(new Date());
  const updates = {};
  const historyEntries = [];

  for (const logKey of Object.keys(timeLogs)) {
    const entry = timeLogs[logKey];
    if (!entry || !entry.clockIn || entry.clockOut) continue; // only open shifts

    // logKey = "{employeeId}-{YYYY-MM-DD}" — the date is always the last
    // 10 characters, regardless of what characters are in employeeId.
    const dateKey = logKey.slice(-10);
    if (dateKey >= todayKey) continue; // today (or, shouldn't happen, future) — still an active shift, leave it

    const employeeId = logKey.slice(0, logKey.length - 11); // strip "-YYYY-MM-DD"
    const midnightIso = new Date(`${dateKey}T23:59:59`).toISOString();

    updates[`timeLogs.${logKey}.clockOut`] = midnightIso;
    updates[`timeLogs.${logKey}.autoClockOut`] = true;
    historyEntries.push({
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

  if (historyEntries.length === 0) return { closed: 0 };

  updates.history = arrayUnion(...historyEntries);
  await updateDoc(docRef, updates);
  return { closed: historyEntries.length };
}