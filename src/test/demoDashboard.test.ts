import { describe, it, expect } from 'vitest';
import { computeDashboard, tasksToCsv, type DashboardScope } from '../demo/dashboard';
import type { TaskItem, TaskCategory } from '../models/Task';
import type { DashboardFilters } from '../models/Dashboard';

const users = [
  { userId: 4, name: 'Dan Patel', isDeleted: false },
  { userId: 5, name: 'Eve Torres', isDeleted: false },
  { userId: 7, name: 'Grace Kim', isDeleted: true },
];
const workflows = [{ workflowId: 1, title: 'Expense Approval' }, { workflowId: 2, title: 'Leave Request' }];
const categories: TaskCategory[] = [{ categoryId: 1, name: 'Finance', colorHex: '#0f62fe' }, { categoryId: 2, name: 'HR', colorHex: '#8a3ffc' }];
const all: DashboardScope = { kind: 'all' };
const NOW = new Date('2025-03-20T00:00:00Z');

const mk = (taskId: number, p: Partial<TaskItem>): TaskItem => ({
  taskId, title: `Task ${taskId}`, workflowId: 1, workflowTitle: 'Expense Approval', status: 'In Progress', priority: 'Medium',
  currentStepOrder: 1, createdAt: '2025-03-10T10:00:00Z', categoryId: 1, categoryName: 'Finance', categoryColor: '#0f62fe', ...p,
});

// Range 2025-03-10..2025-03-16 (Mon-Sun); previous period 2025-03-03..2025-03-09.
const tasks: TaskItem[] = [
  mk(1, { createdAt: '2025-03-10T10:00:00Z', dueDate: '2025-03-12T00:00:00Z', completedAt: '2025-03-11T10:00:00Z', status: 'Completed', priority: 'High', assignedTo: 4, assigneeName: 'Dan Patel' }),
  mk(2, { createdAt: '2025-03-05T12:00:00Z', dueDate: '2025-03-08T00:00:00Z', completedAt: '2025-03-12T12:00:00Z', status: 'Completed', workflowId: 2, workflowTitle: 'Leave Request', categoryId: 2, categoryName: 'HR' }),
  mk(3, { createdAt: '2025-03-04T09:00:00Z', dueDate: '2025-03-07T00:00:00Z', completedAt: '2025-03-06T09:00:00Z', status: 'Completed' }),
  mk(4, { createdAt: '2025-03-12T08:00:00Z', dueDate: '2025-03-14T00:00:00Z', priority: 'Low', assignedTo: 5, assigneeName: 'Eve Torres' }),
  mk(5, { createdAt: '2025-03-01T08:00:00Z', dueDate: '2025-03-08T00:00:00Z', status: 'Pending', assignedTo: 4, assigneeName: 'Dan Patel' }),
  mk(6, { createdAt: '2025-03-11T08:00:00Z', dueDate: '2025-03-20T00:00:00Z', status: 'Cancelled' }),
  mk(7, { createdAt: '2025-03-20T08:00:00Z', dueDate: '2025-03-25T00:00:00Z' }),
];
const march: DashboardFilters = { from: '2025-03-10', to: '2025-03-16' };
const run = (f: DashboardFilters = march, scope: DashboardScope = all, list = tasks) => computeDashboard(list, users, workflows, categories, f, scope, NOW);

describe('computeDashboard KPIs', () => {
  const r = run();

  it('reports the range and the previous period of equal length', () => {
    expect(r.range).toEqual({ from: '2025-03-10', to: '2025-03-16', previousFrom: '2025-03-03', previousTo: '2025-03-09', bucket: 'day' });
    expect(r.scope).toBe('all');
    expect(r.generatedAt).toBe(NOW.toISOString());
  });

  it('counts created and completed inside the range only', () => {
    expect(r.kpis.created).toEqual({ current: 3, previous: 2 });
    expect(r.kpis.completed).toEqual({ current: 2, previous: 1 });
  });

  it('counts open and overdue at the end of the range', () => {
    expect(r.kpis.open).toEqual({ current: 2, previous: 2 });
    expect(r.kpis.overdue).toEqual({ current: 2, previous: 2 });
  });

  it('computes on-time rate and average completion hours', () => {
    expect(r.kpis.onTimeRatePct).toEqual({ current: 50, previous: 100 });
    expect(r.kpis.avgCompletionHours).toEqual({ current: 96, previous: 48 });
  });

  it('uses null when nothing was completed', () => {
    const empty = run({ from: '2025-06-01', to: '2025-06-07' });
    expect(empty.kpis.onTimeRatePct.previous).toBeNull();
    expect(empty.kpis.avgCompletionHours.previous).toBeNull();
    expect(empty.kpis.completed).toEqual({ current: 0, previous: 0 });
  });

  it('treats the range end as inclusive up to 23:59:59.999', () => {
    const late = [mk(1, { createdAt: '2025-03-16T23:59:59.999Z' }), mk(2, { createdAt: '2025-03-17T00:00:00.000Z' })];
    expect(run(march, all, late).kpis.created.current).toBe(1);
  });
});

describe('computeDashboard series', () => {
  it('uses day buckets with zeros filled in', () => {
    const r = run();
    expect(r.series).toHaveLength(7);
    expect(r.series[0]).toEqual({ date: '2025-03-10', created: 1, completed: 0 });
    expect(r.series[1]).toEqual({ date: '2025-03-11', created: 1, completed: 1 });
    expect(r.series[2]).toEqual({ date: '2025-03-12', created: 1, completed: 1 });
    expect(r.series[3]).toEqual({ date: '2025-03-13', created: 0, completed: 0 });
  });

  it('switches from day to week buckets between 45 and 46 days', () => {
    const d45 = run({ from: '2025-01-01', to: '2025-02-14' });
    expect(d45.range.bucket).toBe('day');
    expect(d45.series).toHaveLength(45);
    const d46 = run({ from: '2025-01-01', to: '2025-02-15' });
    expect(d46.range.bucket).toBe('week');
    expect(d46.series.map(p => p.date)).toEqual(['2024-12-30', '2025-01-06', '2025-01-13', '2025-01-20', '2025-01-27', '2025-02-03', '2025-02-10']);
  });

  it('puts events into the Monday-start week they fall in', () => {
    const r = run({ from: '2025-01-01', to: '2025-02-15' }, all, [mk(1, { createdAt: '2025-01-08T10:00:00Z' })]);
    expect(r.series.find(p => p.date === '2025-01-06')!.created).toBe(1);
    expect(r.series.reduce((n, p) => n + p.created, 0)).toBe(1);
  });
});

describe('computeDashboard breakdowns', () => {
  const r = run();

  it('breaks down tasks created in the range', () => {
    expect(r.byStatus.find(s => s.status === 'In Progress')!.count).toBe(1);
    expect(r.byStatus.find(s => s.status === 'Completed')!.count).toBe(1);
    expect(r.byStatus.find(s => s.status === 'Cancelled')!.count).toBe(1);
    expect(r.byPriority).toEqual([{ priority: 'High', count: 1 }, { priority: 'Medium', count: 1 }, { priority: 'Low', count: 1 }]);
    expect(r.byCategory).toEqual([{ categoryId: 1, name: 'Finance', colorHex: '#0f62fe', count: 3 }]);
    expect(r.byWorkflow).toEqual([{ workflowId: 1, title: 'Expense Approval', total: 3, completed: 1, avgCycleHours: 24 }]);
  });

  it('buckets overdue tasks by days past due, always with all four buckets', () => {
    expect(r.overdueAging).toEqual([
      { bucket: '1-3 days', count: 1 }, { bucket: '4-7 days', count: 0 }, { bucket: '8-14 days', count: 1 }, { bucket: '15+ days', count: 0 },
    ]);
    expect(run({ from: '2025-02-01', to: '2025-02-02' }).overdueAging.map(a => a.count)).toEqual([0, 0, 0, 0]);
  });

  it('lists the most overdue tasks first', () => {
    expect(r.topOverdue.map(t => [t.taskId, t.daysOverdue])).toEqual([[5, 9], [4, 3]]);
  });

  it('builds workload per assignee from tasks created in the range, with options', () => {
    expect(r.workload).toEqual([
      { userId: 4, name: 'Dan Patel', pending: 0, inProgress: 0, completed: 1 },
      { userId: 5, name: 'Eve Torres', pending: 0, inProgress: 1, completed: 0 },
    ]);
    expect(r.options.assignees.map(a => a.id)).toEqual([4, 5]);
    expect(r.options.workflows).toHaveLength(2);
    expect(r.options.categories).toHaveLength(2);
  });
});

describe('computeDashboard scope and filters', () => {
  it('limits Employee scope to assigned or acted-on tasks and hides workload', () => {
    const self: DashboardScope = { kind: 'self', userId: 4, actedTaskIds: new Set([2]) };
    const r = run({ ...march, assigneeId: 5 }, self);
    expect(r.scope).toBe('self');
    expect(r.workload).toEqual([]);
    expect(r.options.assignees).toEqual([]);
    expect(r.kpis.created.current).toBe(1); // task 1 only; assigneeId is ignored
    expect(r.kpis.completed.current).toBe(2); // task 1 and acted-on task 2
    expect(r.kpis.overdue.current).toBe(1); // task 5
  });

  it('applies status, priority, category, workflow and assignee filters', () => {
    expect(run({ ...march, priority: 'High' }).kpis.created.current).toBe(1);
    expect(run({ ...march, status: 'Cancelled' }).kpis.created.current).toBe(1);
    expect(run({ ...march, categoryId: 2 }).kpis.created.current).toBe(0);
    expect(run({ ...march, categoryId: 2 }).kpis.completed.current).toBe(1);
    expect(run({ ...march, workflowId: 2 }).kpis.completed.current).toBe(1);
    const byAssignee = run({ ...march, assigneeId: 5 });
    expect(byAssignee.kpis.created.current).toBe(1);
    expect(byAssignee.kpis.overdue.current).toBe(1);
  });
});

describe('tasksToCsv', () => {
  it('emits the header and one row per task created in the range', () => {
    const lines = tasksToCsv(tasks, march, all).split('\r\n');
    expect(lines[0]).toBe('TaskId,Title,Workflow,Category,Assignee,Status,Priority,CreatedAt,DueDate,CompletedAt,CycleHours,Overdue');
    expect(lines).toHaveLength(4);
    expect(lines[1]).toBe('1,Task 1,Expense Approval,Finance,Dan Patel,Completed,High,2025-03-10T10:00:00Z,2025-03-12T00:00:00Z,2025-03-11T10:00:00Z,24,No');
    expect(lines[2].endsWith(',Yes')).toBe(true);
  });

  it('escapes quotes, commas and newlines', () => {
    const csv = tasksToCsv([mk(1, { title: 'Say "hi", ok\nbye' })], march, all);
    expect(csv.split('\r\n')[1].startsWith('1,"Say ""hi"", ok\nbye",')).toBe(true);
  });

  it('respects scope and filters', () => {
    const self: DashboardScope = { kind: 'self', userId: 4, actedTaskIds: new Set() };
    expect(tasksToCsv(tasks, march, self).split('\r\n')).toHaveLength(2);
    expect(tasksToCsv(tasks, { ...march, priority: 'Low' }, all).split('\r\n')).toHaveLength(2);
  });
});
