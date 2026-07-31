import React from 'react';

/**
 * Shows the ACTUAL Firestore sync state, not a guess from navigator.onLine
 * (which only tells you if the network interface is up, not whether
 * Firestore's connection to the server is actually working).
 *
 * Needs two booleans read off the onSnapshot metadata — see the wiring
 * note below for the one-line change needed where you call onSnapshot.
 */
function OfflineSyncBadge({ fromCache, hasPendingWrites }) {
  if (fromCache && hasPendingWrites) {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-[var(--status-red-bg)] text-[var(--status-red-text)]">
        🔴 Offline — changes saved locally, will sync automatically
      </span>
    );
  }
  if (fromCache) {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-[var(--status-yellow-bg)] text-[var(--status-yellow-text)]">
        📴 Offline — showing last-known data
      </span>
    );
  }
  if (hasPendingWrites) {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-[var(--status-blue-bg)] text-[var(--status-blue-text)]">
        🔄 Syncing…
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-[var(--status-green-bg)] text-[var(--status-green-text)]">
      ✅ Synced
    </span>
  );
}

export default OfflineSyncBadge;