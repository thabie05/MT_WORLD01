import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { loadUsers } from '../data/users';
import { hashPassword, isSuperAdmin } from '../utils/Passwords';
import ConfirmModal from './ConfirmModal';
import { UserPlus, Trash2, Users, KeyRound, Pencil, Crown } from 'lucide-react';

const ROLES = [
  { value: 'admin', label: 'Admin – full access' },
  { value: 'user', label: 'User – can mark attendance' },
  { value: 'viewer', label: 'Viewer – view only' },
];

const credRef = () => doc(db, 'users', 'credentials');

// Always read the latest list right before writing so two admins editing at
// once don't overwrite each other. If the cloud list doesn't exist yet, start
// from the built-in users so nobody gets locked out.
async function readUsers() {
  try {
    const snap = await getDoc(credRef());
    if (snap.exists() && snap.data().users?.length) return snap.data().users;
  } catch (e) {
    console.error('Could not read users from cloud:', e);
  }
  return loadUsers();
}

function UserManagement({ currentUser }) {
  const me = isSuperAdmin(currentUser);

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [resetFor, setResetFor] = useState(null);
  const [resetPw, setResetPw] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null); // user awaiting delete confirmation
  const [editFor, setEditFor] = useState(null); // username being edited
  const [editForm, setEditForm] = useState({ username: '', fullName: '', email: '', role: 'user' });
  const [form, setForm] = useState({ username: '', fullName: '', email: '', password: '', role: 'user' });

  useEffect(() => {
    (async () => {
      setUsers(await readUsers());
      setLoading(false);
    })();
  }, []);

  const flash = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg({ type: '', text: '' }), 4000);
  };

  const save = async (list) => {
    await setDoc(credRef(), { users: list }, { merge: true });
    setUsers(list);
  };

  // Super admin manages everyone. A normal admin manages only non-admin
  // accounts (and yes, themselves for password changes via Account settings).
  const canManage = (u) => me || (u.role !== 'admin' && !isSuperAdmin(u));
  const roleOptions = ROLES;

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!me) return flash('error', 'Only the super admin can add users.');
    const username = form.username.trim();
    const fullName = form.fullName.trim();
    if (!username || !fullName) return flash('error', 'Username and full name are required.');
    if (form.password.length < 4) return flash('error', 'Password must be at least 4 characters.');
    if (!me) return flash('error', 'Only the super admin can add users.');
    setBusy(true);
    try {
      const latest = await readUsers();
      if (latest.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
        flash('error', 'That username already exists.');
        return;
      }
      await save([
        ...latest,
        { username, fullName, email: form.email.trim(), role: form.role, password: await hashPassword(form.password) },
      ]);
      setForm({ username: '', fullName: '', email: '', password: '', role: 'user' });
      flash('success', `User "${username}" created.`);
    } catch (err) {
      console.error(err);
      flash('error', 'Failed to save. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (u) => {
    setResetFor(null);
    setEditFor(u.username);
    setEditForm({ username: u.username, fullName: u.fullName || '', email: u.email || '', role: u.role });
  };

  const handleEditSave = async (u) => {
    const username = editForm.username.trim();
    const fullName = editForm.fullName.trim();
    if (!username || !fullName) return flash('error', 'Username and full name are required.');
    setBusy(true);
    try {
      const latest = await readUsers();
      const isSelf = u.username === currentUser.username;
      if (username !== u.username && latest.some((x) => x.username.toLowerCase() === username.toLowerCase())) {
        flash('error', 'That username already exists.');
        return;
      }
      if (isSelf && username !== u.username) {
        flash('error', "You can't change your own username while logged in.");
        return;
      }
      const updated = latest.map((x) =>
        x.username === u.username
          ? { ...x, username, fullName, email: editForm.email.trim(), role: isSelf ? x.role : editForm.role }
          : x
      );
      if (!updated.some((x) => x.role === 'admin')) {
        flash('error', 'There must be at least one admin.');
        return;
      }
      await save(updated);
      setEditFor(null);
      flash('success', `User "${username}" updated.`);
    } catch (err) {
      console.error(err);
      flash('error', 'Failed to update user.');
    } finally {
      setBusy(false);
    }
  };

  const askDelete = (u) => {
    if (u.username === currentUser.username) return flash('error', "You can't delete your own account.");
    setConfirmDelete(u);
  };

  const handleDelete = async (u) => {
    setBusy(true);
    try {
      const latest = await readUsers();
      const remaining = latest.filter((x) => x.username !== u.username);
      if (!remaining.some((x) => x.role === 'admin')) {
        flash('error', 'There must be at least one admin.');
        return;
      }
      await save(remaining);
      flash('success', `User "${u.username}" deleted.`);
    } catch (err) {
      console.error(err);
      flash('error', 'Failed to delete user.');
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async (u) => {
    if (resetPw.length < 4) return flash('error', 'Password must be at least 4 characters.');
    setBusy(true);
    try {
      const latest = await readUsers();
      const hashed = await hashPassword(resetPw);
      await save(latest.map((x) => (x.username === u.username ? { ...x, password: hashed } : x)));
      setResetFor(null);
      setResetPw('');
      flash('success', `Password reset for "${u.username}".`);
    } catch (err) {
      console.error(err);
      flash('error', 'Failed to reset password.');
    } finally {
      setBusy(false);
    }
  };

  const input = 'w-full bg-input border border-main rounded-lg px-3 py-2 text-sm text-main outline-none focus:border-accent';

  return (
    <div className="bg-card border border-main rounded-xl p-6 shadow-theme">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-accent/10 rounded-lg"><Users size={20} className="text-accent" /></div>
        <div>
          <h2 className="text-sm font-semibold text-main flex items-center gap-2">
            User Management
            {me && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded-full">
                <Crown size={11} /> Super admin
              </span>
            )}
          </h2>
          <p className="text-xs text-muted">
            {me ? 'You can create, edit and remove every account' : 'Only the super admin can add users. You can edit user and viewer accounts.'}
          </p>
        </div>
      </div>

      {msg.text && (
        <p className={`text-sm px-3 py-2 rounded-lg mb-4 ${msg.type === 'error' ? 'text-[var(--accent-red)] bg-[var(--bg-red-soft)]' : 'text-[var(--accent-green)] bg-[var(--bg-green-soft)]'}`}>
          {msg.text}
        </p>
      )}

      {me && (
      <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        <input className={input} placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} autoComplete="off" />
        <input className={input} placeholder="Full name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        <input className={input} type="email" placeholder="Email (optional)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input className={input} type="password" placeholder="Password (min 4 characters)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" />
        <select className={input} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          {roleOptions.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <button type="submit" disabled={busy} className="flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-60">
          <UserPlus size={16} /> {busy ? 'Saving...' : 'Create User'}
        </button>
      </form>
      )}

      <div className="border border-main rounded-lg overflow-hidden">
        {loading ? (
          <p className="p-4 text-sm text-muted">Loading users…</p>
        ) : (
          users.map((u) => {
            const manageable = canManage(u);
            const isSelf = u.username === currentUser.username;
            return (
              <div key={u.username} className="px-4 py-3 border-b border-main last:border-0">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-main truncate flex items-center gap-1.5">
                      {isSuperAdmin(u) && <Crown size={14} className="text-yellow-500 flex-shrink-0" />}
                      {u.fullName} <span className="text-muted font-normal">@{u.username}</span>
                      {isSelf && <span className="text-[10px] text-accent">(you)</span>}
                    </p>
                    <p className="text-xs text-muted truncate">{u.email || 'No email'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-accent capitalize px-2 py-0.5 rounded-full bg-accent-light">
                      {isSuperAdmin(u) ? 'super admin' : u.role}
                    </span>
                    {manageable && (
                      <>
                        <button onClick={() => (editFor === u.username ? setEditFor(null) : startEdit(u))} className="p-1.5 rounded-md text-muted hover:text-main hover:bg-accent-light transition" title="Edit user">
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => { setEditFor(null); setResetFor(resetFor === u.username ? null : u.username); setResetPw(''); }} className="p-1.5 rounded-md text-muted hover:text-main hover:bg-accent-light transition" title="Reset password">
                          <KeyRound size={16} />
                        </button>
                        {!isSelf && (
                          <button onClick={() => askDelete(u)} disabled={busy} className="p-1.5 rounded-md text-accent-red hover:bg-[var(--bg-red-soft)] transition" title="Delete user">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {editFor === u.username && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    <input className={input} placeholder="Username" value={editForm.username} disabled={isSelf} onChange={(e) => setEditForm({ ...editForm, username: e.target.value })} />
                    <input className={input} placeholder="Full name" value={editForm.fullName} onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} />
                    <input className={input} type="email" placeholder="Email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                    <select className={input} value={editForm.role} disabled={isSelf} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
                      {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                    <div className="flex gap-2 md:col-span-2">
                      <button onClick={() => handleEditSave(u)} disabled={busy} className="bg-accent hover:bg-accent-hover text-white rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-60">Save changes</button>
                      <button onClick={() => setEditFor(null)} className="bg-input border border-main text-muted hover:bg-accent-light rounded-lg px-4 py-2 text-sm transition">Cancel</button>
                    </div>
                  </div>
                )}

                {resetFor === u.username && (
                  <div className="flex gap-2 mt-3">
                    <input className={input} type="password" placeholder="New password" value={resetPw} onChange={(e) => setResetPw(e.target.value)} autoComplete="new-password" />
                    <button onClick={() => handleReset(u)} disabled={busy} className="bg-accent hover:bg-accent-hover text-white rounded-lg px-4 text-sm font-medium transition disabled:opacity-60">Save</button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {confirmDelete && (
        <ConfirmModal
          message={`Delete user "${confirmDelete.username}"? They will no longer be able to log in.`}
          onConfirm={() => {
            const u = confirmDelete;
            setConfirmDelete(null);
            handleDelete(u);
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

export default UserManagement;