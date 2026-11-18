// src/utils/rollcallStore.js
//
// Data layout (replaces the single, ever-growing rollcall/data document, which
// Firestore caps at 1 MiB and ~40,000 index entries):
//
//   rollcall/data                  employees only  (+ schemaVersion: 2)
//   rollcall_months/{YYYY-MM}      attendance, edits, notes, timeLogs for that month
//   rollcall_history/{YYYY-MM}     history: [ ...audit entries for that month ]
//
// Each month is its own small document, so nothing keeps growing forever.
// The UI still receives the same merged shape it always used:
//   { employees, attendance, edits, notes, timeLogs, history }

import {
  doc, collection, getDoc, getDocs, setDoc, onSnapshot,
  runTransaction, writeBatch, deleteField,
} from 'firebase/firestore';
import { db } from '../firebase';

export const MONTHS = 'rollcall_months';
export const HISTORY = 'rollcall_history';
const BACKUPS = 'rollcall_backups';
const LEGACY_FIELDS = ['attendance', 'edits', 'notes', 'timeLogs', 'history'];
const MONTH_RE = /^\d{4}-\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const dataRef = () => doc(db, 'rollcall', 'data');
/** Accepts "YYYY-MM-DD" or "YYYY-MM". Anything else goes to the "undated" bucket. */
export const monthKeyOf = (dateKey) => {
  const k = String(dateKey || '').slice(0, 7);
  return MONTH_RE.test(k) ? k : 'undated';
};
export const monthDocRef = (dateKey) => doc(db, MONTHS, monthKeyOf(dateKey));
export const historyDocRef = (dateKey) => doc(db, HISTORY, monthKeyOf(dateKey));

// ---------- small helpers ----------
const isPlain = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

function deepMerge(a, b) {
  const out = { ...a };
  for (const k of Object.keys(b)) {
    out[k] = isPlain(a[k]) && isPlain(b[k]) ? deepMerge(a[k], b[k]) : b[k];
  }
  return out;
}

function stable(v) {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (isPlain(v)) return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
  return JSON.stringify(v === undefined ? null : v);
}

const entryKey = (e) => (e && e.id !== undefined ? `id:${e.id}` : `json:${stable(e)}`);

function unionHistory(existing, incoming) {
  const seen = new Set();
  const out = [];
  for (const e of [...existing, ...incoming]) {
    const k = entryKey(e);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(e);
  }
  return out.sort((a, b) => String(a?.editedAt || '').localeCompare(String(b?.editedAt || '')));
}

const entryMonth = (e) => monthKeyOf(e?.date || String(e?.editedAt || '').slice(0, 10));

const emptyGroup = () => ({ attendance: {}, edits: {}, notes: {}, timeLogs: {}, history: [] });

/** Splits old-style { attendance, edits, notes, timeLogs, history } into per-month groups. */
export function groupByMonth(src) {
  const groups = {};
  const g = (ym) => (groups[ym] = groups[ym] || emptyGroup());

  const attendance = src.attendance || {};
  for (const emp of Object.keys(attendance)) {
    if (!isPlain(attendance[emp])) continue;
    for (const dateKey of Object.keys(attendance[emp])) {
      const grp = g(monthKeyOf(dateKey));
      grp.attendance[emp] = grp.attendance[emp] || {};
      grp.attendance[emp][dateKey] = attendance[emp][dateKey];
    }
  }
  for (const field of ['edits', 'notes', 'timeLogs']) {
    const map = src[field] || {};
    for (const key of Object.keys(map)) {
      const dateKey = key.slice(-10);
      g(DATE_RE.test(dateKey) ? monthKeyOf(dateKey) : 'undated')[field][key] = map[key];
    }
  }
  for (const entry of Array.isArray(src.history) ? src.history : []) g(entryMonth(entry)).history.push(entry);
  return groups;
}

/** Merged, UI-shaped data from the legacy fields + month docs + history docs. */
export function mergeAll(employeesData, monthDocs, historyDocs) {
  const out = {
    attendance: {}, edits: {}, notes: {}, timeLogs: {},
    history: Array.isArray(employeesData?.history) ? [...employeesData.history] : [],
  };
  // Legacy fields still present on rollcall/data (before the one-time migration ran) show up too.
  for (const f of ['attendance', 'edits', 'notes', 'timeLogs']) {
    if (isPlain(employeesData?.[f])) out[f] = deepMerge({}, employeesData[f]);
  }
  for (const m of [...monthDocs].sort((a, b) => a.id.localeCompare(b.id))) {
    const d = m.data();
    for (const f of ['attendance', 'edits', 'notes', 'timeLogs']) {
      if (isPlain(d[f])) out[f] = deepMerge(out[f], d[f]);
    }
  }
  const hist = [...out.history];
  for (const h of [...historyDocs].sort((a, b) => a.id.localeCompare(b.id))) {
    if (Array.isArray(h.data().history)) hist.push(...h.data().history);
  }
  out.history = unionHistory([], hist);
  return out;
}

// ---------- live subscription ----------
/**
 * Calls onState({ exists, employees, attendance, edits, notes, timeLogs, history, meta })
 * after every change, once all three sources have delivered. Returns an unsubscribe fn.
 */
export function subscribeRollcall({ onState, onError }) {
  let emp = null;
  let months = null;
  let hist = null;
  const emit = () => {
    if (!emp || !months || !hist) return;
    const data = emp.exists() ? emp.data() : {};
    onState({
      exists: emp.exists(),
      employees: data.employees || [],
      ...mergeAll(data, months.docs, hist.docs),
      meta: {
        fromCache: emp.metadata.fromCache,
        hasPendingWrites: emp.metadata.hasPendingWrites || months.metadata.hasPendingWrites || hist.metadata.hasPendingWrites,
      },
    });
  };
  const opts = { includeMetadataChanges: true };
  const u1 = onSnapshot(dataRef(), opts, (s) => { emp = s; emit(); }, onError);
  const u2 = onSnapshot(collection(db, MONTHS), opts, (s) => { months = s; emit(); }, onError);
  const u3 = onSnapshot(collection(db, HISTORY), opts, (s) => { hist = s; emit(); }, onError);
  return () => { u1(); u2(); u3(); };
}

// ---------- writes ----------
/**
 * Same dotted-key update map the old single-document code used, e.g.
 *   { 'attendance.<emp>.<dateKey>': 'present', 'edits.<emp>-<dateKey>': 1, history: arrayUnion(entry) }
 * routed to the right month documents. Creates them if they do not exist yet.
 * `dateKey` ("YYYY-MM-DD") decides which month the write belongs to.
 */
export async function updateRollcall(dateKey, updates) {
  const month = {};
  let historyValue = null;
  for (const [key, value] of Object.entries(updates)) {
    if (key === 'history') { historyValue = value; continue; }
    const dot = key.indexOf('.');
    const section = dot < 0 ? '' : key.slice(0, dot);
    const rest = key.slice(dot + 1);
    if (!['attendance', 'edits', 'notes', 'timeLogs'].includes(section)) throw new Error(`Unsupported field: ${key}`);
    month[section] = month[section] || {};
    if (section === 'attendance') {
      const cut = rest.lastIndexOf('.');
      if (cut < 0) throw new Error(`Unsupported attendance path: ${key}`);
      const emp = rest.slice(0, cut);
      month.attendance[emp] = month.attendance[emp] || {};
      month.attendance[emp][rest.slice(cut + 1)] = value;
    } else {
      const parts = rest.split('.');
      let node = month[section];
      parts.slice(0, -1).forEach((p) => { node[p] = node[p] || {}; node = node[p]; });
      node[parts[parts.length - 1]] = value;
    }
  }
  const batch = writeBatch(db);
  if (Object.keys(month).length) batch.set(monthDocRef(dateKey), month, { merge: true });
  if (historyValue !== null) batch.set(historyDocRef(dateKey), { history: historyValue }, { merge: true });
  await batch.commit();
}

/** Permanently deleting an employee: remove their attendance from every month. */
export async function purgeEmployeeAttendance(employeeId) {
  const snap = await getDocs(collection(db, MONTHS));
  const batch = writeBatch(db);
  let n = 0;
  snap.forEach((d) => {
    const att = d.data().attendance;
    if (att && Object.prototype.hasOwnProperty.call(att, employeeId)) {
      batch.set(d.ref, { attendance: { [employeeId]: deleteField() } }, { merge: true });
      n += 1;
    }
  });
  if (n) await batch.commit();
}

/** Merges one month's group into its documents inside a transaction. */
async function mergeMonth(ym, group, preferExisting) {
  await runTransaction(db, async (tx) => {
    const mRef = doc(db, MONTHS, ym);
    const hRef = doc(db, HISTORY, ym);
    const mSnap = await tx.get(mRef);
    const hSnap = await tx.get(hRef);

    const incoming = { attendance: group.attendance, edits: group.edits, notes: group.notes, timeLogs: group.timeLogs };
    const hasIncoming = Object.values(incoming).some((v) => Object.keys(v).length > 0);
    if (hasIncoming || mSnap.exists()) {
      const existing = mSnap.exists() ? mSnap.data() : {};
      tx.set(mRef, preferExisting ? deepMerge(incoming, existing) : deepMerge(existing, incoming));
    }
    if (group.history.length || hSnap.exists()) {
      const existing = hSnap.exists() && Array.isArray(hSnap.data().history) ? hSnap.data().history : [];
      tx.set(hRef, { history: unionHistory(existing, group.history) });
    }
  });
}

// ---------- one-time migration from the old single document ----------
let migrationPromise = null;

/**
 * Moves attendance / edits / notes / timeLogs / history out of rollcall/data into
 * the monthly documents. Safe to call on every page load and from several screens at
 * once: it backs the old document up first, merges (existing monthly data wins),
 * and only then removes the old fields. Does nothing once migrated.
 */
export function migrateLegacy() {
  if (!migrationPromise) {
    migrationPromise = runMigration().catch((err) => {
      migrationPromise = null; // allow a retry on the next call
      throw err;
    });
  }
  return migrationPromise;
}

async function runMigration() {
  const snap = await getDoc(dataRef());
  if (!snap.exists()) return { migrated: false };
  const legacy = snap.data();
  if (!LEGACY_FIELDS.some((f) => legacy[f] !== undefined)) {
    if (legacy.schemaVersion !== 2) await setDoc(dataRef(), { schemaVersion: 2 }, { merge: true });
    return { migrated: false };
  }

  // 1. full copy of the old document (it fits: it was a single document)
  await setDoc(doc(db, BACKUPS, `pre-split-${Date.now()}`), legacy);

  // 2. copy into the monthly documents (existing monthly data wins)
  const groups = groupByMonth(legacy);
  for (const ym of Object.keys(groups).sort()) await mergeMonth(ym, groups[ym], true);

  // 3. remove the old fields, but only if nothing else changed them in the meantime
  const legacyOnly = (d) => stable(LEGACY_FIELDS.map((f) => d[f] ?? null));
  const before = legacyOnly(legacy);
  const removed = await runTransaction(db, async (tx) => {
    const fresh = await tx.get(dataRef());
    if (!fresh.exists() || legacyOnly(fresh.data()) !== before) return false;
    const strip = { schemaVersion: 2 };
    for (const f of LEGACY_FIELDS) if (fresh.data()[f] !== undefined) strip[f] = deleteField();
    tx.update(dataRef(), strip);
    return true;
  });
  return { migrated: removed, months: Object.keys(groups).length };
}

// ---------- backup / restore ----------
async function snapshotCurrent(ts) {
  const [d, months, hist] = await Promise.all([
    getDoc(dataRef()), getDocs(collection(db, MONTHS)), getDocs(collection(db, HISTORY)),
  ]);
  const batch = writeBatch(db);
  if (d.exists()) batch.set(doc(db, BACKUPS, `pre-restore-${ts}`), d.data());
  months.forEach((m) => batch.set(doc(db, BACKUPS, `pre-restore-${ts}-months-${m.id}`), m.data()));
  hist.forEach((h) => batch.set(doc(db, BACKUPS, `pre-restore-${ts}-history-${h.id}`), h.data()));
  await batch.commit();
}

/**
 * Restores a backup file ({ employees, attendance, edits, notes, timeLogs, history }),
 * merging it into the current cloud data. A safety copy of everything is saved first.
 */
export async function restoreBackup(data) {
  try {
    await snapshotCurrent(Date.now());
  } catch (err) {
    console.error('Failed to snapshot data before restore:', err);
  }
  if (Array.isArray(data.employees)) {
    await setDoc(dataRef(), {
      employees: data.employees.map((e) => ({ ...e, isDeleted: e.isDeleted ?? false })),
      schemaVersion: 2,
    }, { merge: true });
  }
  const groups = groupByMonth(data);
  for (const ym of Object.keys(groups).sort()) await mergeMonth(ym, groups[ym], false);
}