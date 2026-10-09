// Demo-only: GET /Task/all as specified in docs/ALL_TASKS_SPEC.md (filters, sort, paging, counts).
import type { AllTasksResponse, TaskGroupFilter, TaskItem, TaskPriority, TaskStatus } from '../models/Task';
import type { WorkflowDetail } from '../models/Workflow';

export class AllTasksQueryError extends Error {}

const OPEN: TaskStatus[] = ['Pending', 'In Progress'];
const STATUSES: TaskStatus[] = ['Pending', 'In Progress', 'Completed', 'Cancelled', 'Rejected'];
const PRIORITIES: TaskPriority[] = ['Low', 'Medium', 'High'];
const GROUPS: TaskGroupFilter[] = ['all', 'open', 'completed', 'closed'];
const SORTS = ['due', 'created', 'priority', 'title', 'workflow', 'assignee', 'status'] as const;
type Sort = (typeof SORTS)[number];
const PRIORITY_RANK: Record<TaskPriority, number> = { High: 0, Medium: 1, Low: 2 };

const isOpen = (t: Pick<TaskItem, 'status'>) => OPEN.includes(t.status);
const groupOf = (t: Pick<TaskItem, 'status'>): Exclude<TaskGroupFilter, 'all'> =>
  isOpen(t) ? 'open' : t.status === 'Completed' ? 'completed' : 'closed';

/**
 * The shape the paged endpoint returns. Nobody holds a finished task; every fifth open task that sits at an
 * approval step is shown as waiting in the approver role's pool instead of with a named person.
 */
export function toAllTasksRow(t: TaskItem, workflows: WorkflowDetail[]): TaskItem {
  const wf = workflows.find((w) => w.workflowId === t.workflowId);
  const row: TaskItem = { ...t, totalSteps: wf?.steps.length, assignedTo: t.assignedTo ?? null, assigneeName: t.assigneeName ?? null, assignedRoleName: null };
  if (!isOpen(t)) {
    row.assignedTo = null;
    row.assigneeName = null;
  } else if (t.status === 'In Progress' && t.currentStepOrder >= 1 && t.taskId % 5 === 0) {
    row.assignedTo = null;
    row.assigneeName = null;
    row.assignedRoleName = wf?.steps.find((s) => s.stepOrder === t.currentStepOrder)?.approverRoleName ?? null;
  }
  return row;
}

const compare = (a: string | number, b: string | number) => (a < b ? -1 : a > b ? 1 : 0);

export function queryAllTasks(tasks: TaskItem[], workflows: WorkflowDetail[], q: URLSearchParams, now: Date = new Date()): AllTasksResponse {
  const search = (q.get('q') ?? '').trim();
  if (search.length > 100) throw new AllTasksQueryError('Search text can be at most 100 characters.');
  const group = (q.get('group') || 'all') as TaskGroupFilter;
  if (!GROUPS.includes(group)) throw new AllTasksQueryError(`Unknown group '${group}'.`);
  const status = q.get('status') as TaskStatus | null;
  if (status && !STATUSES.includes(status)) throw new AllTasksQueryError(`Unknown status '${status}'.`);
  const priority = q.get('priority') as TaskPriority | null;
  if (priority && !PRIORITIES.includes(priority)) throw new AllTasksQueryError(`Unknown priority '${priority}'.`);
  const sort = (q.get('sort') || 'due') as Sort;
  if (!SORTS.includes(sort)) throw new AllTasksQueryError(`Unknown sort '${sort}'.`);
  const dir = q.get('dir') || 'asc';
  if (dir !== 'asc' && dir !== 'desc') throw new AllTasksQueryError(`Unknown dir '${dir}'.`);
  const num = (k: string) => (q.get(k) ? Number(q.get(k)) : undefined);
  const categoryId = num('categoryId');
  const assignedTo = num('assignedTo');
  const overdue = q.get('overdue') === 'true';
  const size = Math.min(100, Math.max(1, Math.floor(Number(q.get('limit') || 20)) || 20));
  const page = Math.max(1, Math.floor(Number(q.get('page') || 1)) || 1);

  const needle = search.toLowerCase();
  const rows = tasks.map((t) => toAllTasksRow(t, workflows)).filter((t) =>
    (!needle || [t.title, t.description, t.workflowTitle, t.assigneeName].some((f) => (f ?? '').toLowerCase().includes(needle))) &&
    (!priority || t.priority === priority) &&
    (categoryId === undefined || t.categoryId === categoryId) &&
    (assignedTo === undefined || t.assignedTo === assignedTo) &&
    (!overdue || (isOpen(t) && !!t.dueDate && new Date(t.dueDate) < now)));

  const counts: Record<TaskGroupFilter, number> = { all: rows.length, open: 0, completed: 0, closed: 0 };
  for (const t of rows) counts[groupOf(t)]++;

  const sign = dir === 'asc' ? 1 : -1;
  const matching = rows.filter((t) => (group === 'all' || groupOf(t) === group) && (!status || t.status === status));
  matching.sort((a, b) => {
    let c = 0;
    if (sort === 'due') {
      // No due date is always last, whichever way the column is sorted.
      if (!a.dueDate !== !b.dueDate) return a.dueDate ? -1 : 1;
      c = a.dueDate && b.dueDate ? sign * compare(Date.parse(a.dueDate), Date.parse(b.dueDate)) : 0;
    } else if (sort === 'assignee') {
      if (!a.assigneeName !== !b.assigneeName) return a.assigneeName ? -1 : 1;
      c = sign * compare((a.assigneeName ?? '').toLowerCase(), (b.assigneeName ?? '').toLowerCase());
    } else if (sort === 'created') c = sign * compare(Date.parse(a.createdAt), Date.parse(b.createdAt));
    else if (sort === 'priority') c = sign * compare(PRIORITY_RANK[a.priority], PRIORITY_RANK[b.priority]);
    else if (sort === 'title') c = sign * compare(a.title.toLowerCase(), b.title.toLowerCase());
    else if (sort === 'workflow') c = sign * compare((a.workflowTitle ?? '').toLowerCase(), (b.workflowTitle ?? '').toLowerCase());
    else c = sign * compare(a.status, b.status);
    // Stable across pages: newest first, then id.
    return c || compare(Date.parse(b.createdAt), Date.parse(a.createdAt)) || compare(a.taskId, b.taskId);
  });

  return { data: matching.slice((page - 1) * size, page * size), total: matching.length, page, pageSize: size, counts };
}
