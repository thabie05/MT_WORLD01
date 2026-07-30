import React, { useState, useEffect } from 'react';

// Only renders when running inside the Electron desktop app (preload.js
// exposes window.electronAPI there, with isElectron: true). In a normal
// browser tab, window.electronAPI doesn't exist, there's no OS window
// frame to replace, and this component simply renders nothing.
const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron === true;

function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!isElectron) return;
    window.electronAPI.isMaximized().then(setIsMaximized);
    const unsubscribe = window.electronAPI.onMaximizedChanged(setIsMaximized);
    return unsubscribe;
  }, []);

  if (!isElectron) return null;

  return (
    <div
      className="flex items-center justify-between h-9 bg-card border-b border-main select-none"
      style={{ WebkitAppRegion: 'drag' }}
    >
      <div className="flex items-center gap-2 px-3 pointer-events-none">
        <img src="./icon.png" alt="" className="w-4 h-4" />
        <span className="text-xs font-[Oswald,sans-serif] uppercase tracking-wide text-main">
          MT World Attendance
        </span>
      </div>

      <div className="flex h-full" style={{ WebkitAppRegion: 'no-drag' }}>
        <button
          onClick={() => window.electronAPI.minimize()}
          className="w-11 h-9 flex items-center justify-center text-muted hover:bg-accent-light hover:text-main transition-colors"
          title="Minimize"
        >
          <svg width="10" height="10" viewBox="0 0 10 10"><rect x="0" y="4.5" width="10" height="1" fill="currentColor" /></svg>
        </button>

        <button
          onClick={() => window.electronAPI.maximize()}
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

        <button
          onClick={() => window.electronAPI.close()}
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