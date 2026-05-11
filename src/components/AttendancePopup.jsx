import React from 'react';
import { createPortal } from 'react-dom';

function AttendancePopup({ popup, popupNote, setPopupNote, popupRef, onMark, onClear, isAdmin, isLocked }) {
  if (!popup) return null;

  return createPortal(
    <div ref={popupRef} className="absolute bg-white rounded-xl shadow-xl border border-slate-200 p-2 flex flex-col gap-1.5 z-[1000]" style={{ left: popup.x, top: popup.y }}>
      <div className="flex gap-1 flex-wrap">
        {!isLocked && (
          <>
            <button onClick={() => onMark(popup.employeeId, popup.day, 'present', popupNote)} className="py-2 px-3.5 bg-green-100 text-green-800 rounded-lg font-semibold text-sm transition hover:bg-green-200">✓ Present</button>
            <button onClick={() => onMark(popup.employeeId, popup.day, 'absent', popupNote)} className="py-2 px-3.5 bg-red-100 text-red-800 rounded-lg font-semibold text-sm transition hover:bg-red-200">✗ Absent</button>
            <button onClick={() => onMark(popup.employeeId, popup.day, 'late', popupNote)} className="py-2 px-3.5 bg-yellow-100 text-yellow-800 rounded-lg font-semibold text-sm transition hover:bg-yellow-200">⏰ Late</button>
            <button onClick={() => onMark(popup.employeeId, popup.day, 'early', popupNote)} className="py-2 px-3.5 bg-purple-100 text-purple-800 rounded-lg font-semibold text-sm transition hover:bg-purple-200">🚪 Early</button>
          </>
        )}
        
        {/* Admin Clear button – always visible for admin */}
        {isAdmin && (
          <button onClick={() => onClear(popup.employeeId, popup.day)} className="py-2 px-3.5 bg-slate-100 text-slate-600 rounded-lg font-semibold text-sm transition hover:bg-slate-200 border border-slate-300">
            🗑️ Clear
          </button>
        )}
      </div>
      
      {/* Note input – only for unlocked cells */}
      {!isLocked && (
        <div className="border-t border-slate-200 pt-1.5">
          <input
            type="text"
            placeholder="Add a note (e.g., Doctor's appointment)"
            value={popupNote}
            onChange={(e) => setPopupNote(e.target.value)}
            className="w-full py-1.5 px-2.5 border border-slate-300 rounded-lg text-xs bg-slate-50 text-slate-800 outline-none transition focus:border-blue-500"
          />
        </div>
      )}
      
      {/* Locked indicator */}
      {isLocked && (
        <p className="text-xs text-slate-500 text-center">This cell is locked. Admin can clear it.</p>
      )}
    </div>, document.body
  );
}

export default AttendancePopup;