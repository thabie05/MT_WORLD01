// src/utils/Passwords.js
// Salted PBKDF2-SHA256 password hashing (Web Crypto, no dependencies).
//
// Stored format:  pbkdf2$<iterations>$<saltHex>$<hashHex>
// Older formats still verify so nobody is locked out, and are upgraded to the
// current format on the next successful login / password change:
//   - sha256$<saltHex>$<hashHex>   (previous single-round salted SHA-256)
//   - plain text                    (original records)
//
// NOTE: hashing stops passwords being readable in Firestore. Real protection
// still needs Firestore security rules (and ideally Firebase Auth).

const PBKDF2_PREFIX = 'pbkdf2$';
const LEGACY_PREFIX = 'sha256$';
const PBKDF2_ITERATIONS = 210000;

const enc = new TextEncoder();
const getSubtle = () => globalThis.crypto && globalThis.crypto.subtle;

const toHex = (buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex) => {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
};

async function sha256Hex(text) {
  return toHex(await getSubtle().digest('SHA-256', enc.encode(text)));
}

async function pbkdf2Hex(plain, saltHex, iterations) {
  const subtle = getSubtle();
  const key = await subtle.importKey('raw', enc.encode(plain), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(saltHex), iterations },
    key,
    256
  );
  return toHex(bits);
}

// Compares without bailing out at the first differing character.
function safeEqual(a, b) {
  const x = String(a);
  const y = String(b);
  let diff = x.length ^ y.length;
  const len = Math.max(x.length, y.length);
  for (let i = 0; i < len; i++) diff |= (x.charCodeAt(i) || 0) ^ (y.charCodeAt(i) || 0);
  return diff === 0;
}

export const isHashed = (stored) =>
  typeof stored === 'string' && (stored.startsWith(PBKDF2_PREFIX) || stored.startsWith(LEGACY_PREFIX));

/** True when a stored value should be re-saved in the current format. */
export function needsRehash(stored) {
  if (typeof stored !== 'string' || stored === '') return false;
  if (!stored.startsWith(PBKDF2_PREFIX)) return true; // plain text or legacy sha256
  return (parseInt(stored.split('$')[1], 10) || 0) < PBKDF2_ITERATIONS;
}

export async function hashPassword(plain) {
  // crypto.subtle only exists in secure contexts (https or localhost). Refuse
  // rather than silently storing the password unprotected.
  if (!getSubtle()) {
    throw new Error('Secure crypto is unavailable. Open the app over https:// (or localhost) to set passwords.');
  }
  const salt = toHex(globalThis.crypto.getRandomValues(new Uint8Array(16)));
  const hash = await pbkdf2Hex(plain, salt, PBKDF2_ITERATIONS);
  return `${PBKDF2_PREFIX}${PBKDF2_ITERATIONS}$${salt}$${hash}`;
}

export async function verifyPassword(stored, plain) {
  if (typeof stored !== 'string' || typeof plain !== 'string') return false;

  if (stored.startsWith(PBKDF2_PREFIX)) {
    const [, iter, salt, hash] = stored.split('$');
    const iterations = parseInt(iter, 10);
    if (!iterations || !salt || !hash || !getSubtle()) return false;
    return safeEqual(await pbkdf2Hex(plain, salt, iterations), hash);
  }

  if (stored.startsWith(LEGACY_PREFIX)) {
    const [, salt, hash] = stored.split('$');
    if (!salt || !hash || !getSubtle()) return false;
    return safeEqual(await sha256Hex(salt + plain), hash);
  }

  return safeEqual(stored, plain); // legacy plain text
}

// ---------------------------------------------------------------------------
// Super admin
// Add the login username(s) that should be super admin here (lower-case).
// A user record with  isSuperAdmin: true  in Firestore also counts.
// ---------------------------------------------------------------------------
export const SUPER_ADMIN_USERNAMES = ['thabelo'];

export const isSuperAdmin = (user) =>
  !!user && (user.isSuperAdmin === true || SUPER_ADMIN_USERNAMES.includes(String(user.username || '').toLowerCase()));