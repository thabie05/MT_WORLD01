import React, { useState } from 'react';
import { X } from 'lucide-react';

const EMPTY = { name: '', email: '', phone: '', address: '', position: '', department: '', startDate: '', cv: '' };

// onSave(data) should return an error string if it fails, or nothing on success.
function AddEmployeeModal({ onClose, onSave }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('Employee name is required.');
    setSaving(true);
    const err = await onSave({ ...form, name: form.name.trim() });
    setSaving(false);
    if (err) setError(err);
    else onClose();
  };

  const input = 'w-full bg-input border border-main rounded-lg px-3 py-2 text-sm text-main outline-none focus:border-accent';
  const label = 'block text-sm font-medium text-main mb-1';

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-card border border-main rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-main">
          <h2 className="text-lg font-semibold text-main">Add Employee</h2>
          <button onClick={onClose} className="text-muted hover:text-main transition-colors">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className={label}>Full name <span className="text-accent-red">*</span></label>
            <input name="name" value={form.name} onChange={handleChange} className={input} autoFocus />
          </div>
          <div>
            <label className={label}>Email</label>
            <input type="email" name="email" value={form.email} onChange={handleChange} className={input} />
          </div>
          <div>
            <label className={label}>Phone</label>
            <input name="phone" value={form.phone} onChange={handleChange} className={input} />
          </div>
          <div>
            <label className={label}>Address</label>
            <input name="address" value={form.address} onChange={handleChange} className={input} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={label}>Position</label>
              <input name="position" value={form.position} onChange={handleChange} className={input} />
            </div>
            <div>
              <label className={label}>Department</label>
              <input name="department" value={form.department} onChange={handleChange} className={input} />
            </div>
          </div>
          <div>
            <label className={label}>Start Date</label>
            <input type="date" name="startDate" value={form.startDate} onChange={handleChange} className={input} />
          </div>
          <div>
            <label className={label}>CV</label>
            <textarea
              name="cv"
              value={form.cv}
              onChange={handleChange}
              rows={3}
              className={`${input} resize-y`}
              placeholder="Paste CV content or link..."
            />
          </div>

          {error && (
            <p className="text-[var(--accent-red)] text-sm bg-[var(--bg-red-soft)] px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 bg-input border border-main rounded-lg text-sm font-medium text-muted hover:bg-accent-light"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Add Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddEmployeeModal;