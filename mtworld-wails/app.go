package main

import (
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// ============================================================================
// PORTED FROM THE ELECTRON main.js — same responsibilities, different
// language. Key differences from the Electron version worth knowing:
//
//   - No ipcMain/ipcRenderer. Any public method on *App below is
//     automatically exposed to the frontend as window.go.main.App.MethodName()
//     (see main.go's Bind: []interface{}{app}).
//   - No built-in requestSingleInstanceLock() equivalent used here — see
//     acquireSingleInstanceLock below for a manual TCP-port-based lock
//     instead. This does NOT refocus an existing window the way Electron's
//     'second-instance' event did; it just silently exits the second
//     launch. Let me know if you want proper focus-forwarding added (it's
//     doable, just more code — a tiny local IPC ping between instances).
//   - The bridge server is net/http instead of Express — same three
//     forwarded routes, same CORS behavior, same port (4000).
// ============================================================================

type App struct {
	ctx          context.Context
	javaCmd      *exec.Cmd
	lockListener net.Listener
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.acquireSingleInstanceLock()
	a.startJavaMatcher()
	a.startBridgeServer()
}

func (a *App) shutdown(ctx context.Context) {
	a.stopJavaMatcher()
	if a.lockListener != nil {
		a.lockListener.Close()
	}
}

// ============================================================================
// WINDOW CONTROLS — bound automatically to window.go.main.App.* on the JS
// side. Called directly from CustomTitleBar.jsx.
// ============================================================================

func (a *App) WindowMinimise() {
	runtime.WindowMinimise(a.ctx)
}

func (a *App) WindowToggleMaximise() {
	if runtime.WindowIsMaximised(a.ctx) {
		runtime.WindowUnmaximise(a.ctx)
	} else {
		runtime.WindowMaximise(a.ctx)
	}
}

func (a *App) WindowClose() {
	runtime.Quit(a.ctx)
}

func (a *App) WindowIsMaximised() bool {
	return runtime.WindowIsMaximised(a.ctx)
}

// ============================================================================
// SINGLE INSTANCE LOCK
//
// Binding a TCP listener to a fixed localhost port doubles as a lock:
// only one process can hold that port at a time. If binding fails, another
// copy of this app is already running, so we exit immediately instead of
// fighting over :4000/:8787 with it.
// ============================================================================

const singleInstanceLockPort = "127.0.0.1:39991"

func (a *App) acquireSingleInstanceLock() {
	ln, err := net.Listen("tcp", singleInstanceLockPort)
	if err != nil {
		fmt.Println("[App] Another instance is already running — exiting.")
		os.Exit(0)
	}
	a.lockListener = ln
	// Never accepted on — its only job is to occupy the port for the
	// lifetime of this process.
}

// ============================================================================
// JAVA MATCHER
// ============================================================================

// exeDir returns the folder the running .exe lives in — this is where
// bundled resources (jre-win64/, backend/) are expected to sit alongside
// it, placed there by the NSIS installer (see SETUP.md — Wails doesn't
// have an "extraResources" concept like electron-builder; this is the
// equivalent).
func exeDir() string {
	exePath, err := os.Executable()
	if err != nil {
		return "."
	}
	return filepath.Dir(exePath)
}

// matcherDataDir is where the matcher's enrolled-template cache lives —
// deliberately NOT inside the install folder (Program Files is often
// read-only for a non-admin user at runtime), same reasoning as the
// Electron version.
func matcherDataDir() string {
	appData := os.Getenv("APPDATA")
	dir := filepath.Join(appData, "MT World Attendance", "matcher-data")
	os.MkdirAll(dir, 0755)
	return dir
}

// resolveJavaExecutable prefers a bundled JRE — download from
// https://adoptium.net/temurin/releases/ (17 LTS, JRE, Windows, x64, zip),
// extract into a "jre-win64" folder that ships alongside the exe (see
// SETUP.md for how to get the installer to include it). Falls back to
// system "java" on PATH, which only works on a PC that already has Java.
func resolveJavaExecutable() string {
	bundled := filepath.Join(exeDir(), "jre-win64", "bin", "java.exe")
	if _, err := os.Stat(bundled); err == nil {
		fmt.Println("[App] Using bundled JRE:", bundled)
		return bundled
	}
	fmt.Println("[App] No bundled JRE found at", bundled, "— falling back to system \"java\" on PATH.")
	return "java"
}

func (a *App) startJavaMatcher() {
	javaExe := resolveJavaExecutable()
	jarPath := filepath.Join(exeDir(), "backend", "fingerprint-matcher.jar")

	if _, err := os.Stat(jarPath); err != nil {
		fmt.Println("[App] fingerprint-matcher.jar not found at:", jarPath)
		return
	}

	// Create a log file for the matcher (in the same data directory)
	dataDir := matcherDataDir()
	logFile, err := os.OpenFile(filepath.Join(dataDir, "matcher.log"), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		fmt.Println("[App] Failed to create matcher log file:", err)
		return
	}
	// We won't close it here; the process will keep it open.

	cmd := exec.Command(javaExe, "-jar", jarPath)
	cmd.Dir = dataDir

	// Redirect stdout/stderr to the log file
	cmd.Stdout = logFile
	cmd.Stderr = logFile

	// Hide the console window on Windows.
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}

	if err := cmd.Start(); err != nil {
		fmt.Println("[App] Failed to start Java matcher:", err)
		return
	}
	a.javaCmd = cmd
	fmt.Println("[App] Java matcher started in background, PID:", cmd.Process.Pid)
}

func (a *App) stopJavaMatcher() {
	if a.javaCmd != nil && a.javaCmd.Process != nil {
		fmt.Println("[App] Stopping Java matcher...")
		_ = a.javaCmd.Process.Kill()
	}
}

// ============================================================================
// BRIDGE SERVER — replaces the Express-based bridge from the Electron
// version. Same three forwarded routes, same port (4000), so the React
// app's fetch calls need zero changes.
// ============================================================================

const matcherURL = "http://127.0.0.1:8787"

func (a *App) startBridgeServer() {
	mux := http.NewServeMux()

	mux.HandleFunc("/enroll", corsMiddleware(forwardHandler("/enroll")))
	mux.HandleFunc("/identify", corsMiddleware(forwardHandler("/identify")))
	mux.HandleFunc("/load-templates", corsMiddleware(forwardHandler("/load-templates")))
	mux.HandleFunc("/health", corsMiddleware(healthHandler))

	go func() {
		if err := http.ListenAndServe("127.0.0.1:4000", mux); err != nil {
			fmt.Println("[App] Bridge server failed:", err)
		}
	}()
	fmt.Println("[App] Bridge server running on http://127.0.0.1:4000")
}

func corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		next(w, r)
	}
}

func forwardHandler(matcherPath string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		client := &http.Client{Timeout: 15 * time.Second}

		req, err := http.NewRequest(http.MethodPost, matcherURL+matcherPath, r.Body)
		if err != nil {
			http.Error(w, `{"error":"internal request error"}`, http.StatusInternalServerError)
			return
		}
		req.Header.Set("Content-Type", "application/json")

		resp, err := client.Do(req)
		if err != nil {
			fmt.Printf("[Bridge] Failed to reach matcher for %s: %v\n", matcherPath, err)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadGateway)
			w.Write([]byte(`{"error":"Fingerprint matching service is not reachable yet. It may still be starting up — try again in a moment."}`))
			return
		}
		defer resp.Body.Close()

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(resp.StatusCode)
		io.Copy(w, resp.Body)
	}
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	resp, err := http.Get(matcherURL + "/health")
	if err != nil {
		w.WriteHeader(http.StatusBadGateway)
		w.Write([]byte(`{"bridge":"ok","matcher":"unreachable"}`))
		return
	}
	defer resp.Body.Close()
	io.Copy(w, resp.Body)
}
