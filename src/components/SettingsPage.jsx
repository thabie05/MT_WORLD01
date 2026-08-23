import React from 'react';
import {
  Sun,
  Moon,
  User,
  Shield,
  Database,
  HardDrive,
  Upload,
  ChevronRight,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useSyncStatus } from '../contexts/SyncStatusContext';

function SettingsPage({ currentUser, onPasswordChange, onBackup, onRestore }) {
  const { theme, toggleTheme } = useTheme();
  const { syncStatus } = useSyncStatus();

  const isAdmin = currentUser.role === 'admin';

  return (
    <div className="w-full p-4 md:p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-main">System Settings</h1>
        <p className="text-muted text-sm mt-1">Manage your application preferences and data</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Appearance */}
        <div className="bg-card border border-main rounded-xl p-6 shadow-theme">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-accent/10 rounded-lg">
              {theme === 'dark' ? <Moon size={20} className="text-accent" /> : <Sun size={20} className="text-accent" />}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-main">Appearance</h2>
              <p className="text-xs text-muted">Choose between light and dark mode</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-main">
              {theme === 'dark' ? '🌙 Dark Mode' : '☀️ Light Mode'}
            </span>
            <button
              onClick={toggleTheme}
              className="px-4 py-2 bg-input hover:bg-accent-light text-main rounded-lg text-sm font-medium transition-colors border border-main"
            >
              Switch to {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
          </div>
        </div>

        {/* Account */}
        <div className="bg-card border border-main rounded-xl p-6 shadow-theme">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-accent/10 rounded-lg">
              <User size={20} className="text-accent" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-main">Account</h2>
              <p className="text-xs text-muted">Your profile information</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-main/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-white font-semibold text-sm">
                  {currentUser.fullName?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div>
                  <p className="text-sm font-medium text-main">{currentUser.fullName}</p>
                  <p className="text-xs text-muted">{currentUser.email}</p>
                </div>
              </div>
              <span className="text-xs font-medium text-accent capitalize">{currentUser.role}</span>
            </div>
            <button
              onClick={onPasswordChange}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-input hover:bg-accent-light text-main rounded-lg text-sm font-medium transition-colors border border-main"
            >
              <div className="flex items-center gap-3">
                <Shield size={16} className="text-accent" />
                <span>Change Password</span>
              </div>
              <ChevronRight size={16} className="text-muted" />
            </button>
          </div>
        </div>

        {/* Data Management – Admin only */}
        {isAdmin && (
          <div className="bg-card border border-main rounded-xl p-6 shadow-theme lg:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-accent/10 rounded-lg">
                <Database size={20} className="text-accent" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-main">Data Management</h2>
                <p className="text-xs text-muted">Backup and restore your attendance data</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={onBackup}
                className="flex items-center justify-center gap-3 px-4 py-3 bg-input hover:bg-accent-light text-main rounded-lg text-sm font-medium transition-colors border border-main"
              >
                <HardDrive size={16} className="text-accent" />
                <span>Backup Data</span>
              </button>
              <label className="flex items-center justify-center gap-3 px-4 py-3 bg-input hover:bg-accent-light text-main rounded-lg text-sm font-medium transition-colors border border-main cursor-pointer">
                <Upload size={16} className="text-accent" />
                <span>Restore Data</span>
                <input type="file" accept=".json" onChange={onRestore} className="hidden" />
              </label>
            </div>
          </div>
        )}

        {/* Connection Status */}
        <div className="bg-card border border-main rounded-xl p-6 shadow-theme lg:col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-accent/10 rounded-lg">
              {syncStatus.fromCache ? <WifiOff size={20} className="text-red-400" /> : <Wifi size={20} className="text-emerald-400" />}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-main">Connection Status</h2>
              <p className="text-xs text-muted">Real-time sync status</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-full ${
                syncStatus.fromCache && syncStatus.hasPendingWrites
                  ? 'bg-red-500/20 text-red-400'
                  : syncStatus.fromCache
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : syncStatus.hasPendingWrites
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'bg-emerald-500/20 text-emerald-400'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${
                syncStatus.fromCache && syncStatus.hasPendingWrites
                  ? 'bg-red-400'
                  : syncStatus.fromCache
                  ? 'bg-yellow-400'
                  : syncStatus.hasPendingWrites
                  ? 'bg-blue-400'
                  : 'bg-emerald-400'
              }`} />
              {syncStatus.fromCache && syncStatus.hasPendingWrites
                ? '🔴 Offline — changes saved locally, will sync automatically'
                : syncStatus.fromCache
                ? '📴 Offline — showing last-known data'
                : syncStatus.hasPendingWrites
                ? '🔄 Syncing…'
                : '✅ Synced'}
            </span>
          </div>
        </div>

        {/* Version */}
        <div className="text-center text-xs text-muted pt-4 lg:col-span-2">
          <p>MT World Attendance Register v2.0</p>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;