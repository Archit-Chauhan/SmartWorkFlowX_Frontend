import { describe, it, expect } from 'vitest';
import {
  CLEARED_FILTERS, DEFAULT_STATE, activePills, ageDays, applyChange, assigneeLabel, clearPatch, dueCell, nextSort, parseState, toApiParams, toSearchParams,
} from '../features/tasks/allTasksState';
import { AllTasksQueryError, queryAllTasks } from '../demo/allTasks';
import { buildStore } from '../demo/data';
import type { TaskItem } from '../models';

const NOW = new Date('2026-10-09T12:00:00Z');
const daysFromNow = (d: number) => new Date(NOW.getTime() + d * 86_400_000).toISOString();

describe('URL <-> state', () => {
  it('reads defaults from an empty query', () => {
    expect(parseState(new URLSearchParams(''))).toEqual({ ...DEFAULT_STATE, status: undefined, priority: undefined, categoryId: undefined, assignedTo: undefined });
  });

  it('round-trips every field and leaves defaults out of the URL', () => {
    const state = { q: 'sla', group: 'open', status: 'Pending', priority: 'High', categoryId: 3, assignedTo: 4, overdue: true, sort: 'title', dir: 'desc', page: 2 } as const;
    const sp = toSearchParams(state);
    expect(sp.toString()).toBe('q=sla&group=open&status=Pending&priority=High&categoryId=3&assignedTo=4&overdue=true&sort=title&dir=desc&page=2');
    expect(parseState(sp)).toEqual(state);
    expect(toSearchParams(DEFAULT_STATE).toString()).toBe('');
  });

  it('ignores garbage instead of sending it to the server', () => {
    const s = parseState(new URLSearchParams('group=weird&status=Nope&priority=x&sort=colour&dir=up&page=-4&categoryId=abc&assignedTo=0&overdue=yes&q=%20%20hi%20'));
    expect(s).toMatchObject({ group: 'all', status: undefined, priority: undefined, sort: 'due', dir: 'asc', page: 1, categoryId: undefined, assignedTo: undefined, overdue: false, q: 'hi' });
  });

  it('caps the search text at 100 characters', () => {
    expect(parseState(new URLSearchParams({ q: 'x'.repeat(150) })).q).toHaveLength(100);
  });

  it('builds the API query, always including page so the paged shape is returned', () => {
    expect(toApiParams(DEFAULT_STATE)).toEqual({ page: 1, limit: 20, group: 'all', sort: 'due', dir: 'asc' });
    expect(toApiParams({ ...DEFAULT_STATE, q: 'a', priority: 'Low', categoryId: 2, assignedTo: 5, overdue: true, page: 3 }))
      .toEqual({ page: 3, limit: 20, group: 'all', sort: 'due', dir: 'asc', q: 'a', priority: 'Low', categoryId: 2, assignedTo: 5, overdue: 'true' });
  });

  it('any change resets to page 1, except changing the page itself', () => {
    const s = { ...DEFAULT_STATE, page: 4 };
    expect(applyChange(s, { group: 'open' }).page).toBe(1);
    expect(applyChange(s, { dir: 'desc' }).page).toBe(1);
    expect(applyChange(s, { q: 'x' }).page).toBe(1);
    expect(applyChange(s, { page: 5 }).page).toBe(5);
  });

  it('sorting: a new column starts in its first direction, the same column flips', () => {
    expect(nextSort(DEFAULT_STATE, 'title')).toEqual({ sort: 'title', dir: 'asc' });
    expect(nextSort(DEFAULT_STATE, 'created', 'desc')).toEqual({ sort: 'created', dir: 'desc' });
    expect(nextSort(DEFAULT_STATE, 'due')).toEqual({ sort: 'due', dir: 'desc' });
    expect(nextSort({ ...DEFAULT_STATE, sort: 'due', dir: 'desc' }, 'due')).toEqual({ sort: 'due', dir: 'asc' });
  });
});

describe('filter pills', () => {
  const cats = [{ categoryId: 2, name: 'HR', colorHex: '#000' }];
  const users = [{ userId: 4, name: 'Dan Patel' }];

  it('lists only the active filters, not the tab or the sort', () => {
    expect(activePills({ ...DEFAULT_STATE, group: 'open', sort: 'title' }, cats, users)).toEqual([]);
    const pills = activePills({ ...DEFAULT_STATE, q: 'x', priority: 'High', assignedTo: 4, categoryId: 2, overdue: true }, cats, users);
    expect(pills.map((p) => p.label)).toEqual(['Search: “x”', 'Priority: High', 'Assignee: Dan Patel', 'Category: HR', 'Overdue only']);
  });

  it('clearing a pill or all of them', () => {
    const s = applyChange({ ...DEFAULT_STATE, priority: 'High', overdue: true, group: 'open' }, clearPatch('priority'));
    expect(s.priority).toBeUndefined();
    expect(applyChange(s, clearPatch('overdue')).overdue).toBe(false);
    expect(applyChange({ ...s, q: 'a', assignedTo: 1 }, CLEARED_FILTERS)).toMatchObject({ q: '', assignedTo: undefined, overdue: false, group: 'open' });
  });
});

describe('assigneeLabel', () => {
  it('names the person when there is one', () => {
    expect(assigneeLabel({ status: 'In Progress', assigneeName: 'Dan Patel' })).toEqual({ kind: 'person', text: 'Dan Patel' });
  });
  it('says "Any <Role>" while the task waits in a role pool', () => {
    expect(assigneeLabel({ status: 'In Progress', assigneeName: null, assignedRoleName: 'Manager' })).toEqual({ kind: 'role', text: 'Any Manager' });
  });
  it('explains an empty assignee on finished tasks', () => {
    expect(assigneeLabel({ status: 'Completed', assigneeName: null })).toEqual({ kind: 'finished', text: 'Finished' });
    expect(assigneeLabel({ status: 'Cancelled', assigneeName: null })).toEqual({ kind: 'cancelled', text: 'Cancelled' });
  });
  it('is Unassigned otherwise', () => {
    expect(assigneeLabel({ status: 'Pending', assigneeName: null })).toEqual({ kind: 'unassigned', text: 'Unassigned' });
    expect(assigneeLabel({ status: 'Rejected', assigneeName: null })).toEqual({ kind: 'unassigned', text: 'Unassigned' });
  });
});

describe('dueCell and ageDays', () => {
  it('open tasks get a relative label', () => {
    expect(dueCell({ status: 'In Progress', dueDate: daysFromNow(-6.5) }, NOW)).toMatchObject({ label: '7d overdue', tone: 'overdue' });
    expect(dueCell({ status: 'Pending', dueDate: daysFromNow(0.2) }, NOW)).toMatchObject({ label: 'Due today', tone: 'soon' });
    expect(dueCell({ status: 'Pending', dueDate: daysFromNow(5) }, NOW)).toMatchObject({ label: 'Due in 5 days', tone: 'normal' });
    expect(dueCell({ status: 'Pending' }, NOW)).toMatchObject({ label: 'No due date', tone: 'none' });
  });

  it('closed tasks (even Rejected) just say when they were due, never overdue', () => {
    for (const status of ['Completed', 'Cancelled', 'Rejected'] as const) {
      const cell = dueCell({ status, dueDate: daysFromNow(-9) }, NOW);
      expect(cell.label).toMatch(/^Was due /);
      expect(cell.tone).toBe('normal');
    }
  });

  it('age is whole days since creation', () => {
    expect(ageDays(daysFromNow(-3.4), NOW)).toBe(3);
    expect(ageDays(daysFromNow(1), NOW)).toBe(0);
  });
});

describe('demo GET /Task/all', () => {
  const store = buildStore(false);
  const run = (qs: string) => queryAllTasks(store.tasks, store.workflows, new URLSearchParams(qs), NOW);

  it('is large enough to page', () => {
    expect(store.tasks.length).toBeGreaterThan(40);
    const r = run('page=1&limit=20');
    expect(r.data).toHaveLength(20);
    expect(r.total).toBe(store.tasks.length);
    expect(r.counts.all).toBe(r.counts.open + r.counts.completed + r.counts.closed);
  });

  it('counts ignore group/status, total honours them', () => {
    const all = run('page=1');
    const open = run('page=1&group=open');
    expect(open.counts).toEqual(all.counts);
    expect(open.total).toBe(all.counts.open);
    expect(open.data.every((t) => t.status === 'Pending' || t.status === 'In Progress')).toBe(true);
    expect(run('page=1&group=closed').data.every((t) => t.status === 'Rejected' || t.status === 'Cancelled')).toBe(true);
    expect(run('page=1&group=open&status=Completed').total).toBe(0);
  });

  it('paging never repeats or skips a row, and a page past the end is empty with the real total', () => {
    const ids = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].flatMap((p) => run(`page=${p}&limit=20&sort=priority`).data.map((t) => t.taskId));
    expect(ids).toHaveLength(store.tasks.length);
    expect(new Set(ids).size).toBe(store.tasks.length);
    const past = run('page=99');
    expect(past.data).toEqual([]);
    expect(past.total).toBe(store.tasks.length);
  });

  it('due sort keeps tasks without a date last in both directions', () => {
    const tasks: TaskItem[] = [
      { taskId: 1, title: 'a', workflowId: 1, status: 'Pending', priority: 'Low', currentStepOrder: 0, createdAt: daysFromNow(-1) },
      { taskId: 2, title: 'b', workflowId: 1, status: 'Pending', priority: 'Low', currentStepOrder: 0, createdAt: daysFromNow(-2), dueDate: daysFromNow(5) },
      { taskId: 3, title: 'c', workflowId: 1, status: 'Pending', priority: 'Low', currentStepOrder: 0, createdAt: daysFromNow(-3), dueDate: daysFromNow(2) },
    ];
    const ids = (dir: string) => queryAllTasks(tasks, [], new URLSearchParams(`page=1&sort=due&dir=${dir}`), NOW).data.map((t) => t.taskId);
    expect(ids('asc')).toEqual([3, 2, 1]);
    expect(ids('desc')).toEqual([2, 3, 1]);
  });

  it('priority asc is High first; assignee puts nobody last', () => {
    expect(run('page=1&sort=priority&dir=asc').data[0].priority).toBe('High');
    const byWho = run('page=1&limit=100&sort=assignee&dir=desc').data;
    const firstNull = byWho.findIndex((t) => !t.assigneeName);
    expect(byWho.slice(firstNull).every((t) => !t.assigneeName)).toBe(true);
  });

  it('filters: priority, category, assignee, overdue and search', () => {
    expect(run('page=1&limit=100&priority=High').data.every((t) => t.priority === 'High')).toBe(true);
    expect(run('page=1&limit=100&categoryId=2').data.every((t) => t.categoryId === 2)).toBe(true);
    const mine = run('page=1&limit=100&assignedTo=4');
    expect(mine.total).toBeGreaterThan(0);
    expect(mine.data.every((t) => t.assignedTo === 4)).toBe(true);
    const late = run('page=1&limit=100&overdue=true').data;
    expect(late.every((t) => (t.status === 'Pending' || t.status === 'In Progress') && new Date(t.dueDate!) < NOW)).toBe(true);
    expect(run('page=1&q=ONBOARD northwind').total).toBeGreaterThan(0); // case-insensitive
    expect(run('page=1&q=no-such-thing').total).toBe(0);
  });

  it('role-pool and finished rows follow the contract', () => {
    const rows = run('page=1&limit=100').data;
    expect(rows.every((t) => t.totalSteps !== undefined)).toBe(true);
    expect(rows.filter((t) => t.status === 'Completed').every((t) => t.assignedTo === null && t.assigneeName === null)).toBe(true);
    const pool = run('page=1&limit=100&group=open').data.filter((t) => t.assignedRoleName);
    expect(pool.every((t) => t.assigneeName === null && t.assignedTo === null)).toBe(true);
  });

  it('rejects unknown values with an error (400 in the adapter)', () => {
    for (const qs of ['status=Nope', 'priority=Urgent', 'sort=colour', 'dir=up', 'group=x', `q=${'x'.repeat(101)}`]) {
      expect(() => run(`page=1&${qs}`)).toThrow(AllTasksQueryError);
    }
  });
});
