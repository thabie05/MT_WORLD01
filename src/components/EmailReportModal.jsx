import React, { useState } from 'react';
import emailjs from '@emailjs/browser';
import { monthNames } from '../utils/holidays';

// Replace these with your EmailJS credentials
const EMAILJS_PUBLIC_KEY = 'gMdPl4OE4ZPnLepft';
const EMAILJS_SERVICE_ID = 'service_xu24ngt';
const EMAILJS_TEMPLATE_ID = 'template_s5kmikd';

function EmailReportModal({ employees, attendance, currentYear, currentMonth, onClose }) {
  const [recipientEmail, setRecipientEmail] = useState('thabieshooer@gmail.com');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Calculate report data
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

    const totals = reportRows.reduce(
      (acc, row) => ({
        present: acc.present + row.present,
        absent: acc.absent + row.absent,
        late: acc.late + row.late,
        early: acc.early + row.early,
        unmarked: acc.unmarked + row.unmarked,
        total: acc.total + row.total,
      }),
      { present: 0, absent: 0, late: 0, early: 0, unmarked: 0, total: 0 }
    );

    return { reportRows, totals, daysInMonth };
  };

  // Build HTML table for email
  const buildEmailTable = (reportRows) => {
    let tableHTML = `
      <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;">
        <thead style="background:#1a237e;color:white;">
          <tr>
            <th>#</th><th>Employee</th><th>✓ Present</th><th>⏰ Late</th><th>🚪 Early</th><th>✗ Absent</th><th>❓ Unmarked</th><th>Total Worked</th>
          </tr>
        </thead>
        <tbody>`;

    reportRows.forEach((row, index) => {
      const bgColor = index % 2 === 0 ? '#f8fafc' : '#ffffff';
      tableHTML += `
        <tr style="background:${bgColor};">
          <td style="text-align:center;">${index + 1}</td>
          <td>${row.name}</td>
          <td style="text-align:center;color:#22c55e;">${row.present}</td>
          <td style="text-align:center;color:#f59e0b;">${row.late}</td>
          <td style="text-align:center;color:#8b5cf6;">${row.early}</td>
          <td style="text-align:center;color:#ef4444;">${row.absent}</td>
          <td style="text-align:center;color:#94a3b8;">${row.unmarked}</td>
          <td style="text-align:center;font-weight:bold;">${row.total}</td>
        </tr>`;
    });

    tableHTML += `</tbody></table>`;
    return tableHTML;
  };

  const handleSend = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSending(true);

    const { reportRows, totals, daysInMonth } = getReportData();
    const tableHTML = buildEmailTable(reportRows);

    const templateParams = {
      to_email: recipientEmail,
      month_name: monthNames[currentMonth],
      year: currentYear,
      report_table: tableHTML,
      total_present: totals.present,
      total_absent: totals.absent,
      total_late: totals.late,
      total_early: totals.early,
      total_unmarked: totals.unmarked,
      total_worked: totals.total,
      days_in_month: daysInMonth,
      employee_count: employees.length,
    };

    try {
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams, EMAILJS_PUBLIC_KEY);
      setSuccess('Monthly report sent successfully!');
      setTimeout(() => onClose(), 2000);
    } catch (err) {
      console.error('Failed to send email:', err);
      setError('Failed to send email. Check your EmailJS setup.');
    } finally {
      setSending(false);
    }
  };

  // Preview data
  const { reportRows, totals, daysInMonth } = getReportData();

  return (
    <div className="history-modal-overlay" onClick={onClose}>
      <div className="history-modal report-modal" onClick={(e) => e.stopPropagation()}>
        <h2>📧 Email Monthly Report</h2>
        <p style={{ color: '#64748b', marginBottom: '16px', fontSize: '0.9rem' }}>
          Send {monthNames[currentMonth]} {currentYear} attendance report to manager
        </p>

        {/* Summary Preview */}
        <div className="report-summary-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', marginBottom: '20px' }}>
          <div className="report-stat present"><span>✓ Present</span><strong>{totals.present}</strong></div>
          <div className="report-stat late"><span>⏰ Late</span><strong>{totals.late}</strong></div>
          <div className="report-stat early"><span>🚪 Early</span><strong>{totals.early}</strong></div>
          <div className="report-stat absent"><span>✗ Absent</span><strong>{totals.absent}</strong></div>
          <div className="report-stat unmarked"><span>❓ Unmarked</span><strong>{totals.unmarked}</strong></div>
        </div>

        {/* Recipient Email */}
        <form onSubmit={handleSend}>
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '0.85rem' }}>
              Recipient Email
            </label>
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 14px',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '0.95rem',
                outline: 'none',
              }}
            />
          </div>

          {error && <p className="error-msg">{error}</p>}
          {success && <p className="success-msg">{success}</p>}

          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <button type="button" onClick={onClose} className="cancel-btn" style={{ flex: 1 }}>Cancel</button>
            <button type="submit" className="save-btn" disabled={sending} style={{ flex: 1 }}>
              {sending ? 'Sending...' : '📧 Send Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EmailReportModal;