import React, { useState } from 'react';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Building,
  Calendar,
  Clock,
  BarChart3,
  Users,
  ArrowLeft,
  FileText,
  Edit,
  X,
} from 'lucide-react';
import { monthNames } from '../utils/holidays';
import EditEmployeeModal from './EditEmployeeModal';

function EmployeeProfilePage({ employeeId, employees, attendance, history, timeLogs, onBack, onUpdateEmployee }) {
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCVModal, setShowCVModal] = useState(false);

  const employee = employees.find((emp) => emp.id === employeeId);
  if (!employee) {
    return (
      <div className="p-8 text-center text-muted">
        <p>Employee not found.</p>
        <button onClick={onBack} className="mt-4 text-accent hover:underline">
          Go Back
        </button>
      </div>
    );
  }

  const empAttendance = attendance[employeeId] || {};
  const allDates = Object.keys(empAttendance).sort();
  const empHistory = history.filter((h) => h.employeeId === employeeId);
  const empTimeLogs = timeLogs ? Object.keys(timeLogs).filter((key) => key.startsWith(employeeId)) : [];

  return (
    <div className="w-full p-4 md:p-6">
      {/* Back button & header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-2 bg-card border border-main rounded-lg text-sm text-main hover:bg-accent-light transition"
        >
          <ArrowLeft size={18} />
          Back
        </button>
        <div>
          <h1 className="text-2xl font-semibold text-main flex items-center gap-2">
            <User className="text-accent" size={28} />
            {employee.name}
          </h1>
          <p className="text-muted text-sm mt-1">Employee Profile</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <button
          onClick={() => setShowEditModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition"
        >
          <Edit size={16} />
          Edit Details
        </button>
        {employee.cv ? (
          <button
            onClick={() => window.open(employee.cv, '_blank')}
            className="flex items-center gap-2 px-4 py-2 bg-input hover:bg-accent-light text-main rounded-lg text-sm font-medium border border-main transition"
          >
            <FileText size={16} />
            View CV
          </button>
        ) : (
          <span className="text-muted text-sm px-4 py-2 border border-main rounded-lg">No CV uploaded</span>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-card border border-main rounded-xl p-4 shadow-theme">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent/10 rounded-lg">
              <User size={20} className="text-accent" />
            </div>
            <div>
              <p className="text-xs text-muted">Employee ID</p>
              <p className="text-sm font-medium text-main">{employee.id}</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-main rounded-xl p-4 shadow-theme">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent/10 rounded-lg">
              <Calendar size={20} className="text-accent" />
            </div>
            <div>
              <p className="text-xs text-muted">Total Attendance Days</p>
              <p className="text-sm font-medium text-main">{allDates.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-main rounded-xl p-4 shadow-theme">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent/10 rounded-lg">
              <BarChart3 size={20} className="text-accent" />
            </div>
            <div>
              <p className="text-xs text-muted">History Entries</p>
              <p className="text-sm font-medium text-main">{empHistory.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-main rounded-xl p-4 shadow-theme">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent/10 rounded-lg">
              <Clock size={20} className="text-accent" />
            </div>
            <div>
              <p className="text-xs text-muted">Clock Logs</p>
              <p className="text-sm font-medium text-main">{empTimeLogs.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Employee Details */}
      <div className="bg-card border border-main rounded-xl shadow-theme overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-main flex items-center justify-between">
          <h2 className="text-sm font-semibold text-main flex items-center gap-2">
            <User size={16} className="text-accent" />
            Personal Information
          </h2>
          <button
            onClick={() => setShowEditModal(true)}
            className="text-xs text-accent hover:underline flex items-center gap-1"
          >
            <Edit size={12} />
            Edit
          </button>
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start gap-3">
            <Mail size={16} className="text-muted mt-0.5" />
            <div>
              <p className="text-xs text-muted">Email</p>
              <p className="text-sm text-main">{employee.email || '—'}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Phone size={16} className="text-muted mt-0.5" />
            <div>
              <p className="text-xs text-muted">Phone</p>
              <p className="text-sm text-main">{employee.phone || '—'}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MapPin size={16} className="text-muted mt-0.5" />
            <div>
              <p className="text-xs text-muted">Address</p>
              <p className="text-sm text-main">{employee.address || '—'}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Briefcase size={16} className="text-muted mt-0.5" />
            <div>
              <p className="text-xs text-muted">Position</p>
              <p className="text-sm text-main">{employee.position || '—'}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Building size={16} className="text-muted mt-0.5" />
            <div>
              <p className="text-xs text-muted">Department</p>
              <p className="text-sm text-main">{employee.department || '—'}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Calendar size={16} className="text-muted mt-0.5" />
            <div>
              <p className="text-xs text-muted">Start Date</p>
              <p className="text-sm text-main">
                {employee.startDate ? new Date(employee.startDate).toLocaleDateString() : '—'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <EditEmployeeModal
          employee={employee}
          onClose={() => setShowEditModal(false)}
          onUpdate={(updated) => {
            onUpdateEmployee(updated);
            setShowEditModal(false);
          }}
        />
      )}

      {/* CV Modal – removed, replaced with window.open */}
    </div>
  );
}

export default EmployeeProfilePage;