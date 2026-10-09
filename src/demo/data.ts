// Demo-only fixtures and in-memory store. Loaded only when __DEMO__ is true.
import type { TaskItem, TaskCategory, TaskStepHistory, TaskStatus, TaskPriority } from '../models/Task';
import type { WorkflowDetail, WorkflowStep } from '../models/Workflow';
import type { User, UserRole } from '../models/User';
import type { Notification } from '../models/Notification';

export interface AuditRow { userName: string; action: string; entityName: string; timestamp: string }

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

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
  stepId: id, stepOrder: order, stepName: name, description: desc, approverRoleName: role, approverRoleId: ROLES.find(r => r.roleName === role)!.roleId, onRejectAction: onReject, escalationHours: esc,
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
  // The workflows below have no tasks yet (see buildStore), so they can be edited and deactivated in the demo.
  { workflowId: 5, title: 'Hardware Request', description: 'Laptops and peripherals for new joiners.', status: 'Active', createdByName: 'Bob Jones', createdAt: ago(14 * DAY),
    steps: [step(9, 1, 'Manager review', 'Manager', 'GoBack'), step(10, 2, 'IT approval', 'Admin', 'Cancel', 'Check stock and budget code', 48)] },
  { workflowId: 6, title: 'Purchase Order Approval', description: 'Draft. Waiting for Finance to confirm the approval limits.', status: 'Draft', createdByName: 'Carol Lee', createdAt: ago(3 * DAY),
    steps: [step(11, 1, 'Budget owner check', 'Manager', 'GoBack', 'Confirm the budget code has funds'), step(12, 2, 'Finance approval', 'Admin', 'Cancel')] },
  { workflowId: 7, title: 'Travel Policy', description: 'Replaced by Expense Approval.', status: 'Inactive', createdByName: 'Alice Smith', createdAt: ago(120 * DAY),
    steps: [step(13, 1, 'Manager approval', 'Manager', 'Cancel'), step(14, 2, 'Audit check', 'Auditor', 'Cancel')] },
];

const TITLES = [
  'Q3 travel expense claim', 'Annual leave: 5 days', 'Onboard Northwind Traders', 'Review MSA with Contoso', 'Conference registration',
  'Laptop replacement request', 'Sick leave certificate', 'Software licence renewal', 'Client dinner reimbursement', 'NDA for Fabrikam',
  'Parental leave plan', 'Cloud spend exceptions', 'Offsite venue deposit', 'Security audit evidence', 'Contractor invoice 1042',
];

/** Small seeded LCG so the demo data is identical on every load. */
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

const userName = (id: number) => userSeed.find(u => u[0] === id)![1];

interface Draft {
  status: TaskStatus; createdMs: number; spanDays: number; completedMs?: number; wf: WorkflowDetail; cat: TaskCategory;
  priority: TaskPriority; owner: number; step: number; approvers: number[];
}

function buildTasks(workflows: WorkflowDetail[]): { tasks: TaskItem[]; history: Record<number, TaskStepHistory[]> } {
  const rnd = lcg(20240607);
  const now = Date.now();
  const today = Math.floor(now / DAY) * DAY;
  const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];
  const owners = [4, 4, 4, 5, 5, 8, 8];
  const drafts: Draft[] = [];

  for (let i = 0; i < 240; i++) {
    const roll = rnd();
    let status: TaskStatus = roll < 0.55 ? 'Completed' : roll < 0.75 ? 'In Progress' : roll < 0.82 ? 'Pending' : roll < 0.92 ? 'Rejected' : 'Cancelled';
    const open = status === 'In Progress' || status === 'Pending';

    // Created date: weekdays are favoured; open tasks lean recent.
    let dayOffset = 0;
    for (let tries = 0; tries < 20; tries++) {
      dayOffset = Math.floor(open ? rnd() ** 1.4 * 90 : rnd() * 150);
      const dow = new Date(today - dayOffset * DAY).getUTCDay();
      if ((dow !== 0 && dow !== 6) || rnd() < 0.35) break;
    }
    const createdMs = Math.min(today - dayOffset * DAY + (8 + rnd() * 10) * HOUR, now - 60_000);

    // Work older than four weeks is rarely still open: keeps the overdue figures believable.
    let slow = false;
    if ((status === 'In Progress' || status === 'Pending') && (now - createdMs) / DAY > 28) {
      status = rnd() < 0.85 ? 'Completed' : 'Cancelled';
      slow = true; // finished long after creation, so it was still open in earlier periods
    }

    const onTime = slow ? rnd() < 0.5 : rnd() < 0.7;
    const spanDays = onTime ? 3 + Math.floor(rnd() * 12) : 3 + Math.floor(rnd() * 4);
    let completedMs: number | undefined;
    if (status === 'Completed') {
      const dur = onTime ? 0.5 + rnd() * (Math.min(9, spanDays) - 0.5) : spanDays + 0.2 + rnd() * (9 - spanDays - 0.2);
      completedMs = slow ? Math.min(createdMs + (4 + rnd() * 22) * DAY, now - 6 * HOUR) : createdMs + dur * DAY;
      if (completedMs > now) { status = 'In Progress'; completedMs = undefined; }
    }

    const wf = pick(workflows);
    const len = wf.steps.length;
    const step = status === 'Pending' ? 0
      : status === 'Completed' ? len
      : status === 'Rejected' ? 1 + Math.floor(rnd() * len)
      : Math.floor(rnd() * (len + 1));
    const approvers = [0, ...wf.steps.map(st => (st.approverRoleName === 'Admin' ? 1 : st.approverRoleName === 'Auditor' ? 6 : rnd() < 0.5 ? 2 : 3))];
    drafts.push({ status, createdMs, spanDays, completedMs, wf, cat: pick(CATEGORIES), priority: pick<TaskPriority>(['High', 'Medium', 'Medium', 'Low']), owner: pick(owners), step, approvers });
  }

  drafts.sort((a, b) => b.createdMs - a.createdMs);
  const history: Record<number, TaskStepHistory[]> = {};
  const tasks = drafts.map((d, i): TaskItem => {
    const n = i + 1;
    const len = d.wf.steps.length;
    const awaiting = d.status === 'In Progress' || d.status === 'Pending';
    const assignee = awaiting ? (d.step === 0 ? d.owner : d.approvers[d.step]) : d.owner;
    const rejectedReason = d.status === 'Rejected' ? 'Missing supporting documents.' : undefined;

    const rows: TaskStepHistory[] = [];
    const end = d.completedMs ?? Math.min(now, d.createdMs + 3 * DAY);
    const at = (j: number) => new Date(d.createdMs + ((j + 1) / (len + 2)) * (end - d.createdMs)).toISOString();
    const done = d.status === 'Completed' ? len : d.step - 1;
    for (let j = 0; j <= done; j++) {
      rows.push(j === 0
        ? { stepOrder: 0, actedByName: userName(d.owner), action: 'Completed', comment: 'Work finished, ready for review.', actedAt: at(0) }
        : { stepOrder: j, actedByName: userName(d.approvers[j]), action: 'Approved', comment: j === 1 ? 'Looks good.' : undefined, actedAt: at(j) });
    }
    if (d.status === 'Rejected') rows.push({ stepOrder: d.step, actedByName: userName(d.approvers[d.step]), action: 'Rejected', comment: rejectedReason, actedAt: at(d.step) });
    history[n] = rows;

    return {
      taskId: n,
      title: `${TITLES[i % TITLES.length]} #${n}`,
      description: `Request ${n} submitted through the ${d.wf.title} workflow.`,
      workflowId: d.wf.workflowId,
      workflowTitle: d.wf.title,
      assignedTo: assignee,
      assigneeName: userName(assignee),
      status: d.status,
      priority: d.priority,
      currentStepOrder: d.step,
      rejectedReason,
      dueDate: new Date(d.createdMs + d.spanDays * DAY).toISOString(),
      completedAt: d.completedMs ? new Date(d.completedMs).toISOString() : undefined,
      createdAt: new Date(d.createdMs).toISOString(),
      categoryId: d.cat.categoryId,
      categoryName: d.cat.name,
      categoryColor: d.cat.colorHex,
    };
  });
  return { tasks, history };
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
  const { tasks, history } = empty ? { tasks: [] as TaskItem[], history: {} as Record<number, TaskStepHistory[]> } : buildTasks(workflowSeed().slice(0, 4));
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
