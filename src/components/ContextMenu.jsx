import React from 'react';
import { createPortal } from 'react-dom';

function ContextMenu({ contextMenu, contextMenuRef, onViewReport, onRename }) {
  if (!contextMenu) return null;

  return createPortal(
    <div ref={contextMenuRef} className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
      <button onClick={onViewReport} className="context-menu-item">📊 View Report</button>
      <button onClick={onRename} className="context-menu-item">✏️ Rename</button>
    </div>, document.body
  );
}

export default ContextMenu;