import React from 'react';

function HistoryModal({ history, onClose }) {
  return (
    <div className="history-modal-overlay" onClick={onClose}>
      <div className="history-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Attendance Edit History</h2>
        {history.length === 0 ? <p>No edits recorded yet.</p> : (
          <div className="history-table-container">
            <table className="history-table">
              <thead><tr><th>Editor</th><th>Employee</th><th>Day</th><th>Date</th><th>Status</th><th>Note</th><th>Time</th></tr></thead>
              <tbody>
                {history.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.editor}</td>
                    <td>{entry.employeeName}</td>
                    <td>{entry.day}</td>
                    <td>{entry.date}</td>
                    <td>{entry.status}</td>
                    <td>{entry.note || '-'}</td>
                    <td>{new Date(entry.editedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <button className="close-history-btn" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

export default HistoryModal;