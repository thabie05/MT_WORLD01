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

  const showStatusButtons = isAdmin || !isLocked;

  return createPortal(
    <div
      ref={popupRef}
      className="absolute bg-card rounded-xl shadow-2xl border border-main p-3 flex flex-col gap-2 z-[1000] min-w-[200px]"
      style={{ left: popup.x, top: popup.y }}
    >
      <div className="flex gap-1.5 flex-wrap">
        {showStatusButtons && (
          <>
            <button
              onClick={() => onMark(popup.employeeId, popup.day, 'present', popupNote)}
              className="py-1.5 px-3 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg font-semibold text-sm transition hover:bg-green-200 dark:hover:bg-green-800/40 hover:text-green-800 dark:hover:text-green-300 border border-green-200 dark:border-green-800/30"
            >
              ✓ Present
            </button>
            <button
              onClick={() => onMark(popup.employeeId, popup.day, 'absent', popupNote)}
              className="py-1.5 px-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg font-semibold text-sm transition hover:bg-red-200 dark:hover:bg-red-800/40 hover:text-red-800 dark:hover:text-red-300 border border-red-200 dark:border-red-800/30"
            >
              ✗ Absent
            </button>
            <button
              onClick={() => onMark(popup.employeeId, popup.day, 'late', popupNote)}
              className="py-1.5 px-3 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-lg font-semibold text-sm transition hover:bg-yellow-200 dark:hover:bg-yellow-800/40 hover:text-yellow-800 dark:hover:text-yellow-300 border border-yellow-200 dark:border-yellow-800/30"
            >
              ⏰ Late
            </button>
            <button
              onClick={() => onMark(popup.employeeId, popup.day, 'early', popupNote)}
              className="py-1.5 px-3 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-lg font-semibold text-sm transition hover:bg-purple-200 dark:hover:bg-purple-800/40 hover:text-purple-800 dark:hover:text-purple-300 border border-purple-200 dark:border-purple-800/30"
            >
              🚪 Early
            </button>
            <button
              onClick={() => onMark(popup.employeeId, popup.day, 'off', popupNote)}
              className="py-1.5 px-3 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400 rounded-lg font-semibold text-sm transition hover:bg-slate-300 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-300 border border-slate-300 dark:border-slate-700"
            >
              📋 Off Duty
            </button>
          </>
        )}

        {isAdmin && (
          <button
            onClick={() => {
              if (onConfirmClear) onConfirmClear(popup.employeeId, popup.day);
            }}
            className="py-1.5 px-3 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 rounded-lg font-semibold text-sm transition hover:bg-red-200 dark:hover:bg-red-800/60 hover:text-red-800 dark:hover:text-red-300 border border-red-200 dark:border-red-800/40"
          >
            🗑️ Clear
          </button>
        )}
      </div>

      {showStatusButtons && (
        <div className="border-t border-main pt-2 mt-1">
          <input
            type="text"
            placeholder="Add a note (e.g., Doctor's appointment)"
            value={popupNote}
            onChange={(e) => setPopupNote(e.target.value)}
            className="w-full py-1.5 px-2.5 border border-main rounded-lg text-xs bg-input text-main placeholder-muted outline-none transition focus:border-accent"
          />
        </div>
      )}

      {isLocked && !isAdmin && (
        <p className="text-xs text-muted text-center">
          This cell is locked. Admin can change or clear it.
        </p>
      )}
    </div>,
    document.body
  );
}

export default AttendancePopup;