const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const express = require('express');
const cors = require('cors');

// ============================================================================
// SINGLE INSTANCE LOCK
// ============================================================================
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

let javaProcess = null;
let mainWindow = null;

// ============================================================================
// PATH HELPERS
// ============================================================================
function getBackendPath(relativePath) {
  const isDev = !app.isPackaged;
  if (isDev) {
    // Development: files are at the project root
    if (relativePath.includes('jre-win64')) {
      return path.join(__dirname, '..', 'jre-win64');
    }
    if (relativePath.includes('fingerprint-matcher.jar')) {
      return path.join(__dirname, '..', 'fingerprint-matcher', 'target', 'fingerprint-matcher.jar');
    }
    return path.join(__dirname, '..', relativePath);
  }
  // Production: inside the packaged resources folder
  return path.join(process.resourcesPath, relativePath);
}

function matcherDataDir() {
  const dir = path.join(app.getPath('userData'), 'matcher-data');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ============================================================================
// BACKEND SERVICES
// ============================================================================
function resolveJavaExecutable() {
  const bundledJava = getBackendPath(path.join('jre-win64', 'bin', 'java.exe'));
  if (fs.existsSync(bundledJava)) {
    console.log('[Electron] ✅ Using bundled JRE:', bundledJava);
    return bundledJava;
  }
  console.warn('[Electron] ⚠️ Bundled JRE not found. Falling back to system java.');
  return 'java';
}

function startJavaMatcher() {
  const javaExe = resolveJavaExecutable();
  // ✅ CORRECT PATH: The JAR is placed in backend/ by extraResources
  const jarPath = getBackendPath('backend/fingerprint-matcher.jar');

  if (!fs.existsSync(jarPath)) {
    console.error('[Electron] ❌ fingerprint-matcher.jar not found at:', jarPath);
    console.error('Check your extraResources in package.json. It should map to backend/fingerprint-matcher.jar');
    return;
  }

  console.log('[Electron] Starting Java Matcher:', javaExe, '-jar', jarPath);
  javaProcess = spawn(javaExe, ['-jar', jarPath], {
    cwd: matcherDataDir(),
    shell: true,
  });
  javaProcess.stdout.on('data', (data) => console.log(`[Java] ${data}`));
  javaProcess.stderr.on('data', (data) => console.error(`[Java Error] ${data}`));
  javaProcess.on('close', (code) => { console.log(`[Java] exited with code ${code}`); javaProcess = null; });
}

function startBridgeServer() {
  const bridgeApp = express();
  bridgeApp.use(cors());
  bridgeApp.use(express.json({ limit: '10mb' }));

  const MATCHER_URL = 'http://127.0.0.1:8787';

  async function forward(req, res, matcherPath) {
    try {
      const response = await fetch(`${MATCHER_URL}${matcherPath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
      });
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (err) {
      console.error(`[Bridge] Failed to reach matcher for ${matcherPath}:`, err.message);
      res.status(502).json({ error: 'Fingerprint matching service is not reachable yet. Please ensure the USB scanner is connected and the DigitalPersona Lite Client is running.' });
    }
  }

  bridgeApp.post('/enroll', (req, res) => forward(req, res, '/enroll'));
  bridgeApp.post('/identify', (req, res) => forward(req, res, '/identify'));
  bridgeApp.post('/load-templates', (req, res) => forward(req, res, '/load-templates'));

  bridgeApp.get('/health', async (req, res) => {
    try {
      const response = await fetch(`${MATCHER_URL}/health`);
      const data = await response.json();
      res.json({ bridge: 'ok', matcher: data });
    } catch (err) {
      res.status(502).json({ bridge: 'ok', matcher: 'unreachable' });
    }
  });

  bridgeApp.listen(4000, '127.0.0.1', () => {
    console.log('[Electron] Bridge server running on http://127.0.0.1:4000 (in-process — no separate Node needed)');
  });
}

// ============================================================================
// WINDOW CREATION
// ============================================================================
function createWindow() {
  mainWindow = new BrowserWindow({
    title: 'MT World Attendance',
    icon: path.join(__dirname, '../public/icon.png'),
    width: 1280,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    backgroundColor: '#1B1E24',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      nativeWindowOpen: false,
    },
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.maximize();

  mainWindow.on('maximize', () => mainWindow.webContents.send('window:maximized-changed', true));
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window:maximized-changed', false));
  mainWindow.on('closed', () => { mainWindow = null; });
}

// ============================================================================
// APP LIFECYCLE
// ============================================================================
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);

  createWindow();
  startJavaMatcher();
  startBridgeServer();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ============================================================================
// WINDOW CONTROLS (for CustomTitleBar.jsx)
// ============================================================================
ipcMain.on('window-minimize', () => { const win = BrowserWindow.getFocusedWindow(); if (win) win.minimize(); });
ipcMain.on('window-maximize', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) { if (win.isMaximized()) win.unmaximize(); else win.maximize(); }
});
ipcMain.on('window-close', () => { const win = BrowserWindow.getFocusedWindow(); if (win) win.close(); });
ipcMain.handle('window-is-maximized', () => {
  const win = BrowserWindow.getFocusedWindow();
  return win ? win.isMaximized() : false;
});

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================
let quitInProgress = false;
app.on('before-quit', async (event) => {
  if (quitInProgress) return;
  quitInProgress = true;
  event.preventDefault();

  console.log('[Electron] Starting graceful shutdown...');
  await new Promise((resolve) => {
    if (!javaProcess) return resolve();
    javaProcess.once('close', resolve);
    javaProcess.kill('SIGINT');
    setTimeout(() => {
      if (javaProcess && !javaProcess.killed) {
        console.log('[Java] Force-killing with SIGKILL');
        javaProcess.kill('SIGKILL');
      }
      resolve();
    }, 2000);
  });

  console.log('[Electron] Backend services terminated. Quitting app...');
  app.quit();
});