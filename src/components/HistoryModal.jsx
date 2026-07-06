import React from 'react';

function HistoryModal({ history, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-[2000] p-5" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-4xl max-h-[80vh] shadow-2xl flex flex-col relative" onClick={(e) => e.stopPropagation()}>
        
        {/* ── Fixed header with title & exit button ── */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-slate-900">Attendance Edit History</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* ── Scrollable table area ── */}
        {history.length === 0 ? (
          <p className="text-slate-500">No edits recorded yet.</p>
        ) : (
          <div className="overflow-y-auto flex-1 border border-slate-200 rounded-lg">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-slate-50 z-10">
                <tr>
                  <th className="font-semibold py-2 px-3 text-left border-b border-slate-200 text-slate-700">Editor</th>
                  <th className="font-semibold py-2 px-3 text-left border-b border-slate-200 text-slate-700">Employee</th>
                  <th className="font-semibold py-2 px-3 text-left border-b border-slate-200 text-slate-700">Day</th>
                  <th className="font-semibold py-2 px-3 text-left border-b border-slate-200 text-slate-700">Date</th>
                  <th className="font-semibold py-2 px-3 text-left border-b border-slate-200 text-slate-700">Status</th>
                  <th className="font-semibold py-2 px-3 text-left border-b border-slate-200 text-slate-700">Note</th>
                  <th className="font-semibold py-2 px-3 text-left border-b border-slate-200 text-slate-700">Time</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => (
                  <tr key={entry.id} className="even:bg-slate-50">
                    <td className="py-2 px-3 border-b border-slate-200 text-slate-700">{entry.editor}</td>
                    <td className="py-2 px-3 border-b border-slate-200 text-slate-700">{entry.employeeName}</td>
                    <td className="py-2 px-3 border-b border-slate-200 text-slate-700">{entry.day}</td>
                    <td className="py-2 px-3 border-b border-slate-200 text-slate-700">{entry.date}</td>
                    <td className="py-2 px-3 border-b border-slate-200 text-slate-700">{entry.status}</td>
                    <td className="py-2 px-3 border-b border-slate-200 text-slate-500">{entry.note || '-'}</td>
                    <td className="py-2 px-3 border-b border-slate-200 text-slate-500">{new Date(entry.editedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Fixed footer with Close button ── */}
        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="py-2 px-4 bg-slate-800 text-white rounded-lg font-medium text-sm transition hover:bg-slate-700">Close</button>
        </div>
      </div>
    </div>
  );
}

export default HistoryModal;