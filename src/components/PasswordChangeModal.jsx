import React, { useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { loadUsers } from '../data/users';
import { verifyPassword, hashPassword } from '../utils/Passwords';

const STORAGE_KEY = 'mtworld_users';

function PasswordChangeModal({ currentUser, onClose, onPasswordChanged }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      // Fetch latest user list from Firestore
      let users;
      try {
        const docRef = doc(db, 'users', 'credentials');
        const snap = await getDoc(docRef);
        users = snap.exists() && snap.data().users ? snap.data().users : loadUsers();
      } catch {
        users = loadUsers(); // offline fallback
      }

      const userIndex = users.findIndex((u) => u.username === currentUser.username);
      if (userIndex === -1) {
        setError('User not found.');
        setSaving(false);
        return;
      }
      if (!(await verifyPassword(users[userIndex].password, currentPassword))) {
        setError('Current password is incorrect.');
        setSaving(false);
        return;
      }

      // Update password
      users[userIndex] = { ...users[userIndex], password: await hashPassword(newPassword) };

      // Persist to localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(users));

      // Write back to Firestore
      const docRef = doc(db, 'users', 'credentials');
      await setDoc(docRef, { users }, { merge: true });

      setSuccess('Password changed successfully!');
      setTimeout(() => {
        onPasswordChanged();
        onClose();
      }, 1500);
    } catch (err) {
      setError('Failed to save to cloud.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-[2000] p-5" onClick={onClose}>
      <div
        className="bg-card rounded-2xl p-7 w-full max-w-[420px] shadow-2xl border border-main"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-center text-xl font-bold text-accent mb-1">🔒 Change Password</h2>
        <p className="text-center text-muted text-sm mb-5 pb-3 border-b border-main">
          Logged in as: <strong className="text-main">{currentUser.fullName}</strong>
        </p>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-xs font-bold text-accent uppercase tracking-wider mb-1.5">
              Current Password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              placeholder="Enter current password"
              className="w-full py-2.5 px-3.5 border border-main rounded-xl text-sm bg-input text-main placeholder-muted outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/10"
            />
          </div>
          <div className="mb-4">
            <label className="block text-xs font-bold text-accent uppercase tracking-wider mb-1.5">
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              placeholder="Enter new password (min 6 chars)"
              className="w-full py-2.5 px-3.5 border border-main rounded-xl text-sm bg-input text-main placeholder-muted outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/10"
            />
          </div>
          <div className="mb-4">
            <label className="block text-xs font-bold text-accent uppercase tracking-wider mb-1.5">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="Re-enter new password"
              className="w-full py-2.5 px-3.5 border border-main rounded-xl text-sm bg-input text-main placeholder-muted outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/10"
            />
          </div>
          {error && (
            <p className="text-[var(--accent-red)] text-sm text-center mt-2 bg-[var(--bg-red-soft)] px-3 py-2 rounded-lg">
              {error}
            </p>
          )}
          {success && (
            <p className="text-[var(--accent-green)] text-sm text-center mt-2 bg-[var(--bg-green-soft)] px-3 py-2 rounded-lg">
              {success}
            </p>
          )}
          <div className="flex gap-2.5 mt-5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 py-2.5 px-4 bg-input border border-main rounded-xl font-semibold text-sm text-muted transition hover:bg-card disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 px-4 btn-accent rounded-xl font-semibold text-sm transition disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PasswordChangeModal;