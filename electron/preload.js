const { contextBridge, ipcRenderer } = require('electron');

// Exposes window.electronAPI.minimize()/maximize()/close() to the renderer,
// matching exactly what CustomTitleBar.jsx calls. Wired to the ipcMain.on
// / ipcMain.handle listeners already in main.js:
//   ipcMain.on('window-minimize', ...)
//   ipcMain.on('window-maximize', ...)
//   ipcMain.on('window-close', ...)
//   ipcMain.handle('window-is-maximized', ...)
contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  onMaximizedChanged: (callback) => {
    const handler = (_event, isMaximized) => callback(isMaximized);
    ipcRenderer.on('window:maximized-changed', handler);
    return () => ipcRenderer.removeListener('window:maximized-changed', handler);
  },
  // Lets React tell whether it's running inside Electron at all (vs. a
  // normal browser tab, e.g. on the kiosk or the public web URL) — used
  // below to decide whether to render CustomTitleBar at all.
  isElectron: true,
});