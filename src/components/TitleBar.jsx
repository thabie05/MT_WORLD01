import React, { useState, useEffect } from 'react';
import OfflineSyncBadge from './OfflineSyncBadge';
import { useSyncStatus } from '../contexts/SyncStatusContext';

// Detect Wails environment
const isWails = typeof window !== 'undefined' && window.go && window.go.main && window.go.main.App;

function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const { syncStatus } = useSyncStatus();

  useEffect(() => {
    if (!isWails) return;
    // Get initial maximized state
    window.go.main.App.WindowIsMaximised().then(setIsMaximized).catch(() => {});
  }, []);

  if (!isWails) return null;

  const handleMinimize = () => window.go.main.App.WindowMinimise();
  const handleMaximize = () => {
    // Toggle and then re-query state
    window.go.main.App.WindowToggleMaximise().then(() => {
      window.go.main.App.WindowIsMaximised().then(setIsMaximized).catch(() => {});
    });
  };
  const handleClose = () => window.go.main.App.WindowClose();

  return (
    <div
      className="flex items-center justify-between h-9 bg-card select-none relative"
      style={{ '--wails-draggable': 'drag' }}
    >
      {/* Left: Logo & Title */}
      <div className="flex items-center gap-2 px-3 pointer-events-none z-10" style={{ '--wails-draggable': 'drag' }}>
        <img src="./icon.png" alt="" className="w-4 h-4" />
        <span className="text-xs font-[Oswald,sans-serif] uppercase tracking-wide text-main">
          MT World Attendance
        </span>
      </div>

      {/* Right side: Sync badge + Window controls */}
      <div className="flex items-center gap-3 px-2 z-10" style={{ '--wails-draggable': 'no-drag' }}>
        <OfflineSyncBadge
          fromCache={syncStatus.fromCache}
          hasPendingWrites={syncStatus.hasPendingWrites}
        />

        {/* Minimize */}
        <button
          onClick={handleMinimize}
          className="w-11 h-9 flex items-center justify-center text-muted hover:bg-accent-light hover:text-main transition-colors"
          title="Minimize"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <rect x="0" y="4.5" width="10" height="1" fill="currentColor" />
          </svg>
        </button>

        {/* Maximize / Restore */}
        <button
          onClick={handleMaximize}
          className="w-11 h-9 flex items-center justify-center text-muted hover:bg-accent-light hover:text-main transition-colors"
          title={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10">
              <rect x="2" y="0" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1" />
              <rect x="0" y="2" width="8" height="8" fill="var(--bg-card)" stroke="currentColor" strokeWidth="1" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10">
              <rect x="0" y="0" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1" />
            </svg>
          )}
        </button>

        {/* Close */}
        <button
          onClick={handleClose}
          className="w-11 h-9 flex items-center justify-center text-muted hover:bg-[#B2604A] hover:text-white transition-colors"
          title="Close"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" strokeWidth="1" />
            <line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default TitleBar;