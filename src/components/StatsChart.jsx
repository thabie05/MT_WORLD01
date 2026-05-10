import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

function StatsChart({ stats }) {
  return (
    <div className="bg-slate-50 rounded-xl p-5 mb-5 border border-slate-200">
      <h3 className="text-center text-lg font-bold text-slate-800 mb-4">Attendance Statistics</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie data={stats} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, value }) => `${name}: ${value}`}>
            {stats.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export default StatsChart;