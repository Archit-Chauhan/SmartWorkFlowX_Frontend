import React from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { DashboardResponse } from '../../models/Dashboard';
import ChartCard from './ChartCard';
import { formatShortDate, statusColor } from './utils';

const TICK = { fill: 'var(--ink-subtle)', fontSize: 12 };
const AXIS_LINE = { stroke: 'var(--hairline)' };
const TOOLTIP_STYLE: React.CSSProperties = {
  background: 'var(--canvas)',
  border: '1px solid var(--hairline)',
  borderRadius: 6,
  color: 'var(--ink)',
  fontSize: 12,
};
const TOOLTIP_PROPS = {
  contentStyle: TOOLTIP_STYLE,
  labelStyle: { color: 'var(--ink)' },
  itemStyle: { color: 'var(--ink)' },
  cursor: { fill: 'var(--surface-1)' },
};
const LEGEND_STYLE = { color: 'var(--ink-muted)', fontSize: 12 };

const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);
const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;
const statusLabel = (s: string): string => s;

type Props = { data: DashboardResponse };

export const TrendChart: React.FC<Props> = ({ data }) => {
  const { series, range } = data;
  const weekly = range.bucket === 'week';
  const label = (d: string) => (weekly ? `Week of ${formatShortDate(d)}` : formatShortDate(d));
  const created = sum(series.map(p => p.created));
  const completed = sum(series.map(p => p.completed));
  return (
    <ChartCard
      title="Created vs completed"
      subtitle={weekly ? 'Tasks per week' : 'Tasks per day'}
      summary={`Area chart of tasks created and completed per ${range.bucket}. ${plural(created, 'task')} created and ${plural(completed, 'task')} completed from ${range.from} to ${range.to}.`}
      table={{
        caption: 'Created and completed tasks per period',
        columns: [weekly ? 'Week of' : 'Date', 'Created', 'Completed'],
        rows: series.map(p => [formatShortDate(p.date), p.created, p.completed]),
      }}
    >
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid stroke="var(--hairline)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tickFormatter={formatShortDate} tick={TICK} axisLine={AXIS_LINE} tickLine={false}
              minTickGap={24} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} tick={TICK} axisLine={false} tickLine={false} />
            <Tooltip {...TOOLTIP_PROPS} labelFormatter={l => label(String(l))} />
            <Legend wrapperStyle={LEGEND_STYLE} />
            <Area type="monotone" dataKey="created" name="Created" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.15} strokeWidth={2} />
            <Area type="monotone" dataKey="completed" name="Completed" stroke="var(--chart-4)" fill="var(--chart-4)" fillOpacity={0.15} strokeWidth={2} strokeDasharray="6 3" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
};

export const StatusDonut: React.FC<Props> = ({ data }) => {
  const rows = data.byStatus;
  const total = sum(rows.map(r => r.count));
  return (
    <ChartCard
      title="Status mix"
      subtitle="Tasks created in this period"
      summary={`Donut chart of ${plural(total, 'task')} by status: ${rows.map(r => `${r.status} ${r.count}`).join(', ')}.`}
      table={{ caption: 'Tasks by status', columns: ['Status', 'Tasks'], rows: rows.map(r => [statusLabel(r.status), r.count]) }}
    >
      <div className="flex flex-col items-center gap-3">
        <div className="relative w-40 h-40">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={rows} dataKey="count" nameKey="status" innerRadius="64%" outerRadius="100%" stroke="var(--canvas)" strokeWidth={2} isAnimationActive={false}>
                {rows.map(r => <Cell key={r.status} fill={statusColor(r.status)} />)}
              </Pie>
              <Tooltip {...TOOLTIP_PROPS} />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl font-semibold text-ink tabular-nums">{total}</span>
            <span className="caption">tasks</span>
          </div>
        </div>
        <ul className="w-full grid grid-cols-2 gap-x-6 gap-y-1">
          {rows.map(r => (
            <li key={r.status} className="flex items-center gap-2 text-sm">
              <span className="w-2.5 h-2.5 rounded-pill flex-shrink-0" style={{ background: statusColor(r.status) }} aria-hidden="true" />
              <span className="text-ink-muted flex-1 truncate">{statusLabel(r.status)}</span>
              <span className="text-ink font-medium tabular-nums">{r.count}</span>
            </li>
          ))}
        </ul>
      </div>
    </ChartCard>
  );
};

export const PriorityChart: React.FC<Props> = ({ data }) => {
  const rows = data.byPriority;
  return (
    <ChartCard
      title="Priority"
      subtitle="Tasks created in this period"
      summary={`Bar chart of tasks by priority: ${rows.map(r => `${r.priority} ${r.count}`).join(', ')}.`}
      table={{ caption: 'Tasks by priority', columns: ['Priority', 'Tasks'], rows: rows.map(r => [r.priority, r.count]) }}
    >
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid stroke="var(--hairline)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="priority" tick={TICK} axisLine={AXIS_LINE} tickLine={false} />
            <YAxis allowDecimals={false} tick={TICK} axisLine={false} tickLine={false} />
            <Tooltip {...TOOLTIP_PROPS} />
            <Bar dataKey="count" name="Tasks" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
};

const MAX_CATEGORY_BARS = 8;

/** Top categories plus one "Other" bar, so an unbounded list never makes the card grow without limit. */
function capCategories(all: DashboardResponse['byCategory']): DashboardResponse['byCategory'] {
  if (all.length <= MAX_CATEGORY_BARS) return all;
  const head = all.slice(0, MAX_CATEGORY_BARS - 1);
  const rest = all.slice(MAX_CATEGORY_BARS - 1);
  return [...head, { categoryId: null, name: 'Other', colorHex: 'var(--ink-subtle)', count: sum(rest.map(r => r.count)) }];
}

export const CategoryChart: React.FC<Props> = ({ data }) => {
  const allRows = data.byCategory;
  const rows = capCategories(allRows);
  const height = Math.max(224, rows.length * 36 + 24);
  return (
    <ChartCard
      title="By category"
      subtitle="Tasks created in this period"
      summary={`Bar chart of tasks by category: ${rows.map(r => `${r.name} ${r.count}`).join(', ') || 'none'}.`}
      table={{ caption: 'Tasks by category', columns: ['Category', 'Tasks'], rows: allRows.map(r => [r.name, r.count]) }}
    >
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--hairline)" strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={TICK} axisLine={AXIS_LINE} tickLine={false} />
            <YAxis type="category" dataKey="name" width={96} tick={TICK} axisLine={false} tickLine={false} />
            <Tooltip {...TOOLTIP_PROPS} />
            <Bar dataKey="count" name="Tasks" radius={[0, 4, 4, 0]} maxBarSize={22}>
              {rows.map(r => <Cell key={`${r.categoryId}-${r.name}`} fill={r.colorHex || 'var(--chart-3)'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
};

export const WorkloadChart: React.FC<Props> = ({ data }) => {
  const rows = data.workload;
  const height = Math.max(200, rows.length * 36 + 56);
  return (
    <ChartCard
      title="Workload per person"
      subtitle="Tasks created in this period, by current status"
      scroll
      summary={`Stacked bar chart of workload for ${plural(rows.length, 'person')}: ${rows.map(r => `${r.name} ${r.pending} pending, ${r.inProgress} in progress, ${r.completed} completed`).join('; ')}.`}
      table={{
        caption: 'Workload per person',
        columns: ['Person', 'Pending', 'In progress', 'Completed'],
        rows: rows.map(r => [r.name, r.pending, r.inProgress, r.completed]),
      }}
    >
      {rows.length === 0 ? (
        <p className="empty-state">No assigned tasks in this period.</p>
      ) : (
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--hairline)" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={TICK} axisLine={AXIS_LINE} tickLine={false} />
              <YAxis type="category" dataKey="name" width={96} tick={TICK} axisLine={false} tickLine={false} />
              <Tooltip {...TOOLTIP_PROPS} />
              <Legend wrapperStyle={LEGEND_STYLE} />
              <Bar dataKey="pending" name="Pending" stackId="w" fill="var(--status-pending)" maxBarSize={22} />
              <Bar dataKey="inProgress" name="In progress" stackId="w" fill="var(--status-progress)" maxBarSize={22} />
              <Bar dataKey="completed" name="Completed" stackId="w" fill="var(--status-completed)" maxBarSize={22} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
};

export const AgingChart: React.FC<Props> = ({ data }) => {
  const rows = data.overdueAging;
  const total = sum(rows.map(r => r.count));
  return (
    <ChartCard
      title="Overdue aging"
      subtitle="Open tasks past their due date, by days late"
      summary={`Bar chart of ${plural(total, 'overdue task')} by days past due: ${rows.map(r => `${r.bucket} ${r.count}`).join(', ')}.`}
      table={{ caption: 'Overdue tasks by age', columns: ['Days overdue', 'Tasks'], rows: rows.map(r => [r.bucket, r.count]) }}
    >
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid stroke="var(--hairline)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="bucket" tick={TICK} axisLine={AXIS_LINE} tickLine={false} />
            <YAxis allowDecimals={false} tick={TICK} axisLine={false} tickLine={false} />
            <Tooltip {...TOOLTIP_PROPS} />
            <Bar dataKey="count" name="Tasks" fill="var(--error)" radius={[4, 4, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
};
