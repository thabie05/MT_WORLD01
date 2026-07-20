import React from 'react';
import { createPortal } from 'react-dom';

function ContextMenu({ contextMenu, contextMenuRef, onViewReport, onRename, onEnrollFingerprint, onDelete }) {
  if (!contextMenu) return null;

  return createPortal(
    <div ref={contextMenuRef} className="absolute bg-[#20242C] rounded-xl shadow-2xl border border-[#3A3F4B] p-1.5 flex flex-col gap-0.5 z-[1500] min-w-[180px]" style={{ left: contextMenu.x, top: contextMenu.y }}>
      <button onClick={onViewReport} className="bg-transparent text-left py-2.5 px-3.5 rounded-lg text-sm font-medium transition hover:bg-[#262A33] text-[#EDEAE2] flex items-center gap-2">
        📊 View Report
      </button>
      <button onClick={onRename} className="bg-transparent text-left py-2.5 px-3.5 rounded-lg text-sm font-medium transition hover:bg-[#262A33] text-[#EDEAE2] flex items-center gap-2">
        ✏️ Rename
      </button>
      <button onClick={onEnrollFingerprint} className="bg-transparent text-left py-2.5 px-3.5 rounded-lg text-sm font-medium transition hover:bg-[#262A33] text-[#EDEAE2] flex items-center gap-2">
        🖐️ Enroll Fingerprint
      </button>
      <button onClick={onDelete} className="bg-transparent text-left py-2.5 px-3.5 rounded-lg text-sm font-medium transition hover:bg-[#3A2020] text-[#B2604A] flex items-center gap-2">
        🗑️ Delete
      </button>
    </div>, document.body
  );
}

export default ContextMenu;