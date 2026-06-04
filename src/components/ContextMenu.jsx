import React from 'react';
import { createPortal } from 'react-dom';

function ContextMenu({ contextMenu, contextMenuRef, onViewReport, onRename, onDelete }) {
  if (!contextMenu) return null;

  return createPortal(
    <div ref={contextMenuRef} className="absolute bg-white rounded-xl shadow-2xl border border-slate-200 p-1.5 flex flex-col gap-0.5 z-[1500] min-w-[180px]" style={{ left: contextMenu.x, top: contextMenu.y }}>
      <button onClick={onViewReport} className="bg-transparent text-left py-2.5 px-3.5 rounded-lg text-sm font-medium cursor-pointer transition hover:bg-slate-100 text-slate-800 flex items-center gap-2">
        📊 View Report
      </button>
      <button onClick={onRename} className="bg-transparent text-left py-2.5 px-3.5 rounded-lg text-sm font-medium cursor-pointer transition hover:bg-slate-100 text-slate-800 flex items-center gap-2">
        ✏️ Rename
      </button>
      <button 
        onClick={onDelete}
        className="bg-transparent text-left py-2.5 px-3.5 rounded-lg text-sm font-medium cursor-pointer transition hover:bg-red-50 text-red-600 flex items-center gap-2"
      >
        🗑️ Delete
      </button>
    </div>, document.body
  );
}

export default ContextMenu;