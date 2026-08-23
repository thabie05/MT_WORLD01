import React, { useState, useMemo } from 'react';
import {
  Clock,
  Search,
  Filter,
  User,
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock as ClockIcon,
  DoorOpen,
  Users,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { monthNames } from '../utils/holidays';

function HistoryPage({ history }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  // Filter and sort history
  const filteredHistory = useMemo(() => {
    let filtered = [...history];

    // Search by employee name
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter((entry) =>
        entry.employeeName?.toLowerCase().includes(term)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(
        (entry) => entry.status?.toLowerCase() === statusFilter.toLowerCase()
      );
    }

    // Date filter (by day or month)
    if (dateFilter) {
      filtered = filtered.filter((entry) => entry.date?.startsWith(dateFilter));
    }

    // Sort
    if (sortBy === 'newest') {
      filtered.sort((a, b) => new Date(b.editedAt) - new Date(a.editedAt));
    } else if (sortBy === 'oldest') {
      filtered.sort((a, b) => new Date(a.editedAt) - new Date(b.editedAt));
    } else if (sortBy === 'employee') {
      filtered.sort((a, b) =>
        (a.employeeName || '').localeCompare(b.employeeName || '')
      );
    }

    return filtered;
  }, [history, searchTerm, statusFilter, dateFilter, sortBy]);

  // Get unique statuses for filter dropdown
  const statuses = useMemo(() => {
    const unique = new Set(history.map((entry) => entry.status?.toLowerCase()).filter(Boolean));
    return ['all', ...unique];
  }, [history]);

  // Helper to get status color
  const getStatusColor = (status) => {
    const s = status?.toLowerCase();
    if (s === 'present') return 'text-emerald-400 bg-emerald-500/20';
    if (s === 'absent') return 'text-red-400 bg-red-500/20';
    if (s === 'late') return 'text-blue-400 bg-blue-500/20';
    if (s === 'early' || s === 'early leave') return 'text-purple-400 bg-purple-500/20';
    if (s === 'off duty') return 'text-gray-400 bg-gray-500/20';
    if (s === 'cleared' || s === 'undo') return 'text-yellow-400 bg-yellow-500/20';
    return 'text-muted bg-input';
  };

  const getStatusIcon = (status) => {
    const s = status?.toLowerCase();
    if (s === 'present') return <CheckCircle size={14} />;
    if (s === 'absent') return <XCircle size={14} />;
    if (s === 'late') return <ClockIcon size={14} />;
    if (s === 'early' || s === 'early leave') return <DoorOpen size={14} />;
    if (s === 'off duty') return <Users size={14} />;
    if (s === 'cleared' || s === 'undo') return <AlertCircle size={14} />;
    return <Clock size={14} />;
  };

  // Format date for display
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const [y, m, d] = dateStr.split('-');
    return `${d} ${monthNames[parseInt(m) - 1]} ${y}`;
  };

  const formatTime = (isoString) => {
    if (!isoString) return '—';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="w-full p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-main flex items-center gap-2">
            <Clock className="text-accent" size={28} />
            History & Logs
          </h1>
          <p className="text-muted text-sm mt-1">View all attendance changes and edits</p>
        </div>
        <div className="text-sm text-muted bg-card border border-main rounded-lg px-4 py-2 shadow-theme">
          Total Entries: <span className="font-semibold text-main">{filteredHistory.length}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card border border-main rounded-xl p-4 shadow-theme mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search employee..."
              className="w-full bg-input border border-main rounded-lg pl-9 pr-3 py-2 text-sm text-main outline-none focus:border-accent"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-input border border-main rounded-lg pl-9 pr-8 py-2 text-sm text-main outline-none focus:border-accent appearance-none"
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status === 'all' ? 'All Statuses' : status.charAt(0).toUpperCase() + status.slice(1)}
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          </div>

          {/* Date Filter */}
          <div className="relative">
            <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="month"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full bg-input border border-main rounded-lg pl-9 pr-3 py-2 text-sm text-main outline-none focus:border-accent"
            />
          </div>

          {/* Sort */}
          <div className="relative">
            <ChevronDown size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full bg-input border border-main rounded-lg pl-9 pr-8 py-2 text-sm text-main outline-none focus:border-accent appearance-none"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="employee">Sort by Employee</option>
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-card border border-main rounded-xl shadow-theme overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-accent-light/50 border-b border-main">
              <tr>
                <th className="text-left py-2 px-3 font-medium text-muted text-xs uppercase tracking-wider">Time</th>
                <th className="text-left py-2 px-3 font-medium text-muted text-xs uppercase tracking-wider">Employee</th>
                <th className="text-left py-2 px-3 font-medium text-muted text-xs uppercase tracking-wider">Date</th>
                <th className="text-left py-2 px-3 font-medium text-muted text-xs uppercase tracking-wider">Status</th>
                <th className="text-left py-2 px-3 font-medium text-muted text-xs uppercase tracking-wider">Editor</th>
                <th className="text-left py-2 px-3 font-medium text-muted text-xs uppercase tracking-wider">Note</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-muted text-sm">
                    No history entries found.
                  </td>
                </tr>
              ) : (
                filteredHistory.map((entry, idx) => (
                  <tr key={entry.id || idx} className="border-b border-main/50 hover:bg-accent-light/30 transition-colors">
                    <td className="py-2 px-3 text-muted text-xs whitespace-nowrap">
                      {formatTime(entry.editedAt)}
                    </td>
                    <td className="py-2 px-3 font-medium text-main">
                      {entry.employeeName || 'Unknown'}
                    </td>
                    <td className="py-2 px-3 text-muted whitespace-nowrap">
                      {formatDate(entry.date)}
                    </td>
                    <td className="py-2 px-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(entry.status)}`}>
                        {getStatusIcon(entry.status)}
                        {entry.status || '—'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-muted text-sm">
                      {entry.editor || 'System'}
                    </td>
                    <td className="py-2 px-3 text-muted text-sm max-w-[150px] truncate">
                      {entry.note || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default HistoryPage;