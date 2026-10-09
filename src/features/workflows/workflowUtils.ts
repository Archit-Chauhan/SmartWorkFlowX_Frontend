import type {
  OnRejectAction, Workflow, WorkflowCreateRequest, WorkflowDetail, WorkflowStatus,
  WorkflowStepCreateDto, WorkflowUpdateRequest,
} from '../../models';

// Limits mirror the server rules (docs/WORKFLOWS_SPEC.md section 3).
export const MAX_TITLE = 150;
export const MAX_DESCRIPTION = 1000;
export const MAX_STEPS = 20;
export const MAX_STEP_NAME = 100;
export const MAX_INSTRUCTIONS = 500;
export const MIN_ESCALATION = 1;
export const MAX_ESCALATION = 720;
export const LIST_LIMIT = 200;

export type StatusFilter = 'all' | WorkflowStatus;
export const FILTERS: StatusFilter[] = ['all', 'Active', 'Draft', 'Inactive'];

export const STATUS_CHIP: Record<WorkflowStatus, string> = {
  Active: 'chip-completed',
  Draft: 'chip-warning',
  Inactive: 'chip-neutral',
};

export const activeTasks = (w: Pick<Workflow, 'activeTaskCount'>) => w.activeTaskCount ?? 0;
export const isLocked = (w: Pick<Workflow, 'activeTaskCount'>) => activeTasks(w) > 0;
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const lockChipText = (n: number) => `In use by ${plural(n, 'task')}`;
export const lockedMessage = (w: Pick<Workflow, 'title' | 'activeTaskCount'>, verb: 'modify' | 'deactivate') => {
  const n = activeTasks(w);
  return `Cannot ${verb} “${w.title}” while ${n} ${n === 1 ? 'task is' : 'tasks are'} in progress. Finish or cancel ${n === 1 ? 'it' : 'them'} first.`;
};

export function formatDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function statusCounts(items: Workflow[]): Record<StatusFilter, number> {
  return {
    all: items.length,
    Active: items.filter((w) => w.status === 'Active').length,
    Draft: items.filter((w) => w.status === 'Draft').length,
    Inactive: items.filter((w) => w.status === 'Inactive').length,
  };
}

export function filterWorkflows(items: Workflow[], filter: StatusFilter, query: string): Workflow[] {
  const q = query.trim().toLowerCase();
  return items.filter((w) =>
    (filter === 'all' || w.status === filter)
    && (!q || `${w.title} ${w.description ?? ''}`.toLowerCase().includes(q)));
}

export function errorMessage(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  return typeof message === 'string' && message ? message : fallback;
}

// ── Builder draft ──────────────────────────────────────────────────────────

export interface StepDraft {
  /** Stable React key: survives reordering so focus and typing are not lost. */
  key: number;
  name: string;
  roleId: number | null;
  instructions: string;
  onReject: OnRejectAction;
  /** Kept as text so an empty box means "no escalation". */
  escalation: string;
}

export interface WorkflowDraft {
  title: string;
  description: string;
  steps: StepDraft[];
}

let keySeed = 0;
export const nextKey = () => ++keySeed;

export const newStep = (roleId: number | null): StepDraft =>
  ({ key: nextKey(), name: '', roleId, instructions: '', onReject: 'Cancel', escalation: '' });

export const emptyDraft = (roleId: number | null): WorkflowDraft =>
  ({ title: '', description: '', steps: [newStep(roleId)] });

/** Prefills the editor from the server copy. The role id comes straight from `approverRoleId`. */
export const draftFromDetail = (d: WorkflowDetail): WorkflowDraft => ({
  title: d.title,
  description: d.description ?? '',
  steps: [...d.steps].sort((a, b) => a.stepOrder - b.stepOrder).map((s) => ({
    key: nextKey(),
    name: s.stepName,
    roleId: s.approverRoleId,
    instructions: s.description ?? '',
    onReject: s.onRejectAction,
    escalation: s.escalationHours ? String(s.escalationHours) : '',
  })),
});

// ── Validation (same rules and messages as the server) ─────────────────────

export type FormErrors = Record<string, string>;

export const titleKey = 'title';
export const descriptionKey = 'description';
export const stepsKey = 'steps';
export const nameKey = (i: number) => `name${i}`;
export const roleKey = (i: number) => `role${i}`;
export const instructionsKey = (i: number) => `ins${i}`;
export const escalationKey = (i: number) => `esc${i}`;

const escalationValue = (text: string): number | undefined => {
  const t = text.trim();
  return t === '' ? undefined : Number(t);
};

/**
 * Checks a draft. `others` are the other workflows' titles (the loaded list, minus the one being edited).
 * Keys are inserted in page order, so the first key is the first invalid field.
 */
export function validateDraft(draft: WorkflowDraft, others: string[]): FormErrors {
  const errors: FormErrors = {};
  const title = draft.title.trim();
  if (!title) errors[titleKey] = 'Workflow title is required.';
  else if (title.length > MAX_TITLE) errors[titleKey] = `Workflow title must be ${MAX_TITLE} characters or fewer.`;
  else if (others.some((t) => t.trim().toLowerCase() === title.toLowerCase())) errors[titleKey] = 'A workflow with this title already exists.';

  if (draft.description.trim().length > MAX_DESCRIPTION) errors[descriptionKey] = `Description must be ${MAX_DESCRIPTION} characters or fewer.`;

  if (draft.steps.length === 0) errors[stepsKey] = 'A workflow needs at least one step.';
  else if (draft.steps.length > MAX_STEPS) errors[stepsKey] = `A workflow can have at most ${MAX_STEPS} steps.`;

  draft.steps.forEach((s, i) => {
    const n = i + 1;
    const name = s.name.trim();
    if (!name) errors[nameKey(i)] = `Step ${n}: name is required.`;
    else if (name.length > MAX_STEP_NAME) errors[nameKey(i)] = `Step ${n}: name must be ${MAX_STEP_NAME} characters or fewer.`;
    if (s.roleId === null) errors[roleKey(i)] = `Step ${n}: the approver role was not found.`;
    if (s.instructions.trim().length > MAX_INSTRUCTIONS) errors[instructionsKey(i)] = `Step ${n}: instructions must be ${MAX_INSTRUCTIONS} characters or fewer.`;
    const hours = escalationValue(s.escalation);
    if (hours !== undefined && !(Number.isInteger(hours) && hours >= MIN_ESCALATION && hours <= MAX_ESCALATION)) {
      errors[escalationKey(i)] = `Step ${n}: escalation must be between ${MIN_ESCALATION} and ${MAX_ESCALATION} hours.`;
    }
  });
  return errors;
}

/** The DOM id of the field an error key belongs to (for focusing and aria-describedby). */
export const fieldId = (key: string) => `wf-${key}`;

export function stepsFor(draft: WorkflowDraft): WorkflowStepCreateDto[] {
  return draft.steps.map((s, i) => ({
    stepOrder: i + 1,
    approverRoleId: s.roleId as number,
    stepName: s.name.trim(),
    description: s.instructions.trim(),
    onRejectAction: s.onReject,
    escalationHours: escalationValue(s.escalation),
  }));
}

export const createRequest = (draft: WorkflowDraft, status: 'Draft' | 'Active'): WorkflowCreateRequest => ({
  title: draft.title.trim(), description: draft.description.trim(), status, steps: stepsFor(draft),
});

export const updateRequest = (draft: WorkflowDraft, status: WorkflowStatus): WorkflowUpdateRequest => ({
  title: draft.title.trim(), description: draft.description.trim(), status, steps: stepsFor(draft),
});
