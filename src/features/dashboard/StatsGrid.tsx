import React from 'react';
import { ClipboardList, CheckCircle2, AlertCircle } from 'lucide-react';

const StatsGrid: React.FC<{ pending: number; completed: number }> = ({ pending, completed }) => {
  const stats = [
    { label: 'Action Required', value: pending, icon: AlertCircle },
    { label: 'Completed By Me', value: completed, icon: CheckCircle2 },
    { label: 'Total Assigned', value: pending + completed, icon: ClipboardList },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      {stats.map((stat, i) => (
        <div key={i} className="card card-pad flex items-center justify-between gap-4">
          <div>
            <p className="caption">{stat.label}</p>
            <p className="text-2xl font-semibold text-ink mt-1">{stat.value}</p>
          </div>
          <stat.icon size={20} className="text-ink-subtle" />
        </div>
      ))}
    </div>
  );
};

export default StatsGrid;