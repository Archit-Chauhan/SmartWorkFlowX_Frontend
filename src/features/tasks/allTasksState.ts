import type { TaskCategory, TaskGroupFilter, TaskItem, TaskPriority, TaskStatus, User } from '../../models';
import { isActive } from './taskUtils';

// State of the All Tasks screen. It lives in the URL; the server filters, sorts and pages.

export const PAGE_SIZE = 20;
export const MAX_QUERY_LENGTH = 100;

export type SortKey = 'due' | 'created' | 'priority' | 'title' | 'workflow' | 'assignee' | 'status';
export type SortDir = 'asc' | 'desc';

export interface AllTasksState {
  q: string;
  group: TaskGroupFilter;
  status?: TaskStatus;
  priority?: TaskPriority;
  categoryId?: number;
  assignedTo?: number;
  overdue: boolean;
  sort: SortKey;
  dir: SortDir;
  page: number;
}

export const DEFAULT_STATE: AllTasksState = { q: '', group: 'all', overdue: false, sort: 'due', dir: 'asc', page: 1 };

export const GROUPS: { value: TaskGroupFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'completed', label: 'Completed' },
  { value: 'closed', label: 'Rejected / Cancelled' },
];

const STATUSES: TaskStatus[] = ['Pending', 'In Progress', 'Completed', 'Cancelled', 'Rejected'];
const PRIORITIES: TaskPriority[] = ['Low', 'Medium', 'High'];
const SORT_KEYS: SortKey[] = ['due', 'created', 'priority', 'title', 'workflow', 'assignee', 'status'];

export const PRIORITY_CHOICES = PRIORITIES;

const positiveInt = (v: string | null): number | undefined => {
  if (!v || !/^\d+$/.test(v)) return undefined;
  const n = Number(v);
  return n >= 1 ? n : undefined;
};

/** Reads the screen state from the URL. Unknown or malformed values fall back to the defaults. */
export function parseState(sp: URLSearchParams): AllTasksState {
  const group = sp.get('group') as TaskGroupFilter | null;
  const status = sp.get('status') as TaskStatus | null;
  const priority = sp.get('priority') as TaskPriority | null;
  const sort = sp.get('sort') as SortKey | null;
  const dir = sp.get('dir');
  return {
    q: (sp.get('q') ?? '').trim().slice(0, MAX_QUERY_LENGTH),
    group: group && GROUPS.some(g => g.value === group) ? group : 'all',
    status: status && STATUSES.includes(status) ? status : undefined,
    priority: priority && PRIORITIES.includes(priority) ? priority : undefined,
    categoryId: positiveInt(sp.get('categoryId')),
    assignedTo: positiveInt(sp.get('assignedTo')),
    overdue: sp.get('overdue') === 'true',
    sort: sort && SORT_KEYS.includes(sort) ? sort : 'due',
    dir: dir === 'desc' ? 'desc' : 'asc',
    page: positiveInt(sp.get('page')) ?? 1,
  };
}

/** The URL for a state: defaults are left out so a pristine screen has a clean address. */
export function toSearchParams(state: AllTasksState): URLSearchParams {
  const sp = new URLSearchParams();
  if (state.q) sp.set('q', state.q);
  if (state.group !== 'all') sp.set('group', state.group);
  if (state.status) sp.set('status', state.status);
  if (state.priority) sp.set('priority', state.priority);
  if (state.categoryId) sp.set('categoryId', String(state.categoryId));
  if (state.assignedTo) sp.set('assignedTo', String(state.assignedTo));
  if (state.overdue) sp.set('overdue', 'true');
  if (state.sort !== 'due') sp.set('sort', state.sort);
  if (state.dir !== 'asc') sp.set('dir', state.dir);
  if (state.page > 1) sp.set('page', String(state.page));
  return sp;
}

/** Query sent to GET /Task/all. `page` is always present: that is what asks for the paged shape. */
export function toApiParams(state: AllTasksState, limit = PAGE_SIZE): Record<string, string | number> {
  const params: Record<string, string | number> = { page: state.page, limit, group: state.group, sort: state.sort, dir: state.dir };
  if (state.q) params.q = state.q;
  if (state.status) params.status = state.status;
  if (state.priority) params.priority = state.priority;
  if (state.categoryId) params.categoryId = state.categoryId;
  if (state.assignedTo) params.assignedTo = state.assignedTo;
  if (state.overdue) params.overdue = 'true';
  return params;
}

/** Applies a change. Anything except moving between pages sends you back to page 1. */
export function applyChange(state: AllTasksState, patch: Partial<AllTasksState>): AllTasksState {
  return { ...state, ...patch, page: patch.page ?? 1 };
}

/** Sorting by a column: a new column starts in its natural direction, the same column flips. */
export function nextSort(state: AllTasksState, key: SortKey, firstDir: SortDir = 'asc'): Pick<AllTasksState, 'sort' | 'dir'> {
  if (state.sort !== key) return { sort: key, dir: firstDir };
  return { sort: key, dir: state.dir === 'asc' ? 'desc' : 'asc' };
}

export interface FilterPill {
  key: 'q' | 'status' | 'priority' | 'categoryId' | 'assignedTo' | 'overdue';
  label: string;
}

/** The removable chips under the toolbar (the tab and the sort are not filters). */
export function activePills(state: AllTasksState, categories: TaskCategory[], users: Pick<User, 'userId' | 'name'>[]): FilterPill[] {
  const pills: FilterPill[] = [];
  if (state.q) pills.push({ key: 'q', label: `Search: “${state.q}”` });
  if (state.status) pills.push({ key: 'status', label: `Status: ${state.status}` });
  if (state.priority) pills.push({ key: 'priority', label: `Priority: ${state.priority}` });
  if (state.assignedTo) pills.push({ key: 'assignedTo', label: `Assignee: ${users.find(u => u.userId === state.assignedTo)?.name ?? `User ${state.assignedTo}`}` });
  if (state.categoryId) pills.push({ key: 'categoryId', label: `Category: ${categories.find(c => c.categoryId === state.categoryId)?.name ?? `#${state.categoryId}`}` });
  if (state.overdue) pills.push({ key: 'overdue', label: 'Overdue only' });
  return pills;
}

/** Patch that removes one filter. */
export function clearPatch(key: FilterPill['key']): Partial<AllTasksState> {
  return key === 'overdue' ? { overdue: false } : key === 'q' ? { q: '' } : { [key]: undefined };
}

/** Everything except tab and sort back to "no filter". */
export const CLEARED_FILTERS: Partial<AllTasksState> = { q: '', status: undefined, priority: undefined, categoryId: undefined, assignedTo: undefined, overdue: false };

export type AssigneeKind = 'person' | 'role' | 'finished' | 'cancelled' | 'unassigned';

/** Who holds the task, in words. A null assignee means different things depending on where the task is. */
export function assigneeLabel(task: Pick<TaskItem, 'assigneeName' | 'assignedRoleName' | 'status'>): { kind: AssigneeKind; text: string } {
  if (task.assigneeName) return { kind: 'person', text: task.assigneeName };
  if (task.assignedRoleName) return { kind: 'role', text: `Any ${task.assignedRoleName}` };
  if (task.status === 'Completed') return { kind: 'finished', text: 'Finished' };
  if (task.status === 'Cancelled') return { kind: 'cancelled', text: 'Cancelled' };
  return { kind: 'unassigned', text: 'Unassigned' };
}

const DAY_MS = 86_400_000;

/** Whole days since the task was created (never negative). */
export function ageDays(createdAt: string, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(createdAt).getTime()) / DAY_MS));
}

export interface DueCell {
  label: string;
  /** Second line, e.g. the date of an open task. */
  sub: string;
  tone: 'overdue' | 'soon' | 'normal' | 'none';
}

const shortDate = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/**
 * Due column. Open tasks get a relative label ("7d overdue", "Due in 3 days");
 * closed ones (Completed, Cancelled, Rejected) just say when they were due, in neutral colour.
 */
export function dueCell(task: Pick<TaskItem, 'dueDate' | 'status'>, now: Date = new Date()): DueCell {
  if (!task.dueDate) return { label: 'No due date', sub: '', tone: 'none' };
  const due = new Date(task.dueDate);
  if (!isActive(task)) return { label: `Was due ${shortDate(due)}`, sub: '', tone: 'normal' };

  const sub = shortDate(due);
  if (due.getTime() < now.getTime()) {
    const days = Math.max(1, Math.ceil((now.getTime() - due.getTime()) / DAY_MS));
    return { label: `${days}d overdue`, sub, tone: 'overdue' };
  }
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(due) - startOfDay(now)) / DAY_MS);
  if (days <= 0) return { label: 'Due today', sub, tone: 'soon' };
  if (days === 1) return { label: 'Due tomorrow', sub, tone: 'soon' };
  return { label: `Due in ${days} days`, sub, tone: days <= 2 ? 'soon' : 'normal' };
}
