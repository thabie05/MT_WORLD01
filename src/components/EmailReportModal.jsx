import React, { useState } from 'react';
import emailjs from '@emailjs/browser';
import { monthNames } from '../utils/holidays';

const EMAILJS_PUBLIC_KEY = 'gMdPl4OE4ZPnLepft';
const EMAILJS_SERVICE_ID = 'service_xu24ngt';
const EMAILJS_TEMPLATE_ID = 'template_s5kmikd';

function EmailReportModal({ employees, attendance, currentYear, currentMonth, onClose }) {
  const [recipientEmail, setRecipientEmail] = useState('thabieshooter@gmail.com');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const getReportData = () => {
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const reportRows = employees.map((emp) => {
      let present = 0, absent = 0, late = 0, early = 0, unmarked = 0;
      for (const day of daysArray) {
        const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const status = attendance[emp.id]?.[dateKey];
        if (status === 'present') present++;
        else if (status === 'absent') absent++;
        else if (status === 'late') late++;
        else if (status === 'early') early++;
        else unmarked++;
      }
      return { name: emp.name, present, absent, late, early, unmarked, total: present + late + early };
    });
    const totals = reportRows.reduce((acc, row) => ({
      present: acc.present + row.present, absent: acc.absent + row.absent,
      late: acc.late + row.late, early: acc.early + row.early,
      unmarked: acc.unmarked + row.unmarked, total: acc.total + row.total,
    }), { present: 0, absent: 0, late: 0, early: 0, unmarked: 0, total: 0 });
    return { reportRows, totals, daysInMonth };
  };

  const buildEmailTable = (reportRows) => {
    let tableHTML = `<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;"><thead style="background:#1e293b;color:white;"><tr><th>#</th><th>Employee</th><th>✓ Present</th><th>⏰ Late</th><th>🚪 Early</th><th>✗ Absent</th><th>❓ Unmarked</th><th>Total</th></tr></thead><tbody>`;
    reportRows.forEach((row, i) => {
      tableHTML += `<tr style="background:${i % 2 === 0 ? '#f8fafc' : '#fff'};"><td style="text-align:center;">${i + 1}</td><td>${row.name}</td><td style="text-align:center;color:#22c55e;">${row.present}</td><td style="text-align:center;color:#f59e0b;">${row.late}</td><td style="text-align:center;color:#8b5cf6;">${row.early}</td><td style="text-align:center;color:#ef4444;">${row.absent}</td><td style="text-align:center;color:#94a3b8;">${row.unmarked}</td><td style="text-align:center;font-weight:bold;">${row.total}</td></tr>`;
    });
    tableHTML += `</tbody></table>`;
    return tableHTML;
  };

  const handleSend = async (e) => {
    e.preventDefault();
    setError(''); setSuccess(''); setSending(true);
    const { reportRows, totals, daysInMonth } = getReportData();
    try {
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
        to_email: recipientEmail, month_name: monthNames[currentMonth], year: currentYear,
        report_table: buildEmailTable(reportRows), total_present: totals.present, total_absent: totals.absent,
        total_late: totals.late, total_early: totals.early, total_unmarked: totals.unmarked,
        total_worked: totals.total, days_in_month: daysInMonth, employee_count: employees.length,
      }, EMAILJS_PUBLIC_KEY);
      setSuccess('Monthly report sent successfully!');
      setTimeout(() => onClose(), 2000);
    } catch (err) {
      setError('Failed to send email.');
    } finally {
      setSending(false);
    }
  };

  const { reportRows, totals } = getReportData();

  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-[2000] p-5" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-4xl max-h-[85vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-slate-900 mb-1">📧 Email Monthly Report</h2>
        <p className="text-slate-500 text-sm mb-4">Send {monthNames[currentMonth]} {currentYear} attendance report</p>
        <div className="grid grid-cols-5 gap-3 mb-5 max-md:grid-cols-3 max-sm:grid-cols-2">
          <div className="text-center py-3 px-2 rounded-xl bg-slate-50 border border-slate-200 border-l-4 border-l-green-500"><span className="block text-xs text-slate-500 mb-1">✓ Present</span><strong className="text-2xl text-slate-800">{totals.present}</strong></div>
          <div className="text-center py-3 px-2 rounded-xl bg-slate-50 border border-slate-200 border-l-4 border-l-amber-500"><span className="block text-xs text-slate-500 mb-1">⏰ Late</span><strong className="text-2xl text-slate-800">{totals.late}</strong></div>
          <div className="text-center py-3 px-2 rounded-xl bg-slate-50 border border-slate-200 border-l-4 border-l-purple-500"><span className="block text-xs text-slate-500 mb-1">🚪 Early</span><strong className="text-2xl text-slate-800">{totals.early}</strong></div>
          <div className="text-center py-3 px-2 rounded-xl bg-slate-50 border border-slate-200 border-l-4 border-l-red-500"><span className="block text-xs text-slate-500 mb-1">✗ Absent</span><strong className="text-2xl text-slate-800">{totals.absent}</strong></div>
          <div className="text-center py-3 px-2 rounded-xl bg-slate-50 border border-slate-200 border-l-4 border-l-slate-300"><span className="block text-xs text-slate-500 mb-1">❓ Unmarked</span><strong className="text-2xl text-slate-800">{totals.unmarked}</strong></div>
        </div>
        <form onSubmit={handleSend}>
          <div className="mb-4">
            <label className="block text-sm font-semibold text-slate-600 mb-1.5">Recipient Email</label>
            <input type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} required className="w-full py-2.5 px-3.5 border border-slate-300 rounded-xl text-sm bg-slate-50 text-slate-800 outline-none focus:border-blue-500" />
          </div>
          {error && <p className="text-red-600 text-sm text-center mb-3 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          {success && <p className="text-green-600 text-sm text-center mb-3 bg-green-50 px-3 py-2 rounded-lg">{success}</p>}
          <div className="flex gap-2.5 mt-4">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 px-4 bg-slate-100 border border-slate-200 rounded-xl font-semibold text-sm text-slate-600 hover:bg-slate-200">Cancel</button>
            <button type="submit" disabled={sending} className="flex-1 py-2.5 px-4 bg-indigo-900 text-white rounded-xl font-semibold text-sm hover:bg-indigo-800 disabled:opacity-60">{sending ? 'Sending...' : '📧 Send Report'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EmailReportModal;