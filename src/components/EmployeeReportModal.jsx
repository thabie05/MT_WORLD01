import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { monthNames } from '../utils/holidays';

function EmployeeReportModal({ employee, report, year, onClose }) {
  const totalPresent = report.reduce((s, m) => s + m.Present, 0);
  const totalLate = report.reduce((s, m) => s + m.Late, 0);
  const totalEarly = report.reduce((s, m) => s + m.Early, 0);
  const totalAbsent = report.reduce((s, m) => s + m.Absent, 0);
  const totalWeekend = report.reduce((s, m) => s + m.Weekend, 0);
  const totalHoliday = report.reduce((s, m) => s + m.Holiday, 0);
  const totalUnmarked = report.reduce((s, m) => s + m.Unmarked, 0);

  return (
    <div className="history-modal-overlay" onClick={onClose}>
      <div className="history-modal report-modal" onClick={(e) => e.stopPropagation()}>
        <h2>📋 {employee.name} – {year} Attendance Report</h2>
        <div className="report-summary">
          <div className="report-summary-grid">
            <div className="report-stat present"><span>✓ Present</span><strong>{totalPresent}</strong></div>
            <div className="report-stat late"><span>⏰ Late</span><strong>{totalLate}</strong></div>
            <div className="report-stat early"><span>🚪 Early</span><strong>{totalEarly}</strong></div>
            <div className="report-stat absent"><span>✗ Absent</span><strong>{totalAbsent}</strong></div>
            <div className="report-stat weekend"><span>Weekend</span><strong>{totalWeekend}</strong></div>
            <div className="report-stat holiday"><span>Holiday</span><strong>{totalHoliday}</strong></div>
            <div className="report-stat unmarked"><span>Unmarked</span><strong>{totalUnmarked}</strong></div>
          </div>
        </div>
        <div className="report-chart">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={report}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Present" fill="#22c55e" stackId="a" />
              <Bar dataKey="Late" fill="#f59e0b" stackId="a" />
              <Bar dataKey="Early" fill="#8b5cf6" stackId="a" />
              <Bar dataKey="Absent" fill="#ef4444" stackId="a" />
              <Bar dataKey="Weekend" fill="#94a3b8" stackId="a" />
              <Bar dataKey="Holiday" fill="#fbbf24" stackId="a" />
              <Bar dataKey="Unmarked" fill="#e2e8f0" stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="report-table-wrapper">
          <table className="history-table">
            <thead><tr><th>Month</th><th>Present</th><th>Late</th><th>Early</th><th>Absent</th><th>Weekend</th><th>Holiday</th><th>Unmarked</th><th>Total</th></tr></thead>
            <tbody>
              {report.map((m) => (
                <tr key={m.month}>
                  <td>{m.month}</td>
                  <td style={{ color: '#22c55e' }}>{m.Present}</td>
                  <td style={{ color: '#f59e0b' }}>{m.Late}</td>
                  <td style={{ color: '#8b5cf6' }}>{m.Early}</td>
                  <td style={{ color: '#ef4444' }}>{m.Absent}</td>
                  <td style={{ color: '#94a3b8' }}>{m.Weekend}</td>
                  <td style={{ color: '#fbbf24' }}>{m.Holiday}</td>
                  <td style={{ color: '#94a3b8' }}>{m.Unmarked}</td>
                  <td>{new Date(year, monthNames.indexOf(m.month) + 1, 0).getDate()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="close-history-btn" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

export default EmployeeReportModal;