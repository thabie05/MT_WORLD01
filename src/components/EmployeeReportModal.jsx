import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// Props (all supplied by AttendanceRegister):
//   employee : { id, name }
//   report   : array of 12 month rows from getEmployeeReport():
//              { month, Present, Late, Early, Absent, OffDuty, Weekend, Holiday, Unmarked }
//   year     : number
//   onClose  : () => void

const COLS = [
  { key: 'Present', label: 'Present', color: '#10B981' },
  { key: 'Late', label: 'Late', color: '#3B82F6' },
  { key: 'Early', label: 'Early', color: '#8B5CF6' },
  { key: 'Absent', label: 'Absent', color: '#EF4444' },
  { key: 'OffDuty', label: 'Off', color: '#6B7280' },
  { key: 'Holiday', label: 'Holiday', color: '#FBBF24' },
  { key: 'Unmarked', label: 'Unmarked', color: '#374151' },
];

function EmployeeReportModal({ employee, report, year, onClose }) {
  const totals = useMemo(() => {
    const t = {};
    COLS.forEach((c) => (t[c.key] = 0));
    report.forEach((row) => COLS.forEach((c) => (t[c.key] += row[c.key] || 0)));
    return t;
  }, [report]);

  const daysWorked = totals.Present + totals.Late + totals.Early;
  const markedWorkdays = daysWorked + totals.Absent + totals.OffDuty;
  const attendanceRate = markedWorkdays > 0 ? Math.round((daysWorked / (daysWorked + totals.Absent)) * 100) || 0 : 0;

  const chartData = report.map((r) => ({
    month: r.month.slice(0, 3),
    Present: r.Present,
    Late: r.Late,
    Early: r.Early,
    Absent: r.Absent,
  }));

  return (
    <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-[2000] p-5" onClick={onClose}>
      <div
        className="bg-card rounded-2xl p-6 w-full max-w-5xl max-h-[88vh] shadow-2xl flex flex-col border border-main"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-bold text-accent">📊 {employee.name}</h2>
            <p className="text-muted text-sm">Attendance report for {year}</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-main text-2xl leading-none transition">
            &times;
          </button>
        </div>

        <div className="overflow-y-auto flex-1 space-y-5 pr-1 custom-scrollbar">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-input border border-main rounded-xl p-3">
              <p className="text-muted text-xs uppercase tracking-wider">Days worked</p>
              <p className="text-2xl font-bold text-emerald-400">{daysWorked}</p>
            </div>
            <div className="bg-input border border-main rounded-xl p-3">
              <p className="text-muted text-xs uppercase tracking-wider">Absent</p>
              <p className="text-2xl font-bold text-red-400">{totals.Absent}</p>
            </div>
            <div className="bg-input border border-main rounded-xl p-3">
              <p className="text-muted text-xs uppercase tracking-wider">Late / Early</p>
              <p className="text-2xl font-bold text-main">
                <span className="text-blue-400">{totals.Late}</span>
                <span className="text-muted"> / </span>
                <span className="text-purple-400">{totals.Early}</span>
              </p>
            </div>
            <div className="bg-input border border-main rounded-xl p-3">
              <p className="text-muted text-xs uppercase tracking-wider">Attendance rate</p>
              <p className="text-2xl font-bold text-main">{daysWorked + totals.Absent > 0 ? `${attendanceRate}%` : '—'}</p>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-input border border-main rounded-xl p-4">
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
                  <XAxis dataKey="month" tick={{ fill: 'currentColor', fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fill: 'currentColor', fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Present" stackId="a" fill="#10B981" />
                  <Bar dataKey="Late" stackId="a" fill="#3B82F6" />
                  <Bar dataKey="Early" stackId="a" fill="#8B5CF6" />
                  <Bar dataKey="Absent" stackId="a" fill="#EF4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Month-by-month table */}
          <div className="border border-main rounded-lg overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-input">
                <tr>
                  <th className="py-2 px-3 text-left border-b border-main text-accent font-semibold">Month</th>
                  {COLS.map((c) => (
                    <th key={c.key} className="py-2 px-3 text-center border-b border-main text-accent font-semibold">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.map((row) => (
                  <tr key={row.month} className="even:bg-card hover:bg-accent-light transition-colors">
                    <td className="py-2 px-3 border-b border-main text-main font-medium">{row.month}</td>
                    {COLS.map((c) => (
                      <td
                        key={c.key}
                        className="py-2 px-3 border-b border-main text-center font-mono"
                        style={{ color: row[c.key] ? c.color : undefined, opacity: row[c.key] ? 1 : 0.35 }}
                      >
                        {row[c.key] || '–'}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="bg-accent-soft font-bold">
                  <td className="py-2 px-3 text-main">Year total</td>
                  {COLS.map((c) => (
                    <td key={c.key} className="py-2 px-3 text-center font-mono" style={{ color: c.color }}>
                      {totals[c.key]}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-muted text-xs">Weekends are excluded. Unmarked = weekdays with no attendance entry yet.</p>
        </div>
      </div>
    </div>
  );
}

export default EmployeeReportModal;