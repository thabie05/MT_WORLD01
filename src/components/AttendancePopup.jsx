import React from 'react';
import { createPortal } from 'react-dom';

function AttendancePopup({
  popup,
  popupNote,
  setPopupNote,
  popupRef,
  onMark,
  isAdmin,
  onConfirmClear,
  isLocked,
}) {
  if (!popup) return null;

  // Admins can always change the status, even on locked cells.
  // Non‑admins lose the status buttons once the cell is locked.
  const showStatusButtons = isAdmin || !isLocked;

  return createPortal(
    <div
      ref={popupRef}
      className="absolute bg-white rounded-xl shadow-xl border border-slate-200 p-2 flex flex-col gap-1.5 z-[1000]"
      style={{ left: popup.x, top: popup.y }}
    >
      <div className="flex gap-1 flex-wrap">
        {showStatusButtons && (
          <>
            <button
              onClick={() => onMark(popup.employeeId, popup.day, 'present', popupNote)}
              className="py-2 px-3.5 bg-green-100 text-green-800 rounded-lg font-semibold text-sm transition hover:bg-green-200"
            >
              ✓ Present
            </button>
            <button
              onClick={() => onMark(popup.employeeId, popup.day, 'absent', popupNote)}
              className="py-2 px-3.5 bg-red-100 text-red-800 rounded-lg font-semibold text-sm transition hover:bg-red-200"
            >
              ✗ Absent
            </button>
            <button
              onClick={() => onMark(popup.employeeId, popup.day, 'late', popupNote)}
              className="py-2 px-3.5 bg-yellow-100 text-yellow-800 rounded-lg font-semibold text-sm transition hover:bg-yellow-200"
            >
              ⏰ Late
            </button>
            <button
              onClick={() => onMark(popup.employeeId, popup.day, 'early', popupNote)}
              className="py-2 px-3.5 bg-purple-100 text-purple-800 rounded-lg font-semibold text-sm transition hover:bg-purple-200"
            >
              🚪 Early
            </button>
            <button
              onClick={() => onMark(popup.employeeId, popup.day, 'off', popupNote)}
              className="py-2 px-3.5 bg-slate-200 text-slate-700 rounded-lg font-semibold text-sm transition hover:bg-slate-300"
            >
              📋 Off Duty
            </button>
          </>
        )}

        {isAdmin && (
          <button
            onClick={() => {
              if (onConfirmClear) {
                onConfirmClear(popup.employeeId, popup.day);
              }
            }}
            className="py-2 px-3.5 bg-red-100 text-red-700 rounded-lg font-semibold text-sm transition hover:bg-red-200 border border-red-300"
          >
            🗑️ Clear
          </button>
        )}
      </div>

      {showStatusButtons && (
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

      {isLocked && !isAdmin && (
        <p className="text-xs text-slate-500 text-center">
          This cell is locked. Admin can change or clear it.
        </p>
      )}
    </div>,
    document.body
  );
}

export default AttendancePopup;