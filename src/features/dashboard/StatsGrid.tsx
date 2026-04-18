import React from 'react';
import { ClipboardList, CheckCircle2, AlertCircle } from 'lucide-react';

const StatsGrid: React.FC<{ pending: number; completed: number }> = ({ pending, completed }) => {
  const stats = [
    { label: 'Action Required', value: pending, icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Completed By Me', value: completed, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Total Assigned', value: pending + completed, icon: ClipboardList, color: 'text-blue-600', bg: 'bg-blue-50' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      {stats.map((stat, i) => (
        <div key={i} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
            <stat.icon size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">{stat.label}</p>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StatsGrid;