import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { monthNames } from '../utils/holidays';

function StatsPage({ stats, currentMonth, currentYear, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-[2000] p-5" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-slate-900">📊 Attendance Statistics</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
        </div>
        
        <p className="text-slate-500 text-sm mb-4">{monthNames[currentMonth]} {currentYear}</p>
        
        <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 mb-5">
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie 
                data={stats} 
                dataKey="value" 
                nameKey="name" 
                cx="50%" 
                cy="50%" 
                outerRadius={120}
                innerRadius={0}
                paddingAngle={5}           // Space between slices
                label={({ name, value }) => `${name}: ${value}`}
                labelLine={true}
              >
                {stats.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} stroke="#fff" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip />
              <Legend 
                layout="horizontal" 
                verticalAlign="bottom" 
                align="center"
                wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-3 max-sm:grid-cols-2">
          {stats.map((stat) => (
            <div key={stat.name} className="text-center py-3 px-2 rounded-xl bg-slate-50 border border-slate-200" style={{ borderLeft: `4px solid ${stat.color}` }}>
              <span className="block text-xs text-slate-500 mb-1">{stat.name}</span>
              <strong className="text-xl text-slate-800">{stat.value}</strong>
            </div>
          ))}
        </div>

        <button onClick={onClose} className="mt-5 w-full py-2.5 px-4 bg-slate-800 text-white rounded-lg font-medium text-sm transition hover:bg-slate-700">Close</button>
      </div>
    </div>
  );
}

export default StatsPage;