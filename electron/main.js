const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let javaProcess = null;
let bridgeProcess = null;

/**
 * Returns the absolute path to a resource inside the app's resources folder
 * when packaged, or the relative path from the project root in development.
 */
function getBackendPath(relativePath) {
  const isDev = !app.isPackaged;
  if (isDev) {
    return path.join(__dirname, '..', relativePath);
  }
  return path.join(process.resourcesPath, relativePath);
}

function startBackendServices() {
  // ---------------------------------------------------------------
  // 1. Start Java Matcher
  // ---------------------------------------------------------------
  const javaJar = getBackendPath('backend/fingerprint-matcher.jar');
  if (fs.existsSync(javaJar)) {
    console.log('[Electron] Starting Java Matcher from:', javaJar);
    javaProcess = spawn('java', ['-jar', path.basename(javaJar)], {
      cwd: path.dirname(javaJar),
      shell: true,
    });
    javaProcess.stdout.on('data', (data) => console.log(`[Java] ${data}`));
    javaProcess.stderr.on('data', (data) => console.error(`[Java Error] ${data}`));
    javaProcess.on('close', (code) => console.log(`[Java] exited with code ${code}`));
  } else {
    console.error('[Electron] Java JAR not found at:', javaJar);
  }

  // ---------------------------------------------------------------
  // 2. Start Node Bridge using start-bridge.bat
  // ---------------------------------------------------------------
  const bridgeDir = getBackendPath('backend/bridge');
  const batchFile = path.join(bridgeDir, 'start-bridge.bat');
  if (fs.existsSync(batchFile)) {
    console.log('[Electron] Starting Node Bridge via batch file from:', batchFile);
    bridgeProcess = spawn('cmd', ['/c', batchFile], {
      cwd: bridgeDir,
      shell: true,
    });
    bridgeProcess.stdout.on('data', (data) => console.log(`[Bridge] ${data}`));
    bridgeProcess.stderr.on('data', (data) => console.error(`[Bridge Error] ${data}`));
    bridgeProcess.on('close', (code) => console.log(`[Bridge] exited with code ${code}`));
  } else {
    console.error('[Electron] Bridge batch file not found at:', batchFile);
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Load the hosted web app (or local dev server)
  const isDev = !app.isPackaged;
  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadURL('https://mtworldrollcall.web.app/');
  }

  win.maximize();
  // win.webContents.openDevTools(); // uncomment if you need debugging
}

app.whenReady().then(() => {
  createWindow();
  startBackendServices();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (javaProcess) javaProcess.kill('SIGINT');
  if (bridgeProcess) bridgeProcess.kill('SIGINT');
});