import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import type { SystemAnalytics } from '../../models';

const StatusChart: React.FC<{ stats: SystemAnalytics }> = ({ stats }) => {
  const data = [
    { name: 'Pending', value: stats.pendingTasks, color: 'var(--status-pending)' },
    { name: 'Completed', value: stats.completedTasks, color: 'var(--status-completed)' },
  ];

  return (
    <div className="h-[300px] w-full card p-4">
      <h3 className="caption mb-4 text-center">Task Completion Ratio</h3>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} stroke="var(--canvas)" />
            ))}
          </Pie>
          <Tooltip contentStyle={{ background: 'var(--canvas)', border: '1px solid var(--hairline)', color: 'var(--ink)', borderRadius: 6 }} itemStyle={{ color: 'var(--ink)' }} />
          <Legend verticalAlign="bottom" height={36} wrapperStyle={{ color: 'var(--ink-muted)', fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default StatusChart;