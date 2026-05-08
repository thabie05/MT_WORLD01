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
      console.error('Failed to save:', err);
      setError('Failed to save to cloud.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="history-modal-overlay" onClick={onClose}>
      <div className="history-modal password-modal" onClick={(e) => e.stopPropagation()}>
        <h2>🔒 Change Password</h2>
        <p className="password-user">Logged in as: <strong>{currentUser.fullName}</strong></p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Current Password</label>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required placeholder="Enter current password" />
          </div>
          <div className="form-group">
            <label>New Password</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required placeholder="Enter new password (min 4 chars)" />
          </div>
          <div className="form-group">
            <label>Confirm New Password</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="Re-enter new password" />
          </div>
          {error && <p className="error-msg">{error}</p>}
          {success && <p className="success-msg">{success}</p>}
          <div className="password-modal-buttons">
            <button type="button" onClick={onClose} className="cancel-btn" disabled={saving}>Cancel</button>
            <button type="submit" className="save-btn" disabled={saving}>{saving ? 'Saving...' : 'Change Password'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PasswordChangeModal;