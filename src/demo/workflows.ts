// Demo-only: the Workflow API rules (docs/WORKFLOWS_SPEC.md), applied to the in-memory store.
import type { TaskItem } from '../models/Task';
import type { WorkflowDetail } from '../models/Workflow';

/** Thrown for the cases the real API answers with 400/404. */
export class WorkflowRuleError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
const bad = (message: string) => new WorkflowRuleError(400, message);

/** Same definition as the server's HasActiveTasksAsync: tasks that are Pending or In Progress. */
export const activeTaskCount = (tasks: TaskItem[], workflowId: number) =>
  tasks.filter((t) => t.workflowId === workflowId && (t.status === 'Pending' || t.status === 'In Progress')).length;

export const listItem = (w: WorkflowDetail, tasks: TaskItem[]) => ({
  workflowId: w.workflowId,
  title: w.title,
  status: w.status,
  stepCount: w.steps.length,
  description: w.description ?? null,
  createdByName: w.createdByName,
  createdAt: w.createdAt,
  activeTaskCount: activeTaskCount(tasks, w.workflowId),
  steps: [...w.steps].sort((a, b) => a.stepOrder - b.stepOrder).map((s) => ({ stepOrder: s.stepOrder, stepName: s.stepName, approverRoleName: s.approverRoleName })),
});

interface Body { title?: unknown; description?: unknown; status?: unknown; steps?: unknown }
interface StepBody { stepName?: unknown; description?: unknown; approverRoleId?: unknown; onRejectAction?: unknown; escalationHours?: unknown }

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** Checks a create/update body in the server's order and returns the trimmed values. Throws the server's messages. */
export function validateWorkflowBody(body: Body, workflows: WorkflowDetail[], roleIds: number[], selfId: number | null) {
  const title = str(body.title);
  if (!title) throw bad('Workflow title is required.');
  if (title.length > 150) throw bad('Workflow title must be 150 characters or fewer.');
  if (workflows.some((w) => w.workflowId !== selfId && w.title.trim().toLowerCase() === title.toLowerCase())) throw bad('A workflow with this title already exists.');

  const description = str(body.description);
  if (description.length > 1000) throw bad('Description must be 1000 characters or fewer.');

  const steps = Array.isArray(body.steps) ? (body.steps as StepBody[]) : [];
  if (steps.length === 0) throw bad('A workflow needs at least one step.');
  if (steps.length > 20) throw bad('A workflow can have at most 20 steps.');

  steps.forEach((raw, i) => {
    const n = i + 1;
    const name = str(raw?.stepName);
    if (!name) throw bad(`Step ${n}: name is required.`);
    if (name.length > 100) throw bad(`Step ${n}: name must be 100 characters or fewer.`);
    if (str(raw.description).length > 500) throw bad(`Step ${n}: instructions must be 500 characters or fewer.`);
    if (!roleIds.includes(Number(raw.approverRoleId))) throw bad(`Step ${n}: the approver role was not found.`);
    if (raw.onRejectAction !== 'GoBack' && raw.onRejectAction !== 'Cancel') throw bad(`Step ${n}: reject action must be GoBack or Cancel.`);
    const hours = raw.escalationHours;
    if (hours !== undefined && hours !== null && !(Number.isInteger(hours) && (hours as number) >= 1 && (hours as number) <= 720)) {
      throw bad(`Step ${n}: escalation must be between 1 and 720 hours.`);
    }
  });
  return { title, description, steps: steps as StepBody[] };
}

export function validateUpdateStatus(status: unknown): 'Draft' | 'Active' | 'Inactive' {
  if (status !== 'Draft' && status !== 'Active' && status !== 'Inactive') throw bad('Status must be Draft, Active or Inactive.');
  return status;
}

export function resolveCreateStatus(status: unknown): 'Draft' | 'Active' {
  if (status === undefined || status === null || status === 'Draft') return 'Draft';
  if (status === 'Active') return 'Active';
  throw bad('Status must be Draft or Active when creating.');
}
