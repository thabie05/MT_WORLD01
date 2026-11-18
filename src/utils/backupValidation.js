// Sanity-checks a backup file before it is allowed anywhere near Firestore.
// Returns null when the backup looks valid, otherwise a short human-readable reason.

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES = new Set(['present', 'absent', 'late', 'early', 'off', true, false]);
const SECTIONS = ['employees', 'attendance', 'edits', 'history', 'notes', 'timeLogs'];
const validIso = (v) => v === undefined || v === null || (typeof v === 'string' && !Number.isNaN(Date.parse(v)));

export function validateBackup(data) {
  if (!isPlainObject(data)) return 'the file is not a backup object.';
  if (!SECTIONS.some((k) => k in data)) return 'none of the expected sections were found.';

  if ('employees' in data) {
    if (!Array.isArray(data.employees)) return '"employees" must be a list.';
    const seen = new Set();
    for (const e of data.employees) {
      const okId = typeof e?.id === 'string' ? e.id !== '' : Number.isFinite(e?.id);
      if (!isPlainObject(e) || !okId || typeof e.name !== 'string' || !e.name.trim()) {
        return 'an employee entry is missing its id or name.';
      }
      if (seen.has(String(e.id))) return `duplicate employee id "${e.id}".`;
      seen.add(String(e.id));
    }
  }

  if ('attendance' in data) {
    if (!isPlainObject(data.attendance)) return '"attendance" must be an object.';
    for (const [empId, days] of Object.entries(data.attendance)) {
      if (!isPlainObject(days)) return `attendance for "${empId}" is not an object.`;
      for (const [dateKey, status] of Object.entries(days)) {
        if (!DATE_KEY.test(dateKey)) return `attendance has an invalid date "${dateKey}".`;
        if (!STATUSES.has(status)) return `attendance has an unknown status "${String(status)}".`;
      }
    }
  }

  if ('edits' in data) {
    if (!isPlainObject(data.edits)) return '"edits" must be an object.';
    for (const v of Object.values(data.edits)) {
      if (typeof v !== 'number' && typeof v !== 'boolean') return '"edits" contains a non-numeric count.';
    }
  }

  if ('notes' in data) {
    if (!isPlainObject(data.notes)) return '"notes" must be an object.';
    for (const v of Object.values(data.notes)) if (typeof v !== 'string') return '"notes" contains a non-text note.';
  }

  if ('history' in data) {
    if (!Array.isArray(data.history)) return '"history" must be a list.';
    if (!data.history.every(isPlainObject)) return '"history" contains an invalid entry.';
  }

  if ('timeLogs' in data) {
    if (!isPlainObject(data.timeLogs)) return '"timeLogs" must be an object.';
    for (const [key, entry] of Object.entries(data.timeLogs)) {
      if (!isPlainObject(entry) || !validIso(entry.clockIn) || !validIso(entry.clockOut)) {
        return `time log "${key}" is invalid.`;
      }
    }
  }

  return null;
}