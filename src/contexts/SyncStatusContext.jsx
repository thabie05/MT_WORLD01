import React, { createContext, useContext, useState } from 'react';

const SyncStatusContext = createContext();

export function SyncStatusProvider({ children }) {
  const [syncStatus, setSyncStatus] = useState({ fromCache: false, hasPendingWrites: false });
  return (
    <SyncStatusContext.Provider value={{ syncStatus, setSyncStatus }}>
      {children}
    </SyncStatusContext.Provider>
  );
}

export function useSyncStatus() {
  const context = useContext(SyncStatusContext);
  if (!context) throw new Error('useSyncStatus must be used within SyncStatusProvider');
  return context;
}