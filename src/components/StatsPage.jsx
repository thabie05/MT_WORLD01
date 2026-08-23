import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  Calendar,
  TrendingUp,
  TrendingDown,
  BarChart3,
} from 'lucide-react';
import { monthNames } from '../utils/holidays';

const COLORS = ['#10B981', '#3B82F6', '#8B5CF6', '#EF4444', '#6B7280'];

function StatsPage({ employees, attendance }) {
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());

  // Compute stats for the selected month
  const stats = useMemo(() => {
    const activeEmployees = employees.filter((emp) => !emp.isDeleted);
    const monthPrefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-`;
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();

    // Per-employee breakdown
    const employeeStats = activeEmployees.map((emp) => {
      const empAttendance = attendance[emp.id] || {};
      const days = Object.keys(empAttendance).filter((key) => key.startsWith(monthPrefix));
      let present = 0,
        late = 0,
        early = 0,
        absent = 0,
        off = 0;
      days.forEach((dateKey) => {
        const status = empAttendance[dateKey];
        if (status === 'present') present++;
        else if (status === 'late') late++;
        else if (status === 'early') early++;
        else if (status === 'absent') absent++;
        else if (status === 'off') off++;
      });
      const worked = present + late + early;
      const possibleDays = daysInMonth;
      return {
        name: emp.name,
        present,
        late,
        early,
        absent,
        off,
        worked,
        possibleDays,
        attendanceRate: possibleDays > 0 ? Math.round((worked / possibleDays) * 100) : 0,
      };
    });

    // Totals
    const totals = employeeStats.reduce(
      (acc, row) => ({
        present: acc.present + row.present,
        late: acc.late + row.late,
        early: acc.early + row.early,
        absent: acc.absent + row.absent,
        off: acc.off + row.off,
        worked: acc.worked + row.worked,
        possibleDays: acc.possibleDays + row.possibleDays,
      }),
      { present: 0, late: 0, early: 0, absent: 0, off: 0, worked: 0, possibleDays: 0 }
    );

    // Chart data
    const statusChartData = [
      { name: 'Present', value: totals.present, color: '#10B981' },
      { name: 'Late', value: totals.late, color: '#3B82F6' },
      { name: 'Early', value: totals.early, color: '#8B5CF6' },
      { name: 'Absent', value: totals.absent, color: '#EF4444' },
      { name: 'Off Duty', value: totals.off, color: '#6B7280' },
    ].filter((d) => d.value > 0);

    const employeeChartData = employeeStats
      .filter((e) => e.worked > 0 || e.absent > 0)
      .slice(0, 15)
      .map((e) => ({
        name: e.name.length > 15 ? e.name.slice(0, 15) + '…' : e.name,
        Present: e.present,
        Late: e.late,
        Early: e.early,
        Absent: e.absent,
      }));

    return {
      employeeStats,
      totals,
      statusChartData,
      employeeChartData,
      totalEmployees: activeEmployees.length,
      daysInMonth,
      monthLabel: `${monthNames[selectedMonth]} ${selectedYear}`,
    };
  }, [employees, attendance, selectedMonth, selectedYear]);

  // Year options
  const yearOptions = [];
  for (let y = today.getFullYear() - 5; y <= today.getFullYear() + 5; y++) {
    yearOptions.push(y);
  }

  const overallAttendanceRate =
    stats.totals.possibleDays > 0
      ? Math.round((stats.totals.worked / stats.totals.possibleDays) * 100)
      : 0;

  return (
    <div className="w-full p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-main flex items-center gap-2">
            <BarChart3 className="text-accent" size={28} />
            Analytics & Stats
          </h1>
          <p className="text-muted text-sm mt-1">Monthly attendance overview and insights</p>
        </div>
        <div className="flex items-center gap-2 bg-card border border-main rounded-lg p-1.5 shadow-theme">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="bg-input text-main text-sm rounded-md px-2 py-1 outline-none focus:border-accent border border-main"
          >
            {monthNames.map((name, idx) => (
              <option key={idx} value={idx}>{name}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="bg-input text-main text-sm rounded-md px-2 py-1 outline-none focus:border-accent border border-main"
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <div className="bg-card border border-main rounded-xl p-3 shadow-theme text-center">
          <Users size={18} className="text-accent mx-auto mb-1" />
          <p className="text-xs text-muted">Employees</p>
          <p className="text-xl font-bold text-main">{stats.totalEmployees}</p>
        </div>
        <div className="bg-card border border-main rounded-xl p-3 shadow-theme text-center">
          <UserCheck size={18} className="text-emerald-400 mx-auto mb-1" />
          <p className="text-xs text-muted">Present</p>
          <p className="text-xl font-bold text-main">{stats.totals.present}</p>
        </div>
        <div className="bg-card border border-main rounded-xl p-3 shadow-theme text-center">
          <Clock size={18} className="text-blue-400 mx-auto mb-1" />
          <p className="text-xs text-muted">Late</p>
          <p className="text-xl font-bold text-main">{stats.totals.late}</p>
        </div>
        <div className="bg-card border border-main rounded-xl p-3 shadow-theme text-center">
          <UserX size={18} className="text-purple-400 mx-auto mb-1" />
          <p className="text-xs text-muted">Early</p>
          <p className="text-xl font-bold text-main">{stats.totals.early}</p>
        </div>
        <div className="bg-card border border-main rounded-xl p-3 shadow-theme text-center">
          <UserX size={18} className="text-red-400 mx-auto mb-1" />
          <p className="text-xs text-muted">Absent</p>
          <p className="text-xl font-bold text-main">{stats.totals.absent}</p>
        </div>
        <div className="bg-card border border-main rounded-xl p-3 shadow-theme text-center">
          <TrendingUp size={18} className="text-accent mx-auto mb-1" />
          <p className="text-xs text-muted">Attendance Rate</p>
          <p className="text-xl font-bold text-main">{overallAttendanceRate}%</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-card border border-main rounded-xl p-5 shadow-theme">
          <h2 className="text-sm font-semibold text-main mb-4">Status Distribution</h2>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={stats.statusChartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine
              >
                {stats.statusChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--bg-card)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-main)',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-main rounded-xl p-5 shadow-theme">
          <h2 className="text-sm font-semibold text-main mb-4">Employee Breakdown</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stats.employeeChartData} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" stroke="var(--text-muted)" />
              <YAxis type="category" dataKey="name" stroke="var(--text-muted)" tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--bg-card)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-main)',
                }}
              />
              <Legend />
              <Bar dataKey="Present" stackId="a" fill="#10B981" />
              <Bar dataKey="Late" stackId="a" fill="#3B82F6" />
              <Bar dataKey="Early" stackId="a" fill="#8B5CF6" />
              <Bar dataKey="Absent" stackId="a" fill="#EF4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Employee Details Table */}
      <div className="bg-card border border-main rounded-xl shadow-theme overflow-hidden">
        <div className="px-4 py-3 border-b border-main">
          <h2 className="text-sm font-semibold text-main flex items-center gap-2">
            <Users size={16} className="text-accent" />
            Employee Attendance Details
            <span className="text-xs text-muted font-normal ml-1">({stats.employeeStats.length} employees)</span>
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-accent-light/50 border-b border-main">
              <tr>
                <th className="text-left py-2 px-3 font-medium text-muted text-xs uppercase tracking-wider">Employee</th>
                <th className="text-center py-2 px-2 font-medium text-emerald-400 text-xs uppercase tracking-wider">Present</th>
                <th className="text-center py-2 px-2 font-medium text-blue-400 text-xs uppercase tracking-wider">Late</th>
                <th className="text-center py-2 px-2 font-medium text-purple-400 text-xs uppercase tracking-wider">Early</th>
                <th className="text-center py-2 px-2 font-medium text-red-400 text-xs uppercase tracking-wider">Absent</th>
                <th className="text-center py-2 px-2 font-medium text-gray-400 text-xs uppercase tracking-wider">Off</th>
                <th className="text-center py-2 px-2 font-medium text-accent text-xs uppercase tracking-wider">Worked</th>
                <th className="text-center py-2 px-2 font-medium text-muted text-xs uppercase tracking-wider">Rate</th>
              </tr>
            </thead>
            <tbody>
              {stats.employeeStats.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-8 text-muted text-sm">
                    No data for this month.
                  </td>
                </tr>
              ) : (
                stats.employeeStats.map((row, idx) => (
                  <tr key={idx} className="border-b border-main/50 hover:bg-accent-light/30 transition-colors">
                    <td className="py-2 px-3 font-medium text-main">{row.name}</td>
                    <td className="text-center py-2 px-2 text-emerald-400 font-medium">{row.present}</td>
                    <td className="text-center py-2 px-2 text-blue-400 font-medium">{row.late}</td>
                    <td className="text-center py-2 px-2 text-purple-400 font-medium">{row.early}</td>
                    <td className="text-center py-2 px-2 text-red-400 font-medium">{row.absent}</td>
                    <td className="text-center py-2 px-2 text-gray-400 font-medium">{row.off}</td>
                    <td className="text-center py-2 px-2 text-accent font-bold">{row.worked}</td>
                    <td className="text-center py-2 px-2 font-medium">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        row.attendanceRate >= 80
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : row.attendanceRate >= 50
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {row.attendanceRate}%
                      </span>
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

export default StatsPage;