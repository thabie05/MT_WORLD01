import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { monthNames } from '../utils/holidays';

function EmployeeReportModal({ employee, report, year, onClose }) {
  if (!report || !employee) {
    return null;
  }

  const totalPresent = report.reduce((s, m) => s + (m.Present || 0), 0);
  const totalLate = report.reduce((s, m) => s + (m.Late || 0), 0);
  const totalEarly = report.reduce((s, m) => s + (m.Early || 0), 0);
  const totalAbsent = report.reduce((s, m) => s + (m.Absent || 0), 0);
  const totalOffDuty = report.reduce((s, m) => s + (m.OffDuty || 0), 0);
  const totalWeekend = report.reduce((s, m) => s + (m.Weekend || 0), 0);
  const totalHoliday = report.reduce((s, m) => s + (m.Holiday || 0), 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-[2000] p-5" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-4xl max-h-[85vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-slate-900 mb-4">📋 {employee.name} – {year} Attendance Report</h2>
        
        <div className="grid grid-cols-4 gap-3 mb-5 max-md:grid-cols-4 max-sm:grid-cols-2">
          <div className="text-center py-3 px-2 rounded-xl bg-slate-50 border border-slate-200 border-l-4 border-l-green-500">
            <span className="block text-xs text-slate-500 mb-1">✓ Present</span>
            <strong className="text-2xl text-slate-800">{totalPresent}</strong>
          </div>
          <div className="text-center py-3 px-2 rounded-xl bg-slate-50 border border-slate-200 border-l-4 border-l-amber-500">
            <span className="block text-xs text-slate-500 mb-1">⏰ Late</span>
            <strong className="text-2xl text-slate-800">{totalLate}</strong>
          </div>
          <div className="text-center py-3 px-2 rounded-xl bg-slate-50 border border-slate-200 border-l-4 border-l-purple-500">
            <span className="block text-xs text-slate-500 mb-1">🚪 Early</span>
            <strong className="text-2xl text-slate-800">{totalEarly}</strong>
          </div>
          <div className="text-center py-3 px-2 rounded-xl bg-slate-50 border border-slate-200 border-l-4 border-l-red-500">
            <span className="block text-xs text-slate-500 mb-1">✗ Absent</span>
            <strong className="text-2xl text-slate-800">{totalAbsent}</strong>
          </div>
          <div className="text-center py-3 px-2 rounded-xl bg-slate-50 border border-slate-200 border-l-4 border-l-slate-500">
            <span className="block text-xs text-slate-500 mb-1">📋 Off Duty</span>
            <strong className="text-2xl text-slate-800">{totalOffDuty}</strong>
          </div>
          <div className="text-center py-3 px-2 rounded-xl bg-slate-50 border border-slate-200 border-l-4 border-l-slate-400">
            <span className="block text-xs text-slate-500 mb-1">📅 Weekend</span>
            <strong className="text-2xl text-slate-800">{totalWeekend}</strong>
          </div>
          <div className="text-center py-3 px-2 rounded-xl bg-slate-50 border border-slate-200 border-l-4 border-l-yellow-400">
            <span className="block text-xs text-slate-500 mb-1">🎉 Holiday</span>
            <strong className="text-2xl text-slate-800">{totalHoliday}</strong>
          </div>
        
        </div>

        <div className="mb-5">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={report}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Present" fill="#22c55e" stackId="a" />
              <Bar dataKey="Late" fill="#f59e0b" stackId="a" />
              <Bar dataKey="Early" fill="#8b5cf6" stackId="a" />
              <Bar dataKey="Absent" fill="#ef4444" stackId="a" />
              <Bar dataKey="OffDuty" fill="#94a3b8" stackId="a" />
              <Bar dataKey="Weekend" fill="#cbd5e1" stackId="a" />
              <Bar dataKey="Holiday" fill="#fbbf24" stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="overflow-x-auto mb-4">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="bg-slate-50 font-semibold py-2 px-3 text-left border-b border-slate-200 text-slate-700">Month</th>
                <th className="bg-slate-50 font-semibold py-2 px-3 text-left border-b border-slate-200 text-slate-700">Present</th>
                <th className="bg-slate-50 font-semibold py-2 px-3 text-left border-b border-slate-200 text-slate-700">Late</th>
                <th className="bg-slate-50 font-semibold py-2 px-3 text-left border-b border-slate-200 text-slate-700">Early</th>
                <th className="bg-slate-50 font-semibold py-2 px-3 text-left border-b border-slate-200 text-slate-700">Absent</th>
                <th className="bg-slate-50 font-semibold py-2 px-3 text-left border-b border-slate-200 text-slate-700">Off Duty</th>
                <th className="bg-slate-50 font-semibold py-2 px-3 text-left border-b border-slate-200 text-slate-700">Weekend</th>
                <th className="bg-slate-50 font-semibold py-2 px-3 text-left border-b border-slate-200 text-slate-700">Holiday</th>
                <th className="bg-slate-50 font-semibold py-2 px-3 text-left border-b border-slate-200 text-slate-700">Total</th>
              </tr>
            </thead>
            <tbody>
              {report.map((m) => (
                <tr key={m.month} className="even:bg-slate-50">
                  <td className="py-2 px-3 border-b border-slate-200 text-slate-700">{m.month}</td>
                  <td className="py-2 px-3 border-b border-slate-200 text-green-600">{m.Present}</td>
                  <td className="py-2 px-3 border-b border-slate-200 text-amber-600">{m.Late}</td>
                  <td className="py-2 px-3 border-b border-slate-200 text-purple-600">{m.Early}</td>
                  <td className="py-2 px-3 border-b border-slate-200 text-red-600">{m.Absent}</td>
                  <td className="py-2 px-3 border-b border-slate-200 text-slate-500">{m.OffDuty}</td>
                  <td className="py-2 px-3 border-b border-slate-200 text-slate-500">{m.Weekend}</td>
                  <td className="py-2 px-3 border-b border-slate-200 text-yellow-600">{m.Holiday}</td>
                  <td className="py-2 px-3 border-b border-slate-200 text-slate-700">{new Date(year, monthNames.indexOf(m.month) + 1, 0).getDate()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button onClick={onClose} className="py-2 px-4 bg-slate-800 text-white rounded-lg font-medium text-sm transition hover:bg-slate-700">Close</button>
      </div>
    </div>
  );
}

export default EmployeeReportModal;