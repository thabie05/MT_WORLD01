import React, { useState } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { X } from 'lucide-react';

function EditEmployeeModal({ employee, onClose, onUpdate }) {
  const [formData, setFormData] = useState({
    email: employee.email || '',
    phone: employee.phone || '',
    address: employee.address || '',
    position: employee.position || '',
    department: employee.department || '',
    startDate: employee.startDate || '',
    cv: employee.cv || '',
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const docRef = doc(db, 'rollcall', 'data');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        const employees = data.employees || [];
        const updatedEmployees = employees.map((emp) =>
          emp.id === employee.id ? { ...emp, ...formData } : emp
        );
        await updateDoc(docRef, { employees: updatedEmployees });
        onUpdate({ ...employee, ...formData });
        onClose();
      }
    } catch (err) {
      console.error('Failed to update employee:', err);
      alert('Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-main rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-main">
          <h2 className="text-lg font-semibold text-main">Edit Employee Details</h2>
          <button onClick={onClose} className="text-muted hover:text-main transition-colors">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-main mb-1">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full bg-input border border-main rounded-lg px-3 py-2 text-sm text-main outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-main mb-1">Phone</label>
            <input
              type="text"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="w-full bg-input border border-main rounded-lg px-3 py-2 text-sm text-main outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-main mb-1">Address</label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              className="w-full bg-input border border-main rounded-lg px-3 py-2 text-sm text-main outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-main mb-1">Position</label>
            <input
              type="text"
              name="position"
              value={formData.position}
              onChange={handleChange}
              className="w-full bg-input border border-main rounded-lg px-3 py-2 text-sm text-main outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-main mb-1">Department</label>
            <input
              type="text"
              name="department"
              value={formData.department}
              onChange={handleChange}
              className="w-full bg-input border border-main rounded-lg px-3 py-2 text-sm text-main outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-main mb-1">Start Date</label>
            <input
              type="date"
              name="startDate"
              value={formData.startDate}
              onChange={handleChange}
              className="w-full bg-input border border-main rounded-lg px-3 py-2 text-sm text-main outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-main mb-1">CV</label>
            <textarea
              name="cv"
              value={formData.cv}
              onChange={handleChange}
              rows={4}
              className="w-full bg-input border border-main rounded-lg px-3 py-2 text-sm text-main outline-none focus:border-accent resize-y"
              placeholder="Paste CV content or link..."
            />
          </div>
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
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditEmployeeModal;