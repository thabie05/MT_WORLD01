import React, { useState } from 'react';
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
  Users,
  ArrowLeft,
  Palette,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useSyncStatus } from '../contexts/SyncStatusContext';
import UserManagement from './UserManagement';
import { isSuperAdmin } from '../utils/Passwords';

function SettingsPage({ currentUser, onPasswordChange, onBackup, onRestore }) {
  const { theme, toggleTheme } = useTheme();
  const { syncStatus } = useSyncStatus();
  const [active, setActive] = useState(null); // null = show the button grid

  const isAdmin = currentUser.role === 'admin';
  const isSuper = isSuperAdmin(currentUser);

  // ---- connection state (shown at the top) ----
  const offlinePending = syncStatus.fromCache && syncStatus.hasPendingWrites;
  const offline = syncStatus.fromCache;
  const syncing = syncStatus.hasPendingWrites;
  const tone = offlinePending
    ? { box: 'bg-red-500/10 border-red-500/30', pill: 'bg-red-500/20 text-red-400', dot: 'bg-red-400', text: '🔴 Offline — changes saved locally, will sync automatically' }
    : offline
    ? { box: 'bg-yellow-500/10 border-yellow-500/30', pill: 'bg-yellow-500/20 text-yellow-400', dot: 'bg-yellow-400', text: '📴 Offline — showing last-known data' }
    : syncing
    ? { box: 'bg-blue-500/10 border-blue-500/30', pill: 'bg-blue-500/20 text-blue-400', dot: 'bg-blue-400', text: '🔄 Syncing…' }
    : { box: 'bg-emerald-500/10 border-emerald-500/30', pill: 'bg-emerald-500/20 text-emerald-400', dot: 'bg-emerald-400', text: '✅ Synced' };

  // ---- the settings buttons ----
  const tiles = [
    { id: 'appearance', icon: Palette, title: 'Appearance', desc: theme === 'dark' ? 'Dark mode is on' : 'Light mode is on' },
    { id: 'account', icon: User, title: 'Account', desc: 'Profile & password' },
  ];
  if (isSuper) {
    tiles.push({ id: 'users', icon: Users, title: 'User Management', desc: 'Create & manage logins' });
  }
  if (isAdmin) {
    tiles.push({ id: 'data', icon: Database, title: 'Data Management', desc: 'Backup & restore' });
  }

  const current = tiles.find((t) => t.id === active);

  return (
    <div className="w-full p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-main">System Settings</h1>
        <p className="text-muted text-sm mt-1">Manage your application preferences and data</p>
      </div>

      {/* Connection status – always on top */}
      <div className={`flex items-center justify-between flex-wrap gap-3 border rounded-xl px-5 py-4 mb-6 ${tone.box}`}>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-card rounded-lg">
            {offline ? <WifiOff size={20} className="text-red-400" /> : <Wifi size={20} className="text-emerald-400" />}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-main">Connection Status</h2>
            <p className="text-xs text-muted">Real-time sync status</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-full ${tone.pill}`}>
          <span className={`w-2 h-2 rounded-full ${tone.dot}`} />
          {tone.text}
        </span>
      </div>

      {/* Button grid */}
      {!active && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {tiles.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActive(t.id)}
                className="group text-left bg-card border border-main rounded-xl p-5 shadow-theme hover:border-accent hover:bg-accent-light transition-all hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between">
                  <div className="p-2.5 bg-accent/10 rounded-lg">
                    <Icon size={22} className="text-accent" />
                  </div>
                  <ChevronRight size={18} className="text-muted group-hover:text-accent transition-colors" />
                </div>
                <h3 className="text-sm font-semibold text-main mt-4">{t.title}</h3>
                <p className="text-xs text-muted mt-1">{t.desc}</p>
              </button>
            );
          })}
        </div>
      )}

      {/* Opened setting */}
      {active && current && (
        <div>
          <button
            onClick={() => setActive(null)}
            className="flex items-center gap-2 px-3 py-2 mb-4 bg-card border border-main rounded-lg text-sm text-main hover:bg-accent-light transition"
          >
            <ArrowLeft size={16} />
            All settings
          </button>

          {active === 'appearance' && (
            <div className="bg-card border border-main rounded-xl p-6 shadow-theme max-w-2xl">
              <h2 className="text-sm font-semibold text-main mb-1">Appearance</h2>
              <p className="text-xs text-muted mb-4">Choose between light and dark mode</p>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-main">
                  {theme === 'dark' ? <Moon size={18} className="text-accent" /> : <Sun size={18} className="text-accent" />}
                  {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                </span>
                <button
                  onClick={toggleTheme}
                  className="px-4 py-2 bg-input hover:bg-accent-light text-main rounded-lg text-sm font-medium transition-colors border border-main"
                >
                  Switch to {theme === 'dark' ? 'Light' : 'Dark'}
                </button>
              </div>
            </div>
          )}

          {active === 'account' && (
            <div className="bg-card border border-main rounded-xl p-6 shadow-theme max-w-2xl">
              <h2 className="text-sm font-semibold text-main mb-1">Account</h2>
              <p className="text-xs text-muted mb-4">Your profile information</p>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-main/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-white font-semibold text-sm">
                      {currentUser.fullName?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-main">{currentUser.fullName}</p>
                      <p className="text-xs text-muted">{currentUser.email || currentUser.username}</p>
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
          )}

          {active === 'users' && isSuper && <UserManagement currentUser={currentUser} />}

          {active === 'data' && isAdmin && (
            <div className="bg-card border border-main rounded-xl p-6 shadow-theme max-w-2xl">
              <h2 className="text-sm font-semibold text-main mb-1">Data Management</h2>
              <p className="text-xs text-muted mb-4">Backup and restore your attendance data</p>
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
        </div>
      )}

      <div className="text-center text-xs text-muted pt-8">
        <p>MT World Attendance Register v2.0</p>
      </div>
    </div>
  );
}

export default SettingsPage;