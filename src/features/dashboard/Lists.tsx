import React from 'react';
import { Link } from 'react-router-dom';
import type { DashboardResponse } from '../../models/Dashboard';
import ChartCard from './ChartCard';
import { completionPct, formatHours, priorityChip } from './utils';

export const WorkflowPerformance: React.FC<{ rows: DashboardResponse['byWorkflow'] }> = ({ rows }) => (
  <ChartCard title="Workflow performance" subtitle="Tasks created in this period">
    {rows.length === 0 ? (
      <p className="empty-state">No workflows in this period.</p>
    ) : (
      <div className="overflow-x-auto -mx-6">
        <table className="table tabular-nums">
          <thead>
            <tr>
              <th scope="col">Workflow</th>
              <th scope="col" className="text-right">Total</th>
              <th scope="col">Completed</th>
              <th scope="col" className="text-right">Avg cycle</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(w => {
              const pct = completionPct(w.completed, w.total);
              return (
                <tr key={w.workflowId}>
                  <td className="font-medium">{w.title}</td>
                  <td className="text-right">{w.total}</td>
                  <td>
                    <div className="flex items-center gap-2 min-w-32">
                      <div className="h-1.5 flex-1 rounded-pill bg-surface-2 overflow-hidden" aria-hidden="true">
                        <div className="h-full bg-status-completed" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-ink-muted whitespace-nowrap">{w.completed} ({pct}%)</span>
                    </div>
                  </td>
                  <td className="text-right whitespace-nowrap">{formatHours(w.avgCycleHours)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </ChartCard>
);

export const TopOverdueList: React.FC<{ rows: DashboardResponse['topOverdue'] }> = ({ rows }) => (
  <ChartCard title="Most overdue" subtitle="Open tasks furthest past their due date">
    {rows.length === 0 ? (
      <p className="empty-state">Nothing is overdue.</p>
    ) : (
      <ul className="divide-y divide-hairline -my-2">
        {rows.map(t => (
          <li key={t.taskId}>
            <Link to="/all-tasks" className="flex items-center gap-3 py-3 min-h-11 rounded-control hover:bg-surface-1">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink truncate">{t.title}</p>
                <p className="caption truncate">
                  {[t.assigneeName, t.workflowTitle].filter(Boolean).join(' · ') || 'Unassigned'}
                </p>
              </div>
              <span className={`chip ${priorityChip(t.priority)}`}>{t.priority}</span>
              <span className="text-xs font-medium text-error tabular-nums whitespace-nowrap">
                {t.daysOverdue} day{t.daysOverdue === 1 ? '' : 's'} overdue
              </span>
            </Link>
          </li>
        ))}
      </ul>
    )}
  </ChartCard>
);

export interface ActivityEntry {
  userName: string;
  action: string;
  entityName: string;
  timestamp: string;
}

export const RecentActivity: React.FC<{ rows: ActivityEntry[] }> = ({ rows }) => (
  <ChartCard title="Recent activity" subtitle="Latest audit log entries">
    {rows.length === 0 ? (
      <p className="empty-state">No recent activity.</p>
    ) : (
      <ul className="divide-y divide-hairline -my-2">
        {rows.map((r, i) => (
          <li key={i} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink break-words">
                <span className="font-medium">{r.userName}</span>{' '}
                <span className="text-ink-muted">{r.action}</span>
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="chip chip-neutral">{r.entityName}</span>
              <time className="text-xs text-ink-subtle font-mono whitespace-nowrap" dateTime={r.timestamp}>
                {new Date(r.timestamp).toLocaleString()}
              </time>
            </div>
          </li>
        ))}
      </ul>
    )}
  </ChartCard>
);
