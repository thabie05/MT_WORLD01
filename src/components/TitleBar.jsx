import React, { useState, useEffect } from 'react';
import OfflineSyncBadge from './OfflineSyncBadge';
import { useSyncStatus } from '../contexts/SyncStatusContext';

// ============================================================================
// Styled to match the brand treatment already used in AttendanceRegister's
// header (small accent-blue "MT World" label + bold accent-dark title),
// instead of looking like a generic flat OS title bar. Uses the same
// theme.css tokens (bg-card, text-accent, accent-light, --accent, etc.) as
// the rest of the app, so it automatically follows light/dark mode exactly
// like everything else — no theme-specific code needed here beyond using
// those shared tokens.
// ============================================================================

function detectWails() {
  return typeof window !== 'undefined' && !!window.go && !!window.go.main && !!window.go.main.App;
}

function TitleBar() {
  const [isWails, setIsWails] = useState(detectWails());
  const [isMaximized, setIsMaximized] = useState(false);
  const { syncStatus } = useSyncStatus();

  useEffect(() => {
    if (isWails) return;
    let attempts = 0;
    const interval = setInterval(() => {
      attempts += 1;
      if (detectWails()) {
        setIsWails(true);
        clearInterval(interval);
      } else if (attempts > 20) {
        clearInterval(interval);
      }
    }, 50);
    return () => clearInterval(interval);
  }, [isWails]);

  useEffect(() => {
    if (!isWails) return;
    window.go.main.App.WindowIsMaximised().then(setIsMaximized).catch(() => {});
  }, [isWails]);

  if (!isWails) return null;

  const handleMinimize = () => window.go.main.App.WindowMinimise();
  const handleMaximize = () => {
    window.go.main.App.WindowToggleMaximise().then(() => {
      window.go.main.App.WindowIsMaximised().then(setIsMaximized).catch(() => {});
    });
  };
  const handleClose = () => window.go.main.App.WindowClose();

  return (
    <div
      className="flex items-center justify-between h-9 select-none relative z-50 bg-card transition-colors duration-300"
      style={{ '--wails-draggable': 'drag' }}
    >
      {/* Left: brand mark, styled the same way the main header does it */}
      <div className="flex items-center gap-2 px-3 pointer-events-none" style={{ '--wails-draggable': 'drag' }}>
        <img src="./logo.png" alt="" className="h-5 w-auto object-contain" />
        <span className="text-[10px] uppercase tracking-[0.25em] text-accent font-medium">MT World</span>
        <span className="text-xs font-[Oswald,sans-serif] uppercase tracking-wide text-accent-dark font-semibold">
          Attendance
        </span>
      </div>

      {/* Right: sync badge + window controls (not draggable) */}
      <div className="flex items-center gap-3 px-2 z-10" style={{ '--wails-draggable': 'no-drag' }}>
        <OfflineSyncBadge fromCache={syncStatus.fromCache} hasPendingWrites={syncStatus.hasPendingWrites} />

        <button
          onClick={handleMinimize}
          className="w-11 h-9 flex items-center justify-center text-muted hover:bg-accent-light hover:text-accent-dark transition-colors"
          title="Minimize"
        >
          <svg width="10" height="10" viewBox="0 0 10 10"><rect x="0" y="4.5" width="10" height="1" fill="currentColor" /></svg>
        </button>

        <button
          onClick={handleMaximize}
          className="w-11 h-9 flex items-center justify-center text-muted hover:bg-accent-light hover:text-accent-dark transition-colors"
          title={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10">
              <rect x="2" y="0" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1" />
              <rect x="0" y="2" width="8" height="8" fill="var(--bg-card)" stroke="currentColor" strokeWidth="1" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10"><rect x="0" y="0" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1" /></svg>
          )}
        </button>

        <button
          onClick={handleClose}
          className="w-11 h-9 flex items-center justify-center text-muted hover:bg-[var(--accent-red)] hover:text-white transition-colors"
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