// Demo-only axios adapter: answers every API call from an in-memory store. Loaded only when __DEMO__ is true.
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { buildStore, CATEGORIES, ME_BY_ROLE, ROLES, type DemoStore } from './data';
import type { UserRole } from '../models/User';
import type { TaskItem } from '../models/Task';
import type { DashboardFilters } from '../models/Dashboard';
import { AllTasksQueryError, queryAllTasks } from './allTasks';
import { computeDashboard, permissionsForRole, tasksToCsv, type DashboardScope } from './dashboard';

let store: DemoStore | null = null;
const isEmpty = () => { try { return localStorage.getItem('swfx-demo-data') === 'empty'; } catch { return false; } };
const db = () => (store ??= buildStore(isEmpty()));
const currentRole = (): UserRole => (localStorage.getItem('role') as UserRole) || 'Admin';
const meId = () => ME_BY_ROLE[currentRole()] ?? 1;
const meName = () => db().users.find(u => u.userId === meId())?.name ?? 'Demo User';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const page = <T,>(rows: T[], q: URLSearchParams, sizeKey = 'limit') => {
  const size = Number(q.get(sizeKey) || q.get('pageSize') || q.get('limit') || 10);
  const p = Number(q.get('page') || 1);
  return { data: rows.slice((p - 1) * size, p * size), total: rows.length, page: p, pageSize: size };
};
const contains = <T extends object>(q: URLSearchParams, ...fields: string[]) => {
  const s = (q.get('search') || '').toLowerCase();
  return (row: T) => !s || fields.some(f => String((row as Record<string, unknown>)[f] ?? '').toLowerCase().includes(s));
};
const csv = (rows: Record<string, unknown>[]) => {
  const keys = rows[0] ? Object.keys(rows[0]) : [];
  return [keys.join(','), ...rows.map(r => keys.map(k => JSON.stringify(r[k] ?? '')).join(','))].join('\n');
};
const dashboardArgs = (q: URLSearchParams, s: DemoStore): { filters: DashboardFilters; scope: DashboardScope } => {
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const today = new Date();
  const num = (k: string) => (q.get(k) ? Number(q.get(k)) : undefined);
  const filters: DashboardFilters = {
    from: q.get('from') || day(new Date(today.getTime() - 29 * 86400_000)), to: q.get('to') || day(today),
    status: q.get('status') || undefined, priority: q.get('priority') || undefined,
    categoryId: num('categoryId'), workflowId: num('workflowId'), assigneeId: num('assigneeId'),
  };
  const name = meName();
  const permissions = permissionsForRole(currentRole());
  const scope: DashboardScope = currentRole() === 'Employee'
    ? { kind: 'self', userId: meId(), actedTaskIds: new Set(s.tasks.filter(t => s.history[t.taskId]?.some(h => h.actedByName === name)).map(t => t.taskId)), permissions }
    : { kind: 'all', permissions };
  return { filters, scope };
};
const fail = (status: number, message: string) =>
  Promise.reject(Object.assign(new Error(message), { response: { status, data: { message } }, isAxiosError: true }));

function handle(method: string, path: string, q: URLSearchParams, body: Record<string, any>): unknown | Promise<unknown> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const s = db();
  const m = (re: RegExp) => path.match(re);
  let r: RegExpMatchArray | null;

  // ── Auth ──
  if (method === 'post' && path === '/Auth/login') {
    const email = String(body.email || 'admin@swfx.demo').toLowerCase();
    const role: UserRole = email.startsWith('manager') ? 'Manager' : email.startsWith('employee') ? 'Employee' : email.startsWith('auditor') ? 'Auditor' : 'Admin';
    return { token: 'demo-token', email, role };
  }
  if (method === 'post' && ['/Auth/forgot-password', '/Auth/reset-password', '/Auth/change-password'].includes(path)) return { message: 'OK' };

  // ── Notifications ──
  if (method === 'get' && path === '/Notification/unread-count') return { unreadCount: s.notifications.filter(n => !n.isRead).length, count: s.notifications.filter(n => !n.isRead).length };
  if (method === 'get' && path === '/Notification') return q.get('page') ? page(s.notifications, q, 'pageSize') : s.notifications;
  if (method === 'put' && path === '/Notification/read-all') { s.notifications.forEach(n => { n.isRead = true; }); return {}; }
  if (method === 'post' && (r = m(/^\/Notification\/(\d+)\/read$/))) { const n = s.notifications.find(x => x.notificationId === +r![1]); if (n) n.isRead = true; return {}; }

  // ── Reports ──
  if (method === 'get' && path === '/Report/analytics') {
    const c = (st: string) => s.tasks.filter(t => t.status === st).length;
    const done = s.tasks.filter(t => t.completedAt);
    const avgHours = done.length ? Math.round(done.reduce((sum, t) => sum + (Date.parse(t.completedAt!) - Date.parse(t.createdAt)) / 3600_000, 0) / done.length * 10) / 10 : 0;
    const perUser = s.users.filter(u => !u.isDeleted && u.roleId !== 4).map(u => {
      const mine = s.tasks.filter(t => t.assignedTo === u.userId);
      return { userName: u.name, pendingCount: mine.filter(t => t.status === 'Pending').length, inProgressCount: mine.filter(t => t.status === 'In Progress').length, completedCount: s.tasks.filter(t => t.status === 'Completed' && s.history[t.taskId]?.some(h => h.actedByName === u.name)).length };
    });
    return {
      totalUsers: s.users.filter(u => !u.isDeleted).length, totalWorkflows: s.workflows.length, activeWorkflows: s.workflows.filter(w => w.status === 'Active').length,
      pendingTasks: c('Pending'), inProgressTasks: c('In Progress'), completedTasks: c('Completed'),
      overdueTasks: s.tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'Completed' && t.status !== 'Cancelled').length,
      avgCompletionTimeHours: avgHours, tasksPerUser: s.tasks.length ? perUser : [],
    };
  }
  if (method === 'get' && path === '/Report/dashboard') {
    const { filters, scope } = dashboardArgs(q, s);
    return computeDashboard(s.tasks, s.users, s.workflows, CATEGORIES, filters, scope);
  }
  if (method === 'get' && path === '/Report/dashboard/export') {
    const { filters, scope } = dashboardArgs(q, s);
    return new Blob([tasksToCsv(s.tasks, filters, scope)], { type: 'text/csv' });
  }
  // Same gate as the real API: audit data is for Admin and Auditor only
  if (method === 'get' && path.startsWith('/Report/audit-logs') && !['Admin', 'Auditor'].includes(currentRole())) return fail(403, 'Forbidden');
  if (method === 'get' && path === '/Report/audit-logs') return page(s.audit.filter(contains(q, 'userName', 'action', 'entityName')), q, 'pageSize');
  if (method === 'get' && path === '/Report/audit-logs/export') return new Blob([csv(s.audit as unknown as Record<string, unknown>[])], { type: 'text/csv' });

  // ── Users ──
  if (method === 'get' && path === '/Admin/users') return page(s.users.filter(contains(q, 'name', 'email')), q);
  if (method === 'get' && path === '/Admin/users/export') return new Blob([csv(s.users.map(u => ({ name: u.name, email: u.email, role: u.role?.roleName, deleted: u.isDeleted })))], { type: 'text/csv' });
  if (method === 'post' && path === '/Admin/users') {
    const roleId = Number(body.roleId) || 3;
    s.users.unshift({ userId: ++s.nextId, name: body.name, email: body.email, roleId, role: ROLES.find(x => x.roleId === roleId), isDeleted: false, createdAt: new Date().toISOString() });
    return { message: 'User registered.' };
  }
  if (method === 'delete' && (r = m(/^\/Admin\/users\/(\d+)$/))) { const u = s.users.find(x => x.userId === +r![1]); if (u) u.isDeleted = true; return {}; }
  if (method === 'put' && (r = m(/^\/Admin\/users\/(\d+)\/restore$/))) { const u = s.users.find(x => x.userId === +r![1]); if (u) u.isDeleted = false; return {}; }

  // ── Workflows ──
  if (method === 'get' && path === '/Workflow') return page(s.workflows.map(w => ({ workflowId: w.workflowId, title: w.title, status: w.status, stepCount: w.steps.length })), q);
  if (method === 'get' && path === '/Workflow/roles') return ROLES;
  if (method === 'get' && (r = m(/^\/Workflow\/(\d+)$/))) { const w = s.workflows.find(x => x.workflowId === +r![1]); return w ?? fail(404, 'Workflow not found.'); }
  const toSteps = (steps: Record<string, any>[]) => steps.map((st, i) => ({ stepId: ++s.nextId, stepOrder: st.stepOrder ?? i + 1, stepName: st.stepName, description: st.description, approverRoleName: ROLES.find(x => x.roleId === st.approverRoleId)?.roleName ?? 'Manager', onRejectAction: st.onRejectAction ?? 'Cancel', escalationHours: st.escalationHours })); // eslint-disable-line @typescript-eslint/no-explicit-any
  if (method === 'post' && path === '/Workflow') { s.workflows.unshift({ workflowId: ++s.nextId, title: body.title, description: body.description, status: 'Draft', createdByName: meName(), createdAt: new Date().toISOString(), steps: toSteps(body.steps || []) }); return { message: 'Created' }; }
  if (method === 'put' && (r = m(/^\/Workflow\/(\d+)$/))) { const w = s.workflows.find(x => x.workflowId === +r![1]); if (w) { w.title = body.title; w.description = body.description; w.status = body.status; w.steps = toSteps(body.steps || []); } return {}; }
  if (method === 'post' && (r = m(/^\/Workflow\/(\d+)\/clone$/))) { const w = s.workflows.find(x => x.workflowId === +r![1]); if (w) s.workflows.unshift({ ...w, workflowId: ++s.nextId, title: `${w.title} (copy)`, status: 'Draft' }); return {}; }
  if (method === 'delete' && (r = m(/^\/Workflow\/(\d+)$/))) { s.workflows = s.workflows.filter(x => x.workflowId !== +r![1]); return {}; }

  // ── Tasks ──
  if (method === 'get' && path === '/Task/categories') return CATEGORIES;
  if (method === 'get' && path === '/Task/assignable-users') return s.users.filter(u => !u.isDeleted).map(u => ({ userId: u.userId, name: u.name, email: u.email, roleName: u.role?.roleName }));
  if (method === 'post' && path === '/Task/formalize-description') return { formalizedText: `Please complete the following request in line with company policy: ${String(body.rawText || '').trim()}` };
  // The API sends the approval-step count; the real server sorts my-tasks by due date (no date last), then newest first.
  const withSteps = (t: TaskItem): TaskItem => ({ ...t, totalSteps: s.workflows.find(w => w.workflowId === t.workflowId)?.steps.length });
  const dueRank = (t: TaskItem) => (t.dueDate ? new Date(t.dueDate).getTime() : Infinity);
  if (method === 'get' && path === '/Task/my-tasks') {
    const mine = s.tasks.filter(t => t.assignedTo === meId() && (t.status === 'Pending' || t.status === 'In Progress'));
    mine.sort((a, b) => (dueRank(a) === dueRank(b) ? Date.parse(b.createdAt) - Date.parse(a.createdAt) : dueRank(a) < dueRank(b) ? -1 : 1));
    return page(mine.map(withSteps), q);
  }
  if (method === 'get' && path === '/Task/my-activity') return page(s.tasks.filter(t => s.history[t.taskId]?.some(h => h.actedByName === meName()) && t.assignedTo !== meId()).map(withSteps), q);
  if (method === 'get' && path === '/Task/all') {
    if (q.has('page')) {
      try { return queryAllTasks(s.tasks, s.workflows, q); }
      catch (e) { if (e instanceof AllTasksQueryError) return fail(400, e.message); throw e; }
    }
    // Legacy shape (no `page`): a plain array, "Unassigned" when nobody holds the task.
    const st = q.get('status'), pr = q.get('priority'), cat = q.get('categoryId');
    return s.tasks.filter(t => (!st || t.status === st) && (!pr || t.priority === pr) && (!cat || t.categoryId === +cat)).map(t => ({ ...withSteps(t), assigneeName: t.assigneeName ?? 'Unassigned' }));
  }
  if (method === 'get' && (r = m(/^\/Task\/(\d+)\/history$/))) return s.history[+r[1]] ?? [];
  if (method === 'post' && path === '/Task/assign') {
    const wf = s.workflows.find(w => w.workflowId === +body.workflowId);
    const who = s.users.find(u => u.userId === +body.assignedTo);
    const cat = CATEGORIES.find(c => c.categoryId === +body.categoryId);
    const t: TaskItem = { taskId: ++s.nextId, title: body.title, description: body.description, workflowId: +body.workflowId, workflowTitle: wf?.title, assignedTo: who?.userId, assigneeName: who?.name, status: 'In Progress', priority: body.priority || 'Medium', currentStepOrder: 0, dueDate: body.dueDate, createdAt: new Date().toISOString(), categoryId: cat?.categoryId, categoryName: cat?.name, categoryColor: cat?.colorHex };
    s.tasks.unshift(t); s.history[t.taskId] = []; return { message: 'Task assigned successfully', taskId: t.taskId };
  }
  if (method === 'post' && (r = m(/^\/Task\/(\d+)\/approve$/))) {
    const t = s.tasks.find(x => x.taskId === +r![1]); if (!t) return fail(404, 'Task not found.');
    const wf = s.workflows.find(w => w.workflowId === t.workflowId);
    (s.history[t.taskId] ||= []).push({ stepOrder: t.currentStepOrder, actedByName: meName(), action: t.currentStepOrder === 0 ? 'Completed' : 'Approved', actedAt: new Date().toISOString() });
    if (wf && t.currentStepOrder < wf.steps.length) { t.currentStepOrder += 1; t.status = 'In Progress'; t.assignedTo = ME_BY_ROLE.Manager; t.assigneeName = 'Bob Jones'; }
    else { t.status = 'Completed'; t.assignedTo = undefined; t.assigneeName = undefined; t.completedAt = new Date().toISOString(); }
    return { message: `Task updated to: ${t.status}`, status: t.status };
  }
  if (method === 'post' && (r = m(/^\/Task\/(\d+)\/reject$/))) {
    const t = s.tasks.find(x => x.taskId === +r![1]); if (!t) return fail(404, 'Task not found.');
    (s.history[t.taskId] ||= []).push({ stepOrder: t.currentStepOrder, actedByName: meName(), action: 'Rejected', comment: body.comment, actedAt: new Date().toISOString() });
    t.status = 'Rejected'; t.rejectedReason = body.reason; t.assignedTo = undefined; t.assigneeName = undefined;
    return { message: 'Task rejected.', status: t.status };
  }

  return fail(404, `Demo mode: ${method.toUpperCase()} ${path} is not mocked.`);
}

export async function demoAdapter(config: InternalAxiosRequestConfig): Promise<AxiosResponse> {
  await sleep(120);
  const url = new URL(config.url || '/', 'http://demo.local');
  // axios keeps `params` separate from the URL; a real server would see them as the query string
  for (const [key, value] of Object.entries((config.params ?? {}) as Record<string, unknown>)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  let body: Record<string, any> = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
  if (typeof config.data === 'string') { try { body = JSON.parse(config.data); } catch { /* not JSON */ } }
  else if (config.data && typeof config.data === 'object') body = config.data as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const data = await handle((config.method || 'get').toLowerCase(), url.pathname.replace(/\/$/, ''), url.searchParams, body);
  return { data, status: 200, statusText: 'OK', headers: {}, config, request: {} };
}
