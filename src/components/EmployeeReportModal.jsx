import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { monthNames } from '../utils/holidays';

function EmployeeReportModal({ employee, report, year, onClose }) {
  if (!report || !employee) return null;

  const totalPresent = report.reduce((s, m) => s + (m.Present || 0), 0);
  const totalLate = report.reduce((s, m) => s + (m.Late || 0), 0);
  const totalEarly = report.reduce((s, m) => s + (m.Early || 0), 0);
  const totalAbsent = report.reduce((s, m) => s + (m.Absent || 0), 0);
  const totalOffDuty = report.reduce((s, m) => s + (m.OffDuty || 0), 0);
  const totalWeekend = report.reduce((s, m) => s + (m.Weekend || 0), 0);
  const totalHoliday = report.reduce((s, m) => s + (m.Holiday || 0), 0);

  return (
    <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-[2000] p-5" onClick={onClose}>
      <div
        className="bg-card rounded-2xl p-6 w-full max-w-4xl max-h-[85vh] overflow-y-auto shadow-2xl border border-main"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-accent mb-4">
          📋 {employee.name} – {year} Attendance Report
        </h2>

        <div className="grid grid-cols-4 gap-3 mb-5 max-md:grid-cols-4 max-sm:grid-cols-2">
          <div className="text-center py-3 px-2 rounded-xl bg-input border border-main border-l-4 border-l-green-500">
            <span className="block text-xs text-muted mb-1">✓ Present</span>
            <strong className="text-2xl text-main">{totalPresent}</strong>
          </div>
          <div className="text-center py-3 px-2 rounded-xl bg-input border border-main border-l-4 border-l-amber-500">
            <span className="block text-xs text-muted mb-1">⏰ Late</span>
            <strong className="text-2xl text-main">{totalLate}</strong>
          </div>
          <div className="text-center py-3 px-2 rounded-xl bg-input border border-main border-l-4 border-l-purple-500">
            <span className="block text-xs text-muted mb-1">🚪 Early</span>
            <strong className="text-2xl text-main">{totalEarly}</strong>
          </div>
          <div className="text-center py-3 px-2 rounded-xl bg-input border border-main border-l-4 border-l-red-500">
            <span className="block text-xs text-muted mb-1">✗ Absent</span>
            <strong className="text-2xl text-main">{totalAbsent}</strong>
          </div>
          <div className="text-center py-3 px-2 rounded-xl bg-input border border-main border-l-4 border-l-slate-500">
            <span className="block text-xs text-muted mb-1">📋 Off Duty</span>
            <strong className="text-2xl text-main">{totalOffDuty}</strong>
          </div>
          <div className="text-center py-3 px-2 rounded-xl bg-input border border-main border-l-4 border-l-slate-400">
            <span className="block text-xs text-muted mb-1">📅 Weekend</span>
            <strong className="text-2xl text-main">{totalWeekend}</strong>
          </div>
          <div className="text-center py-3 px-2 rounded-xl bg-input border border-main border-l-4 border-l-yellow-400">
            <span className="block text-xs text-muted mb-1">🎉 Holiday</span>
            <strong className="text-2xl text-main">{totalHoliday}</strong>
          </div>
        </div>

        <div className="mb-5 bg-input p-4 rounded-xl border border-main">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={report}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-main)',
                }}
              />
              <Legend wrapperStyle={{ color: 'var(--text-muted)' }} />
              <Bar dataKey="Present" fill="#22c55e" stackId="a" />
              <Bar dataKey="Late" fill="#f59e0b" stackId="a" />
              <Bar dataKey="Early" fill="#8b5cf6" stackId="a" />
              <Bar dataKey="Absent" fill="#ef4444" stackId="a" />
              <Bar dataKey="OffDuty" fill="#94a3b8" stackId="a" />
              <Bar dataKey="Weekend" fill="#475569" stackId="a" />
              <Bar dataKey="Holiday" fill="#fbbf24" stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="overflow-x-auto mb-4 border border-main rounded-lg custom-scrollbar">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-input">
                <th className="font-semibold py-2 px-3 text-left border-b border-main text-accent">
                  Month
                </th>
                <th className="font-semibold py-2 px-3 text-left border-b border-main text-accent">
                  Present
                </th>
                <th className="font-semibold py-2 px-3 text-left border-b border-main text-accent">
                  Late
                </th>
                <th className="font-semibold py-2 px-3 text-left border-b border-main text-accent">
                  Early
                </th>
                <th className="font-semibold py-2 px-3 text-left border-b border-main text-accent">
                  Absent
                </th>
                <th className="font-semibold py-2 px-3 text-left border-b border-main text-accent">
                  Off Duty
                </th>
                <th className="font-semibold py-2 px-3 text-left border-b border-main text-accent">
                  Weekend
                </th>
                <th className="font-semibold py-2 px-3 text-left border-b border-main text-accent">
                  Holiday
                </th>
                <th className="font-semibold py-2 px-3 text-left border-b border-main text-accent">
                  Worked
                </th>
              </tr>
            </thead>
            <tbody>
              {report.map((m) => (
                <tr key={m.month} className="even:bg-card">
                  <td className="py-2 px-3 border-b border-main text-main">{m.month}</td>
                  <td className="py-2 px-3 border-b border-main text-green-600 dark:text-green-400">
                    {m.Present}
                  </td>
                  <td className="py-2 px-3 border-b border-main text-amber-600 dark:text-amber-400">
                    {m.Late}
                  </td>
                  <td className="py-2 px-3 border-b border-main text-purple-600 dark:text-purple-400">
                    {m.Early}
                  </td>
                  <td className="py-2 px-3 border-b border-main text-red-600 dark:text-red-400">
                    {m.Absent}
                  </td>
                  <td className="py-2 px-3 border-b border-main text-slate-600 dark:text-slate-400">
                    {m.OffDuty}
                  </td>
                  <td className="py-2 px-3 border-b border-main text-slate-500 dark:text-slate-500">
                    {m.Weekend}
                  </td>
                  <td className="py-2 px-3 border-b border-main text-yellow-600 dark:text-yellow-400">
                    {m.Holiday}
                  </td>
                  <td className="py-2 px-3 border-b border-main text-main font-semibold">
                    {m.Present + m.Late + m.Early}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button
          onClick={onClose}
          className="btn-accent py-2 px-4 rounded-lg font-medium text-sm hover:opacity-90 transition"
        >
          Close
        </button>
      </div>
    </div>
  );
}

export default EmployeeReportModal;