// Pure reference implementation of GET /Report/dashboard (see docs/DASHBOARD_SPEC.md). All dates are UTC.
import type { TaskItem, TaskCategory } from '../models/Task';
import type { User } from '../models/User';
import type { WorkflowDetail } from '../models/Workflow';
import type {
  DashboardFilters, DashboardPermission, DashboardResponse, KpiValue, OverdueTask, TrendPoint, WorkflowStat, WorkloadRow,
} from '../models/Dashboard';

/**
 * Role policy (docs/DASHBOARD_SPEC.md, "Permissions"). The backend implements the same table.
 * Admin: everything. Manager: everything except audit activity. Auditor: read-only, no user/workflow totals.
 * Employee: own tasks only, export limited to those.
 */
export function permissionsForRole(role: string): DashboardPermission[] {
  switch (role) {
    case 'Admin': return ['workload', 'assignee-filter', 'activity', 'org-totals', 'export-tasks'];
    case 'Manager': return ['workload', 'assignee-filter', 'org-totals', 'export-tasks'];
    case 'Auditor': return ['workload', 'assignee-filter', 'activity', 'export-tasks'];
    default: return ['export-tasks']; // Employee and any unknown role: least privilege
  }
}

/**
 * 'all' covers every task; 'self' is the Employee scope: tasks assigned to the user or acted on by them (ids supplied
 * by the caller). `permissions` defaults to the Admin set for 'all' and the Employee set for 'self'.
 */
export type DashboardScope =
  | { kind: 'all'; permissions?: DashboardPermission[] }
  | { kind: 'self'; userId: number; actedTaskIds: ReadonlySet<number>; permissions?: DashboardPermission[] };

const permsOf = (scope: DashboardScope): DashboardPermission[] =>
  scope.permissions ?? permissionsForRole(scope.kind === 'all' ? 'Admin' : 'Employee');

type UserLite = Pick<User, 'userId' | 'name' | 'isDeleted'>;
type WorkflowLite = Pick<WorkflowDetail, 'workflowId' | 'title'> & { status?: string };

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const STATUSES = ['Pending', 'In Progress', 'Completed', 'Rejected', 'Cancelled'];
const PRIORITIES = ['High', 'Medium', 'Low'];
const AGING = ['1-3 days', '4-7 days', '8-14 days', '15+ days'] as const;

const dayStart = (d: string) => Date.parse(`${d}T00:00:00.000Z`);
const fmt = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const ms = (v?: string) => (v ? Date.parse(v) : NaN);
const within = (v: number, a: number, b: number) => v >= a && v <= b;
const mondayOf = (t: number) => { const d = Math.floor(t / DAY) * DAY; return d - ((new Date(d).getUTCDay() + 6) % 7) * DAY; };
const round = (n: number, dp = 1) => Math.round(n * 10 ** dp) / 10 ** dp;

/** Applies the scope and the optional filters (not the date range). assigneeId is ignored without the 'assignee-filter' permission. */
export function filterTasks(tasks: TaskItem[], f: DashboardFilters, scope: DashboardScope): TaskItem[] {
  return tasks.filter(t => {
    if (scope.kind === 'self' && t.assignedTo !== scope.userId && !scope.actedTaskIds.has(t.taskId)) return false;
    if (f.status && t.status !== f.status) return false;
    if (f.priority && t.priority !== f.priority) return false;
    if (f.categoryId != null && t.categoryId !== f.categoryId) return false;
    if (f.workflowId != null && t.workflowId !== f.workflowId) return false;
    if (permsOf(scope).includes('assignee-filter') && f.assigneeId != null && t.assignedTo !== f.assigneeId) return false;
    return true;
  });
}

const isOpenAt = (t: TaskItem, at: number) => {
  const created = ms(t.createdAt), done = ms(t.completedAt);
  return created <= at && t.status !== 'Cancelled' && t.status !== 'Rejected' && !(done <= at);
};
const isOverdueAt = (t: TaskItem, at: number) => isOpenAt(t, at) && ms(t.dueDate) < at;

function measure(tasks: TaskItem[], a: number, b: number) {
  const completed = tasks.filter(t => within(ms(t.completedAt), a, b));
  const withDue = completed.some(t => !Number.isNaN(ms(t.dueDate)));
  const onTime = completed.filter(t => ms(t.completedAt) <= ms(t.dueDate)).length;
  return {
    created: tasks.filter(t => within(ms(t.createdAt), a, b)).length,
    completed: completed.length,
    open: tasks.filter(t => isOpenAt(t, b)).length,
    overdue: tasks.filter(t => isOverdueAt(t, b)).length,
    onTimeRatePct: completed.length && withDue ? round((onTime / completed.length) * 100) : null,
    avgCompletionHours: completed.length ? round(completed.reduce((sum, t) => sum + (ms(t.completedAt) - ms(t.createdAt)) / HOUR, 0) / completed.length) : null,
  };
}

const kpi = (current: number | null, previous: number | null): KpiValue => ({ current: current ?? 0, previous });

export function computeDashboard(
  allTasks: TaskItem[], users: UserLite[], workflows: WorkflowLite[], categories: TaskCategory[],
  filters: DashboardFilters, scope: DashboardScope, now: Date = new Date(),
): DashboardResponse {
  const tasks = filterTasks(allTasks, filters, scope);
  const start = dayStart(filters.from);
  const end = dayStart(filters.to) + DAY - 1;
  const days = Math.round((dayStart(filters.to) - start) / DAY) + 1;
  const prevStart = start - days * DAY;
  const prevEnd = start - 1;
  const bucket = days <= 45 ? 'day' : 'week';

  const cur = measure(tasks, start, end);
  const prev = measure(tasks, prevStart, prevEnd);

  // Series: every bucket present.
  const step = bucket === 'day' ? DAY : 7 * DAY;
  const keyOf = (t: number) => (bucket === 'day' ? Math.floor(t / DAY) * DAY : mondayOf(t));
  const points = new Map<number, TrendPoint>();
  for (let k = keyOf(start); k <= end; k += step) points.set(k, { date: fmt(k), created: 0, completed: 0 });
  for (const t of tasks) {
    const c = ms(t.createdAt), d = ms(t.completedAt);
    if (within(c, start, end)) points.get(keyOf(c))!.created++;
    if (within(d, start, end)) points.get(keyOf(d))!.completed++;
  }

  const created = tasks.filter(t => within(ms(t.createdAt), start, end));

  const byCat = new Map<number | null, { categoryId: number | null; name: string; colorHex: string; count: number }>();
  for (const t of created) {
    const id = t.categoryId ?? null;
    const c = categories.find(x => x.categoryId === id);
    const row = byCat.get(id) ?? { categoryId: id, name: c?.name ?? t.categoryName ?? 'Uncategorized', colorHex: c?.colorHex ?? t.categoryColor ?? '#9ca3af', count: 0 };
    row.count++;
    byCat.set(id, row);
  }

  const byWf = new Map<number, { stat: WorkflowStat; hours: number[] }>();
  for (const t of created) {
    const e = byWf.get(t.workflowId) ?? { stat: { workflowId: t.workflowId, title: workflows.find(w => w.workflowId === t.workflowId)?.title ?? t.workflowTitle ?? `Workflow ${t.workflowId}`, total: 0, completed: 0, avgCycleHours: null }, hours: [] };
    e.stat.total++;
    if (t.completedAt) { e.stat.completed++; e.hours.push((ms(t.completedAt) - ms(t.createdAt)) / HOUR); }
    byWf.set(t.workflowId, e);
  }

  const perms = permsOf(scope);
  const load = new Map<number, WorkloadRow>();
  if (scope.kind === 'all' && perms.includes('workload')) {
    for (const t of created) {
      if (t.assignedTo == null) continue;
      const row = load.get(t.assignedTo) ?? { userId: t.assignedTo, name: users.find(u => u.userId === t.assignedTo)?.name ?? t.assigneeName ?? `User ${t.assignedTo}`, pending: 0, inProgress: 0, completed: 0 };
      if (t.status === 'Pending') row.pending++;
      else if (t.status === 'In Progress') row.inProgress++;
      else if (t.status === 'Completed') row.completed++;
      load.set(t.assignedTo, row);
    }
  }

  // Days past due are rounded up, so anything overdue by part of a day counts as 1 day.
  const overdue: OverdueTask[] = tasks.filter(t => isOverdueAt(t, end)).map(t => ({
    taskId: t.taskId, title: t.title, assigneeName: t.assigneeName ?? undefined, workflowTitle: t.workflowTitle, priority: t.priority,
    dueDate: t.dueDate!, daysOverdue: Math.ceil((end - ms(t.dueDate)) / DAY),
  })).sort((a, b) => b.daysOverdue - a.daysOverdue || a.taskId - b.taskId);
  const ageOf = (d: number) => (d <= 3 ? 0 : d <= 7 ? 1 : d <= 14 ? 2 : 3);
  const aging = AGING.map(b => ({ bucket: b, count: 0 }));
  overdue.forEach(t => { aging[ageOf(t.daysOverdue)].count++; });

  return {
    scope: scope.kind === 'self' ? 'self' : 'all',
    generatedAt: now.toISOString(),
    permissions: perms,
    ...(perms.includes('org-totals')
      ? { totals: { users: users.filter(u => !u.isDeleted).length, workflows: workflows.length, activeWorkflows: workflows.filter(w => w.status === 'Active').length } }
      : {}),
    range: { from: filters.from, to: filters.to, previousFrom: fmt(prevStart), previousTo: fmt(prevEnd), bucket },
    kpis: {
      created: kpi(cur.created, prev.created),
      completed: kpi(cur.completed, prev.completed),
      open: kpi(cur.open, prev.open),
      overdue: kpi(cur.overdue, prev.overdue),
      onTimeRatePct: { current: cur.onTimeRatePct ?? 0, previous: prev.onTimeRatePct },
      avgCompletionHours: { current: cur.avgCompletionHours ?? 0, previous: prev.avgCompletionHours },
    },
    series: [...points.values()],
    byStatus: STATUSES.map(status => ({ status, count: created.filter(t => t.status === status).length })),
    byPriority: PRIORITIES.map(priority => ({ priority, count: created.filter(t => t.priority === priority).length })),
    byCategory: [...byCat.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    byWorkflow: [...byWf.values()].map(({ stat, hours }) => ({ ...stat, avgCycleHours: hours.length ? round(hours.reduce((a, b) => a + b, 0) / hours.length) : null })).sort((a, b) => b.total - a.total || a.title.localeCompare(b.title)),
    workload: [...load.values()].sort((a, b) => b.pending + b.inProgress + b.completed - (a.pending + a.inProgress + a.completed) || a.name.localeCompare(b.name)).slice(0, 10),
    overdueAging: aging,
    topOverdue: overdue.slice(0, 10),
    options: {
      workflows: workflows.map(w => ({ id: w.workflowId, title: w.title })),
      categories: categories.map(c => ({ id: c.categoryId, name: c.name, colorHex: c.colorHex })),
      assignees: perms.includes('assignee-filter') ? users.filter(u => !u.isDeleted).map(u => ({ id: u.userId, name: u.name })) : [],
    },
  };
}

const cell = (v: unknown) => {
  const s = String(v ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV of the filtered tasks created in the range. Overdue is evaluated at the end of the range. */
export function tasksToCsv(tasks: TaskItem[], filters: DashboardFilters, scope: DashboardScope): string {
  const start = dayStart(filters.from);
  const end = dayStart(filters.to) + DAY - 1;
  const header = ['TaskId', 'Title', 'Workflow', 'Category', 'Assignee', 'Status', 'Priority', 'CreatedAt', 'DueDate', 'CompletedAt', 'CycleHours', 'Overdue'];
  const rows = filterTasks(tasks, filters, scope)
    .filter(t => within(ms(t.createdAt), start, end))
    .map(t => [
      t.taskId, t.title, t.workflowTitle, t.categoryName, t.assigneeName, t.status, t.priority, t.createdAt, t.dueDate, t.completedAt,
      t.completedAt ? round((ms(t.completedAt) - ms(t.createdAt)) / HOUR, 2) : '',
      isOverdueAt(t, end) ? 'Yes' : 'No',
    ]);
  return [header, ...rows].map(r => r.map(cell).join(',')).join('\r\n');
}
