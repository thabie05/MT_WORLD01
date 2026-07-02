import React, { useState } from 'react';
import emailjs from '@emailjs/browser';
import { monthNames } from '../utils/holidays';

const EMAILJS_PUBLIC_KEY = 'gMdPl4OE4ZPnLepft';
const EMAILJS_SERVICE_ID = 'service_4y1jslc';
const EMAILJS_TEMPLATE_ID = 'template_s5kmikd';

function EmailReportModal({ employees, attendance, currentYear, currentMonth, onClose }) {
  const defaultStart = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
  const defaultEnd = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${new Date(currentYear, currentMonth + 1, 0).getDate()}`;
  
  const [recipientEmail, setRecipientEmail] = useState('');
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const formatDateDisplay = (dateStr) => {
    const [y, m, d] = dateStr.split('-');
    return `${d} ${monthNames[parseInt(m) - 1]} ${y}`;
  };

  const getDateRangeArray = () => {
    const dates = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start) || isNaN(end) || start > end) return dates;
    const current = new Date(start);
    while (current <= end) {
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, '0');
      const d = String(current.getDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${d}`);
      current.setDate(current.getDate() + 1);
    }
    return dates;
  };

  const getReportData = () => {
    const dateRange = getDateRangeArray();
    const sortedEmployees = [...employees].sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );

    const reportRows = sortedEmployees.map((emp) => {
      let present = 0, absent = 0, late = 0, early = 0, off = 0;
      for (const dateKey of dateRange) {
        const status = attendance[emp.id]?.[dateKey];
        if (status === 'present') present++;
        else if (status === 'absent') absent++;
        else if (status === 'late') late++;
        else if (status === 'early') early++;
        else if (status === 'off') off++;
      }
      return { name: emp.name, present, absent, late, early, off, total: present + late + early };
    });

    const totals = reportRows.reduce((acc, row) => ({
      present: acc.present + row.present,
      absent: acc.absent + row.absent,
      late: acc.late + row.late,
      early: acc.early + row.early,
      off: acc.off + row.off,
      total: acc.total + row.total,
    }), { present: 0, absent: 0, late: 0, early: 0, off: 0, total: 0 });
    
    return { reportRows, totals, daysInRange: dateRange.length };
  };

  const buildEmailTable = (reportRows) => {
    let tableHTML = `<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;"><thead style="background:#1e293b;color:white;"><tr><th>#</th><th>Employee</th><th>✓ Present</th><th>⏰ Late</th><th>🚪 Early</th><th>✗ Absent</th><th>📋 Off Duty</th><th>Days Worked</th></tr></thead><tbody>`;
    reportRows.forEach((row, i) => {
      tableHTML += `<tr style="background:${i % 2 === 0 ? '#f8fafc' : '#fff'};"><td style="text-align:center;">${i + 1}</td><td>${row.name}</td><td style="text-align:center;color:#22c55e;">${row.present}</td><td style="text-align:center;color:#f59e0b;">${row.late}</td><td style="text-align:center;color:#8b5cf6;">${row.early}</td><td style="text-align:center;color:#ef4444;">${row.absent}</td><td style="text-align:center;color:#94a3b8;">${row.off}</td><td style="text-align:center;font-weight:bold;">${row.total}</td></tr>`;
    });
    tableHTML += `</tbody></table>`;
    return tableHTML;
  };

  // PDF download function
  const handleDownloadPDF = () => {
    const { reportRows, totals, daysInRange } = getReportData();
    const startDisplay = formatDateDisplay(startDate);
    const endDisplay = formatDateDisplay(endDate);
    const tableHTML = buildEmailTable(reportRows);

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>MT WORLD Attendance Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 30px; color: #1e293b; }
          h2 { color: #1a237e; }
          .period { background: #eff6ff; padding: 10px; border-radius: 8px; margin-bottom: 20px; }
          .summary { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px; }
          .stat { background: #f8fafc; border-left: 4px solid #1a237e; padding: 10px 15px; border-radius: 6px; }
          table { border-collapse: collapse; width: 100%; margin-top: 20px; }
          th { background: #1e293b; color: white; padding: 10px; text-align: left; }
          td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
          tr:nth-child(even) td { background: #f8fafc; }
          .footer { margin-top: 30px; color: #64748b; font-size: 0.85rem; text-align: center; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>
        <h2>MT WORLD Attendance Report</h2>
        <div class="period">
          <strong>Period:</strong> ${startDisplay} – ${endDisplay} (${daysInRange} calendar days)<br/>
          <strong>Total Employees:</strong> ${employees.length}
        </div>
        <div class="summary">
          <div class="stat">✅ Present: <strong>${totals.present}</strong></div>
          <div class="stat">⏰ Late: <strong>${totals.late}</strong></div>
          <div class="stat">🚪 Early Leave: <strong>${totals.early}</strong></div>
          <div class="stat">❌ Absent: <strong>${totals.absent}</strong></div>
          <div class="stat">📋 Off Duty: <strong>${totals.off}</strong></div>
          <div class="stat">📊 Total Worked: <strong>${totals.total}</strong></div>
        </div>
        <h4>Detailed Report:</h4>
        ${tableHTML}
        <div class="footer">
          This report was generated by MT WORLD Attendance Register.<br/>
          Built by Thabelo Tshishonga
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  };

  const handleSend = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSending(true);
    const { reportRows, totals, daysInRange } = getReportData();
    const startDisplay = formatDateDisplay(startDate);
    const endDisplay = formatDateDisplay(endDate);
    try {
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
        to_email: recipientEmail,
        start_date: startDisplay,
        end_date: endDisplay,
        report_period: `${startDisplay} – ${endDisplay}`,
        report_table: buildEmailTable(reportRows),
        total_present: String(totals.present),
        total_absent: String(totals.absent),
        total_late: String(totals.late),
        total_early: String(totals.early),
        total_off: String(totals.off),
        total_worked: String(totals.total),
        days_in_period: String(daysInRange),
        employee_count: String(employees.length),
      }, EMAILJS_PUBLIC_KEY);
      setSuccess('Report sent successfully!');
      setTimeout(() => onClose(), 2000);
    } catch (err) {
      setError('Failed to send email.');
    } finally {
      setSending(false);
    }
  };

  const { reportRows, totals, daysInRange } = getReportData();
  const startDisplay = formatDateDisplay(startDate);
  const endDisplay = formatDateDisplay(endDate);

  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-[2000] p-5" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-slate-900 mb-1">📧 Email Report (Custom Dates)</h2>
        <p className="text-slate-500 text-sm mb-4">Select a date range, preview, download or send</p>

        {/* Date Range Selectors */}
        <div className="flex gap-3 mb-4 flex-wrap">
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-semibold text-slate-600 mb-1">Start Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="w-full py-2.5 px-3.5 border border-slate-300 rounded-xl text-sm bg-slate-50 text-slate-800 outline-none focus:border-blue-500" />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-semibold text-slate-600 mb-1">End Date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="w-full py-2.5 px-3.5 border border-slate-300 rounded-xl text-sm bg-slate-50 text-slate-800 outline-none focus:border-blue-500" />
          </div>
        </div>

        {/* Selected Date Range Display */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4">
          <p className="text-sm text-blue-700 font-medium">
            📅 Report Period: <strong>{startDisplay}</strong> – <strong>{endDisplay}</strong>
            <span className="text-blue-500 ml-2">({daysInRange} calendar days)</span>
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-5 gap-3 mb-5 max-md:grid-cols-3 max-sm:grid-cols-2">
          <div className="text-center py-3 px-2 rounded-xl bg-slate-50 border border-slate-200 border-l-4 border-l-green-500">
            <span className="block text-xs text-slate-500 mb-1">✓ Present</span>
            <strong className="text-2xl text-slate-800">{totals.present}</strong>
          </div>
          <div className="text-center py-3 px-2 rounded-xl bg-slate-50 border border-slate-200 border-l-4 border-l-amber-500">
            <span className="block text-xs text-slate-500 mb-1">⏰ Late</span>
            <strong className="text-2xl text-slate-800">{totals.late}</strong>
          </div>
          <div className="text-center py-3 px-2 rounded-xl bg-slate-50 border border-slate-200 border-l-4 border-l-purple-500">
            <span className="block text-xs text-slate-500 mb-1">🚪 Early</span>
            <strong className="text-2xl text-slate-800">{totals.early}</strong>
          </div>
          <div className="text-center py-3 px-2 rounded-xl bg-slate-50 border border-slate-200 border-l-4 border-l-red-500">
            <span className="block text-xs text-slate-500 mb-1">✗ Absent</span>
            <strong className="text-2xl text-slate-800">{totals.absent}</strong>
          </div>
          <div className="text-center py-3 px-2 rounded-xl bg-slate-50 border border-slate-200 border-l-4 border-l-slate-500">
            <span className="block text-xs text-slate-500 mb-1">📋 Off Duty</span>
            <strong className="text-2xl text-slate-800">{totals.off}</strong>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="py-2 px-4 bg-slate-100 border border-slate-200 rounded-xl font-semibold text-sm text-slate-600 hover:bg-slate-200 transition"
          >
            {showPreview ? '🔼 Hide Preview' : '🔽 Show Preview'}
          </button>
          <button
            type="button"
            onClick={handleDownloadPDF}
            className="py-2 px-4 bg-red-500 text-white rounded-xl font-semibold text-sm hover:bg-red-600 transition"
          >
            📄 Download PDF
          </button>
        </div>

        {/* Preview Table – shows exactly what will be emailed */}
        {showPreview && (
          <div className="mb-5 border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
              <span className="text-xs font-semibold text-slate-500">Email Preview</span>
              <span className="text-xs text-slate-400">{startDisplay} – {endDisplay}</span>
            </div>
            <div className="p-2 overflow-x-auto"
              dangerouslySetInnerHTML={{ __html: buildEmailTable(reportRows) }}
            />
          </div>
        )}

        {/* Recipient Email & Send */}
        <form onSubmit={handleSend}>
          <div className="mb-4">
            <label className="block text-sm font-semibold text-slate-600 mb-1.5">Recipient Email</label>
            <input type="email" placeholder="Enter recipient Email" value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)} required
              className="w-full py-2.5 px-3.5 border border-slate-300 rounded-xl text-sm bg-slate-50 text-slate-800 outline-none focus:border-blue-500" />
          </div>
          {error && <p className="text-red-600 text-sm text-center mb-3 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          {success && <p className="text-green-600 text-sm text-center mb-3 bg-green-50 px-3 py-2 rounded-lg">{success}</p>}
          <div className="flex gap-2.5 mt-4">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 px-4 bg-slate-100 border border-slate-200 rounded-xl font-semibold text-sm text-slate-600 hover:bg-slate-200">Cancel</button>
            <button type="submit" disabled={sending} className="flex-1 py-2.5 px-4 bg-indigo-900 text-white rounded-xl font-semibold text-sm hover:bg-indigo-800 disabled:opacity-60">
              {sending ? 'Sending...' : '📧 Send Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EmailReportModal;