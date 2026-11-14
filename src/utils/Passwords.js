// src/utils/passwords.js
// Salted SHA-256 hashing with a transparent upgrade path: passwords stored in
// the old plain-text form still verify, and are re-saved as hashes on the
// next successful login / password change.
// NOTE: this stops passwords being readable in Firestore. Real protection
// still needs Firestore security rules (and ideally Firebase Auth).

const PREFIX = 'sha256$';

const toHex = (buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  return toHex(await crypto.subtle.digest('SHA-256', data));
}

export const isHashed = (stored) => typeof stored === 'string' && stored.startsWith(PREFIX);

export async function hashPassword(plain) {
  // crypto.subtle only exists in secure contexts; fall back rather than break login.
  if (typeof crypto === 'undefined' || !crypto.subtle) return plain;
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
  return `${PREFIX}${salt}$${await sha256Hex(salt + plain)}`;
}

export async function verifyPassword(stored, plain) {
  if (typeof stored !== 'string') return false;
  if (!isHashed(stored)) return stored === plain; // legacy plain text
  if (typeof crypto === 'undefined' || !crypto.subtle) return false;
  const [, salt, hash] = stored.split('$');
  return (await sha256Hex(salt + plain)) === hash;
}

// ---------------------------------------------------------------------------
// Super admin
// Add the login username(s) that should be super admin here (lower-case).
// A user record with  isSuperAdmin: true  in Firestore also counts.
// ---------------------------------------------------------------------------
export const SUPER_ADMIN_USERNAMES = ['thabelo'];

export const isSuperAdmin = (user) =>
  !!user && (user.isSuperAdmin === true || SUPER_ADMIN_USERNAMES.includes(String(user.username || '').toLowerCase()));