import React, { useState, useMemo } from 'react';
import emailjs from '@emailjs/browser';
import {
  Mail,
  Users,
  UserCheck,
  UserX,
  Clock,
  Send,
  Copy,
  Download,
  CheckCircle,
  BarChart3,
  FileText,
  Printer,
} from 'lucide-react';
import { monthNames } from '../utils/holidays';

// EmailJS configuration (same as your modal)
const EMAILJS_PUBLIC_KEY = 'gMdPl4OE4ZPnLepft';
const EMAILJS_SERVICE_ID = 'service_4y1jslc';
const EMAILJS_TEMPLATE_ID = 'template_s5kmikd';

const parseLocalDate = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const escapeHtml = (str) =>
  String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));

function EmailReportsPage({ employees, attendance, currentUser }) {
  const today = new Date();
  const defaultStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  const defaultEnd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()}`;

  const [recipientEmail, setRecipientEmail] = useState('');
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const formatDateDisplay = (dateStr) => {
    const [y, m, d] = dateStr.split('-');
    return `${d} ${monthNames[parseInt(m) - 1]} ${y}`;
  };

  const getDateRangeArray = () => {
    const dates = [];
    const start = parseLocalDate(startDate);
    const end = parseLocalDate(endDate);
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
      tableHTML += `<tr style="background:${i % 2 === 0 ? '#f8fafc' : '#fff'};"><td style="text-align:center;">${i + 1}</td><td>${escapeHtml(row.name)}</td><td style="text-align:center;color:#22c55e;">${row.present}</td><td style="text-align:center;color:#f59e0b;">${row.late}</td><td style="text-align:center;color:#8b5cf6;">${row.early}</td><td style="text-align:center;color:#ef4444;">${row.absent}</td><td style="text-align:center;color:#94a3b8;">${row.off}</td><td style="text-align:center;font-weight:bold;">${row.total}</td></tr>`;
    });
    tableHTML += `</tbody></table>`;
    return tableHTML;
  };

  const handleDownloadPDF = () => {
    const { reportRows, totals, daysInRange } = getReportData();
    const startDisplay = formatDateDisplay(startDate);
    const endDisplay = formatDateDisplay(endDate);

    let tableRowsHTML = '';
    reportRows.forEach((row, i) => {
      const bg = i % 2 === 0 ? '#f8fafc' : '#ffffff';
      tableRowsHTML += `
        <tr style="background:${bg};">
          <td style="padding:12px;text-align:center;color:#6b7280;">${i + 1}</td>
          <td style="padding:12px;font-weight:500;color:#1e293b;">${escapeHtml(row.name)}</td>
          <td style="padding:12px;text-align:center;font-weight:500;color:${row.present > 0 ? '#16a34a' : '#9ca3af'};">${row.present}</td>
          <td style="padding:12px;text-align:center;font-weight:500;color:${row.late > 0 ? '#f97316' : '#9ca3af'};">${row.late}</td>
          <td style="padding:12px;text-align:center;font-weight:500;color:${row.early > 0 ? '#7c3aed' : '#9ca3af'};">${row.early}</td>
          <td style="padding:12px;text-align:center;font-weight:500;color:${row.absent > 0 ? '#dc2626' : '#9ca3af'};">${row.absent}</td>
          <td style="padding:12px;text-align:center;font-weight:500;color:${row.off > 0 ? '#4b5563' : '#9ca3af'};">${row.off}</td>
          <td style="padding:12px;text-align:center;font-weight:700;color:#1e293b;background:#f8fafc;">${row.total}</td>
        </tr>`;
    });

    const printContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>MT WORLD Attendance Report</title>
        <style>
          * { margin:0; padding:0; box-sizing:border-box; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background:#f3f4f6; }
          .report-container { max-width:1000px; margin:30px auto; background:#fff; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,0.1); overflow:hidden; }
          @media print { body { background:#fff; } .report-container { box-shadow:none; margin:0; } }
        </style>
      </head>
      <body>
        <div class="report-container">
          <div style="background:#0f172a;color:#fff;padding:24px 30px;position:relative;">
            <img src="https://mtworldrollcall.web.app/logo.png" alt="MT WORLD Logo" style="position:absolute; top:24px; right:30px; max-height:60px;" />
            <h1 style="font-size:24px;font-weight:700;">MT WORLD Attendance Report</h1>
            <div style="margin-top:12px;color:#cbd5e1;">
              <p><span style="font-weight:600;color:#fff;">Period:</span> ${startDisplay} – ${endDisplay} (${daysInRange} calendar days)</p>
              <p><span style="font-weight:600;color:#fff;">Total Employees:</span> ${employees.length}</p>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:12px;padding:24px;border-bottom:1px solid #e5e7eb;">
            <div style="display:flex;align-items:center;padding:16px;border-radius:8px;background:#f0fdf4;border:1px solid #e5e7eb;">
              <span style="font-size:20px;margin-right:10px;">✅</span>
              <div><p style="font-size:12px;color:#6b7280;">Present</p><p style="font-size:18px;font-weight:700;color:#16a34a;">${totals.present}</p></div>
            </div>
            <div style="display:flex;align-items:center;padding:16px;border-radius:8px;background:#fff7ed;border:1px solid #e5e7eb;">
              <span style="font-size:20px;margin-right:10px;">⏰</span>
              <div><p style="font-size:12px;color:#6b7280;">Late</p><p style="font-size:18px;font-weight:700;color:#f97316;">${totals.late}</p></div>
            </div>
            <div style="display:flex;align-items:center;padding:16px;border-radius:8px;background:#fefce8;border:1px solid #e5e7eb;">
              <span style="font-size:20px;margin-right:10px;">🚪</span>
              <div><p style="font-size:12px;color:#6b7280;">Early Leave</p><p style="font-size:18px;font-weight:700;color:#a16207;">${totals.early}</p></div>
            </div>
            <div style="display:flex;align-items:center;padding:16px;border-radius:8px;background:#fef2f2;border:1px solid #e5e7eb;">
              <span style="font-size:20px;margin-right:10px;">❌</span>
              <div><p style="font-size:12px;color:#6b7280;">Absent</p><p style="font-size:18px;font-weight:700;color:#dc2626;">${totals.absent}</p></div>
            </div>
            <div style="display:flex;align-items:center;padding:16px;border-radius:8px;background:#f9fafb;border:1px solid #e5e7eb;">
              <span style="font-size:20px;margin-right:10px;">📋</span>
              <div><p style="font-size:12px;color:#6b7280;">Off Duty</p><p style="font-size:18px;font-weight:700;color:#4b5563;">${totals.off}</p></div>
            </div>
            <div style="display:flex;align-items:center;padding:16px;border-radius:8px;background:#eff6ff;border:1px solid #e5e7eb;">
              <span style="font-size:20px;margin-right:10px;">📊</span>
              <div><p style="font-size:12px;color:#6b7280;">Total Worked</p><p style="font-size:18px;font-weight:700;color:#2563eb;">${totals.total}</p></div>
            </div>
          </div>
          <div style="padding:24px;">
            <h2 style="font-size:20px;font-weight:700;color:#1e293b;margin-bottom:16px;">Detailed Report</h2>
            <table style="width:100%;border-collapse:collapse;">
              <thead>
                <tr style="background:#1e293b;color:#fff;">
                  <th style="padding:12px;border-radius:8px 0 0 0;font-weight:600;text-align:center;">#</th>
                  <th style="padding:12px;font-weight:600;text-align:left;">Employee</th>
                  <th style="padding:12px;font-weight:600;text-align:center;">✓ Present</th>
                  <th style="padding:12px;font-weight:600;text-align:center;">⏰ Late</th>
                  <th style="padding:12px;font-weight:600;text-align:center;">🚪 Early</th>
                  <th style="padding:12px;font-weight:600;text-align:center;">✗ Absent</th>
                  <th style="padding:12px;font-weight:600;text-align:center;">📋 Off Duty</th>
                  <th style="padding:12px;border-radius:0 8px 0 0;font-weight:600;text-align:center;">Days Worked</th>
                </tr>
              </thead>
              <tbody>
                ${tableRowsHTML}
              </tbody>
            </table>
          </div>
          <div style="text-align:center;padding:20px;color:#94a3b8;font-size:12px;border-top:1px solid #e5e7eb;">
            This report was generated by MT WORLD Attendance Register.<br/>
            Built by Thabelo Tshishonga
          </div>
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
      setTimeout(() => {
        setSuccess('');
        setRecipientEmail('');
      }, 3000);
    } catch (err) {
      setError('Failed to send email. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleCopyReport = () => {
    const { reportRows, totals, daysInRange } = getReportData();
    const startDisplay = formatDateDisplay(startDate);
    const endDisplay = formatDateDisplay(endDate);
    let text = `Attendance Report – ${startDisplay} to ${endDisplay}\n`;
    text += `Total Employees: ${employees.length}\n`;
    text += `Present: ${totals.present}\nLate: ${totals.late}\nEarly: ${totals.early}\nAbsent: ${totals.absent}\nOff Duty: ${totals.off}\nTotal Worked: ${totals.total}\n\n`;
    text += `Employee Breakdown:\n`;
    text += `Name\tPresent\tLate\tEarly\tAbsent\tOff\tTotal\n`;
    reportRows.forEach(row => {
      text += `${row.name}\t${row.present}\t${row.late}\t${row.early}\t${row.absent}\t${row.off}\t${row.total}\n`;
    });
    navigator.clipboard.writeText(text);
    alert('Report copied to clipboard!');
  };

  const handleDownloadCSV = () => {
    const { reportRows } = getReportData();
    const headers = ['Name', 'Present', 'Late', 'Early', 'Absent', 'Off', 'Total'];
    const rows = reportRows.map((row) => [
      row.name,
      row.present,
      row.late,
      row.early,
      row.absent,
      row.off,
      row.total,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-report-${startDate}-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const { reportRows, totals, daysInRange } = getReportData();
  const startDisplay = formatDateDisplay(startDate);
  const endDisplay = formatDateDisplay(endDate);

  return (
    <div className="w-full p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-main flex items-center gap-2">
            <Mail className="text-accent" size={28} />
            Email Reports
          </h1>
          <p className="text-muted text-sm mt-1">Generate and send attendance reports</p>
        </div>
        <div className="flex items-center gap-2 bg-card border border-main rounded-lg p-1.5 shadow-theme">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-input text-main text-sm rounded-md px-2 py-1 outline-none focus:border-accent border border-main"
          />
          <span className="text-muted">—</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-input text-main text-sm rounded-md px-2 py-1 outline-none focus:border-accent border border-main"
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <div className="bg-card border border-main rounded-xl p-3 shadow-theme text-center">
          <Users size={18} className="text-accent mx-auto mb-1" />
          <p className="text-xs text-muted">Employees</p>
          <p className="text-xl font-bold text-main">{employees.length}</p>
        </div>
        <div className="bg-card border border-main rounded-xl p-3 shadow-theme text-center">
          <UserCheck size={18} className="text-emerald-400 mx-auto mb-1" />
          <p className="text-xs text-muted">Present</p>
          <p className="text-xl font-bold text-main">{totals.present}</p>
        </div>
        <div className="bg-card border border-main rounded-xl p-3 shadow-theme text-center">
          <Clock size={18} className="text-blue-400 mx-auto mb-1" />
          <p className="text-xs text-muted">Late</p>
          <p className="text-xl font-bold text-main">{totals.late}</p>
        </div>
        <div className="bg-card border border-main rounded-xl p-3 shadow-theme text-center">
          <UserX size={18} className="text-purple-400 mx-auto mb-1" />
          <p className="text-xs text-muted">Early</p>
          <p className="text-xl font-bold text-main">{totals.early}</p>
        </div>
        <div className="bg-card border border-main rounded-xl p-3 shadow-theme text-center">
          <UserX size={18} className="text-red-400 mx-auto mb-1" />
          <p className="text-xs text-muted">Absent</p>
          <p className="text-xl font-bold text-main">{totals.absent}</p>
        </div>
        <div className="bg-card border border-main rounded-xl p-3 shadow-theme text-center">
          <BarChart3 size={18} className="text-gray-400 mx-auto mb-1" />
          <p className="text-xs text-muted">Total Entries</p>
          <p className="text-xl font-bold text-main">{totals.total}</p>
        </div>
      </div>

      {/* Employee Table */}
      <div className="bg-card border border-main rounded-xl shadow-theme overflow-hidden">
        <div className="px-4 py-3 border-b border-main flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-main flex items-center gap-2">
            <FileText size={16} className="text-accent" />
            Employee Breakdown
            <span className="text-xs text-muted font-normal ml-1">
              ({reportRows.length} employees)
            </span>
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyReport}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-input hover:bg-accent-light text-main rounded-md text-xs font-medium transition border border-main"
            >
              <Copy size={14} />
              Copy
            </button>
            <button
              onClick={handleDownloadCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-input hover:bg-accent-light text-main rounded-md text-xs font-medium transition border border-main"
            >
              <Download size={14} />
              CSV
            </button>
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-input hover:bg-accent-light text-main rounded-md text-xs font-medium transition border border-main"
            >
              <Printer size={14} />
              PDF
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-accent-light/50 border-b border-main">
              <tr>
                <th className="text-left py-2 px-3 font-medium text-muted text-xs uppercase tracking-wider">Employee</th>
                <th className="text-center py-2 px-2 font-medium text-emerald-400 text-xs uppercase tracking-wider">Present</th>
                <th className="text-center py-2 px-2 font-medium text-blue-400 text-xs uppercase tracking-wider">Late</th>
                <th className="text-center py-2 px-2 font-medium text-purple-400 text-xs uppercase tracking-wider">Early</th>
                <th className="text-center py-2 px-2 font-medium text-red-400 text-xs uppercase tracking-wider">Absent</th>
                <th className="text-center py-2 px-2 font-medium text-gray-400 text-xs uppercase tracking-wider">Off</th>
                <th className="text-center py-2 px-2 font-medium text-accent text-xs uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody>
              {reportRows.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-muted text-sm">
                    No employees found for this date range.
                  </td>
                </tr>
              ) : (
                reportRows.map((row, idx) => (
                  <tr key={idx} className="border-b border-main/50 hover:bg-accent-light/30 transition-colors">
                    <td className="py-2 px-3 font-medium text-main">{row.name}</td>
                    <td className="text-center py-2 px-2 text-emerald-400 font-medium">{row.present}</td>
                    <td className="text-center py-2 px-2 text-blue-400 font-medium">{row.late}</td>
                    <td className="text-center py-2 px-2 text-purple-400 font-medium">{row.early}</td>
                    <td className="text-center py-2 px-2 text-red-400 font-medium">{row.absent}</td>
                    <td className="text-center py-2 px-2 text-gray-400 font-medium">{row.off}</td>
                    <td className="text-center py-2 px-2 text-accent font-bold">{row.total}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Send Email Section */}
      <div className="mt-6 bg-card border border-main rounded-xl p-6 shadow-theme">
        <h2 className="text-sm font-semibold text-main mb-4 flex items-center gap-2">
          <Send size={16} className="text-accent" />
          Send Report via Email
        </h2>
        <form onSubmit={handleSend} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-main mb-1">Recipient Email</label>
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="hr@company.com"
              required
              className="w-full bg-input border border-main rounded-lg px-4 py-2.5 text-sm text-main outline-none focus:border-accent"
            />
          </div>
          <div className="bg-accent-light/30 rounded-lg p-3 text-sm text-main">
            <p className="font-medium mb-1">📋 Report Preview</p>
            <p className="text-xs text-muted">
              Period: <strong>{startDisplay}</strong> – <strong>{endDisplay}</strong>
            </p>
            <p className="text-xs text-muted">
              Employees: {employees.length} &nbsp;|&nbsp; Total Entries: {totals.total}
            </p>
          </div>
          {error && <p className="text-red-400 text-sm bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>}
          {success && <p className="text-emerald-400 text-sm bg-emerald-500/10 px-3 py-2 rounded-lg">{success}</p>}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={sending}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-accent text-black dark:text-white rounded-lg font-medium hover:bg-accent-hover transition disabled:opacity-60"
            >
              {sending ? (
                'Sending...'
              ) : (
                <>
                  <Send size={18} />
                  Send Report
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EmailReportsPage;