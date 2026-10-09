// Demo-only fixtures and in-memory store. Loaded only when __DEMO__ is true.
import type { TaskItem, TaskCategory, TaskStepHistory, TaskStatus, TaskPriority } from '../models/Task';
import type { WorkflowDetail, WorkflowStep } from '../models/Workflow';
import type { User, UserRole } from '../models/User';
import type { Notification } from '../models/Notification';

export interface AuditRow { userName: string; action: string; entityName: string; timestamp: string }

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const ahead = (ms: number) => new Date(Date.now() + ms).toISOString();

export const ROLES: { roleId: number; roleName: UserRole }[] = [
  { roleId: 1, roleName: 'Admin' },
  { roleId: 2, roleName: 'Manager' },
  { roleId: 3, roleName: 'Employee' },
  { roleId: 4, roleName: 'Auditor' },
];

const roleOf = (id: number) => ROLES.find(r => r.roleId === id)!;

const userSeed: [number, string, string, number, boolean][] = [
  [1, 'Alice Smith', 'admin@swfx.demo', 1, false],
  [2, 'Bob Jones', 'manager@swfx.demo', 2, false],
  [3, 'Carol Lee', 'carol.lee@swfx.demo', 2, false],
  [4, 'Dan Patel', 'employee@swfx.demo', 3, false],
  [5, 'Eve Torres', 'eve.torres@swfx.demo', 3, false],
  [6, 'Frank Wu', 'auditor@swfx.demo', 4, false],
  [7, 'Grace Kim', 'grace.kim@swfx.demo', 3, true],
  [8, 'Hiro Tanaka', 'hiro.tanaka@swfx.demo', 3, false],
];

/** The signed-in demo user for each role. */
export const ME_BY_ROLE: Record<UserRole, number> = { Admin: 1, Manager: 2, Employee: 4, Auditor: 6 };

export const CATEGORIES: TaskCategory[] = [
  { categoryId: 1, name: 'Finance', colorHex: '#0f62fe' },
  { categoryId: 2, name: 'HR', colorHex: '#8a3ffc' },
  { categoryId: 3, name: 'Engineering', colorHex: '#198038' },
  { categoryId: 4, name: 'Legal', colorHex: '#b28600' },
];

const step = (id: number, order: number, name: string, role: UserRole, onReject: 'GoBack' | 'Cancel', desc?: string, esc?: number): WorkflowStep => ({
  stepId: id, stepOrder: order, stepName: name, description: desc, approverRoleName: role, onRejectAction: onReject, escalationHours: esc,
});

const workflowSeed = (): WorkflowDetail[] => [
  { workflowId: 1, title: 'Expense Approval', description: 'Review and approve employee expense claims.', status: 'Active', createdByName: 'Alice Smith', createdAt: ago(40 * DAY),
    steps: [step(1, 1, 'Manager review', 'Manager', 'GoBack', 'Check receipts and policy limits', 24), step(2, 2, 'Finance sign-off', 'Admin', 'Cancel', 'Final approval and payout', 48)] },
  { workflowId: 2, title: 'Leave Request', description: 'Time-off requests approved by a manager.', status: 'Active', createdByName: 'Bob Jones', createdAt: ago(32 * DAY),
    steps: [step(3, 1, 'Manager approval', 'Manager', 'Cancel', 'Confirm team coverage', 24)] },
  { workflowId: 3, title: 'Vendor Onboarding', description: 'Vet and approve new suppliers before the first purchase order.', status: 'Draft', createdByName: 'Alice Smith', createdAt: ago(9 * DAY),
    steps: [step(4, 1, 'Compliance check', 'Auditor', 'GoBack'), step(5, 2, 'Manager approval', 'Manager', 'GoBack'), step(6, 3, 'Admin activation', 'Admin', 'Cancel')] },
  { workflowId: 4, title: 'Contract Review', description: 'Legal review of customer contracts.', status: 'Inactive', createdByName: 'Carol Lee', createdAt: ago(75 * DAY),
    steps: [step(7, 1, 'Legal review', 'Manager', 'GoBack', undefined, 72), step(8, 2, 'Executive sign-off', 'Admin', 'Cancel')] },
];

const TITLES = [
  'Q3 travel expense claim', 'Annual leave: 5 days', 'Onboard Northwind Traders', 'Review MSA with Contoso', 'Conference registration',
  'Laptop replacement request', 'Sick leave certificate', 'Software licence renewal', 'Client dinner reimbursement', 'NDA for Fabrikam',
  'Parental leave plan', 'Cloud spend exceptions', 'Offsite venue deposit', 'Security audit evidence', 'Contractor invoice 1042',
];

function buildTasks(workflows: WorkflowDetail[]): TaskItem[] {
  const assignees = [4, 5, 8, 2, 3, 4, 1, 4, 5, 2];
  const statuses: TaskStatus[] = ['In Progress', 'Pending', 'Completed', 'In Progress', 'Rejected', 'In Progress', 'Cancelled', 'Pending', 'Completed', 'In Progress'];
  const priorities: TaskPriority[] = ['High', 'Medium', 'Low', 'Medium', 'High', 'Low', 'Medium'];
  return Array.from({ length: 78 }, (_, i) => {
    const n = i + 1;
    const wf = workflows[i % workflows.length];
    const status = statuses[i % statuses.length];
    const cat = CATEGORIES[i % CATEGORIES.length];
    const assignee = userSeed.find(u => u[0] === assignees[i % assignees.length])!;
    const done = status === 'Completed' || status === 'Cancelled' || status === 'Rejected';
    const due = i % 7 === 0 ? ago((1 + (i % 5)) * DAY) : ahead(((i % 9) + 1) * DAY);
    return {
      taskId: n,
      title: `${TITLES[i % TITLES.length]} #${n}`,
      description: `Request ${n} submitted through the ${wf.title} workflow.`,
      workflowId: wf.workflowId,
      workflowTitle: wf.title,
      assignedTo: done ? undefined : assignee[0],
      assigneeName: done ? undefined : assignee[1],
      status,
      priority: priorities[i % priorities.length],
      currentStepOrder: status === 'Pending' ? 0 : Math.min(1 + (i % 2), wf.steps.length),
      rejectedReason: status === 'Rejected' ? 'Missing supporting documents.' : undefined,
      dueDate: due,
      completedAt: status === 'Completed' ? ago((i % 12) * DAY) : undefined,
      createdAt: ago((3 + (i % 40)) * DAY),
      categoryId: cat.categoryId,
      categoryName: cat.name,
      categoryColor: cat.colorHex,
    };
  });
}

function historyFor(t: TaskItem): TaskStepHistory[] {
  const rows: TaskStepHistory[] = [];
  if (t.status === 'Pending') return rows;
  rows.push({ stepOrder: 0, actedByName: 'Dan Patel', action: 'Completed', comment: 'Work finished, ready for review.', actedAt: ago(5 * DAY) });
  if (t.currentStepOrder >= 2 || t.status === 'Completed') rows.push({ stepOrder: 1, actedByName: 'Bob Jones', action: 'Approved', comment: 'Looks good.', actedAt: ago(3 * DAY) });
  if (t.status === 'Completed') rows.push({ stepOrder: 2, actedByName: 'Alice Smith', action: 'Approved', actedAt: ago(1 * DAY) });
  if (t.status === 'Rejected') rows.push({ stepOrder: 1, actedByName: 'Bob Jones', action: 'Rejected', comment: t.rejectedReason, actedAt: ago(2 * DAY) });
  return rows;
}

function auditSeed(): AuditRow[] {
  const people = ['Alice Smith', 'Bob Jones', 'Carol Lee', 'Dan Patel', 'Eve Torres'];
  const actions: [string, string][] = [
    ["User 'admin@swfx.demo' logged in via Google.", 'Users'],
    ["Created workflow 'Expense Approval'.", 'Workflows'],
    ['Approved Task ID=12 at Step 1. New Status: In Progress.', 'Tasks'],
    ["Assigned task 'Q3 travel expense claim' to User ID=4.", 'Tasks'],
    ["Deleted user 'grace.kim@swfx.demo'.", 'Users'],
    ['Rejected Task ID=31 at Step 1. Reason: Missing documents.', 'Tasks'],
    ["Registered user 'hiro.tanaka@swfx.demo'.", 'Users'],
    ["Updated workflow 'Leave Request'.", 'Workflows'],
  ];
  return Array.from({ length: 64 }, (_, i) => ({
    userName: people[i % people.length],
    action: actions[i % actions.length][0],
    entityName: actions[i % actions.length][1],
    timestamp: ago(i * 5 * HOUR + 20 * 60_000),
  }));
}

const notificationSeed = (): Notification[] => [
  { notificationId: 1, message: "Task 'Q3 travel expense claim #1' requires your approval at step 1: Manager review.", isRead: false, createdAt: ago(20 * 60_000) },
  { notificationId: 2, message: "Task 'Annual leave: 5 days #2' was approved and moved to the next step.", isRead: false, createdAt: ago(3 * HOUR) },
  { notificationId: 3, message: "Task 'NDA for Fabrikam #10' was rejected and has been sent back to you for revision.", isRead: false, createdAt: ago(8 * HOUR) },
  { notificationId: 4, message: "New workflow 'Vendor Onboarding' was created.", isRead: true, createdAt: ago(2 * DAY) },
  { notificationId: 5, message: "Task 'Software licence renewal #8' is due tomorrow.", isRead: true, createdAt: ago(3 * DAY) },
];

export interface DemoStore {
  users: User[];
  workflows: WorkflowDetail[];
  tasks: TaskItem[];
  audit: AuditRow[];
  notifications: Notification[];
  history: Record<number, TaskStepHistory[]>;
  nextId: number;
}

export function buildStore(empty: boolean): DemoStore {
  const users: User[] = userSeed.map(([userId, name, email, roleId, isDeleted]) => ({
    userId, name, email, roleId, role: roleOf(roleId), isDeleted, createdAt: ago(userId * 6 * DAY),
  }));
  const workflows = empty ? [] : workflowSeed();
  const tasks = empty ? [] : buildTasks(workflowSeed());
  const history: Record<number, TaskStepHistory[]> = {};
  tasks.forEach(t => { history[t.taskId] = historyFor(t); });
  return {
    users,
    workflows,
    tasks,
    audit: empty ? [] : auditSeed(),
    notifications: empty ? [] : notificationSeed(),
    history,
    nextId: 1000,
  };
}
