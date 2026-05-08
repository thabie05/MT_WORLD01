import React from 'react';
import { createPortal } from 'react-dom';

function AttendancePopup({ popup, popupNote, setPopupNote, popupRef, onMark }) {
  if (!popup) return null;

  return createPortal(
    <div ref={popupRef} className="attendance-popup" style={{ left: popup.x, top: popup.y }}>
      <div className="popup-options">
        <button className="popup-btn present-btn" onClick={() => onMark(popup.employeeId, popup.day, 'present', popupNote)}>✓ Present</button>
        <button className="popup-btn absent-btn" onClick={() => onMark(popup.employeeId, popup.day, 'absent', popupNote)}>✗ Absent</button>
        <button className="popup-btn late-btn" onClick={() => onMark(popup.employeeId, popup.day, 'late', popupNote)}>⏰ Late</button>
        <button className="popup-btn early-btn" onClick={() => onMark(popup.employeeId, popup.day, 'early', popupNote)}>🚪 Early</button>
      </div>
      <div className="popup-note">
        <input
          type="text"
          placeholder="Add a note (e.g., Doctor's appointment)"
          value={popupNote}
          onChange={(e) => setPopupNote(e.target.value)}
          className="popup-note-input"
        />
      </div>
    </div>, document.body
  );
}

export default AttendancePopup;