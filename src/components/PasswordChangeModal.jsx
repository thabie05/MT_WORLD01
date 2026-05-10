import React, { useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { loadUsers } from '../data/users';

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

    const users = loadUsers();
    const userIndex = users.findIndex((u) => u.username === currentUser.username);
    if (userIndex === -1) { setError('User not found.'); return; }
    if (users[userIndex].password !== currentPassword) { setError('Current password is incorrect.'); return; }
    if (newPassword.length < 4) { setError('New password must be at least 4 characters.'); return; }
    if (newPassword !== confirmPassword) { setError('New passwords do not match.'); return; }

    setSaving(true);
    try {
      users[userIndex].password = newPassword;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
      const docRef = doc(db, 'users', 'credentials');
      const snap = await getDoc(docRef);
      let allUsers = snap.exists() ? snap.data().users || [] : [];
      const cloudIndex = allUsers.findIndex((u) => u.username === currentUser.username);
      if (cloudIndex !== -1) allUsers[cloudIndex].password = newPassword;
      else allUsers.push(users[userIndex]);
      await setDoc(docRef, { users: allUsers }, { merge: true });
      setSuccess('Password changed successfully!');
      setTimeout(() => { onPasswordChanged(); onClose(); }, 1500);
    } catch (err) {
      setError('Failed to save to cloud.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-[2000] p-5" onClick={onClose}>
      <div className="bg-white rounded-2xl p-7 w-full max-w-[420px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-center text-xl font-bold text-slate-900 mb-1">🔒 Change Password</h2>
        <p className="text-center text-slate-500 text-sm mb-5 pb-3 border-b border-slate-200">
          Logged in as: <strong>{currentUser.fullName}</strong>
        </p>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Current Password</label>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required placeholder="Enter current password"
              className="w-full py-2.5 px-3.5 border border-slate-300 rounded-xl text-sm bg-slate-50 text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10" />
          </div>
          <div className="mb-4">
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">New Password</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required placeholder="Enter new password (min 4 chars)"
              className="w-full py-2.5 px-3.5 border border-slate-300 rounded-xl text-sm bg-slate-50 text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10" />
          </div>
          <div className="mb-4">
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Confirm New Password</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="Re-enter new password"
              className="w-full py-2.5 px-3.5 border border-slate-300 rounded-xl text-sm bg-slate-50 text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10" />
          </div>
          {error && <p className="text-red-600 text-sm text-center mt-2 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          {success && <p className="text-green-600 text-sm text-center mt-2 bg-green-50 px-3 py-2 rounded-lg">{success}</p>}
          <div className="flex gap-2.5 mt-5">
            <button type="button" onClick={onClose} disabled={saving} className="flex-1 py-2.5 px-4 bg-slate-100 border border-slate-200 rounded-xl font-semibold text-sm text-slate-600 transition hover:bg-slate-200 disabled:opacity-60">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 px-4 bg-indigo-900 text-white rounded-xl font-semibold text-sm transition hover:bg-indigo-800 disabled:opacity-60">{saving ? 'Saving...' : 'Change Password'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PasswordChangeModal;