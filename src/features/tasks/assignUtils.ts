import * as z from 'zod';
import type { TaskPriority, WorkflowStep } from '../../models';

export const TITLE_MAX = 200;
export const DESCRIPTION_MAX = 2000;

export interface AssignForm {
  title: string;
  description: string;
  priority: TaskPriority;
  categoryId: number | null;
  /** yyyy-mm-dd in the browser's calendar, or '' for none. */
  dueDate: string;
  workflowId: number | null;
  assignedTo: number | null;
}

export const EMPTY_FORM: AssignForm = {
  title: '', description: '', priority: 'Medium', categoryId: null, dueDate: '', workflowId: null, assignedTo: null,
};

export type FieldKey = 'title' | 'description' | 'dueDate' | 'workflowId' | 'assignedTo';
export type FormErrors = Partial<Record<FieldKey, string>>;

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date as yyyy-mm-dd, `offsetDays` from `now`. */
export function isoDate(offsetDays = 0, now: Date = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const DUE_CHIPS: { label: string; days: number }[] = [
  { label: 'Tomorrow', days: 1 },
  { label: 'In 3 days', days: 3 },
  { label: 'Next week', days: 7 },
];

export function formatDue(iso: string): string {
  if (!iso) return 'No due date';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

const step1Schema = (today: string) => z.object({
  title: z.string().trim().min(1, 'Give the task a title.').max(TITLE_MAX, `Keep the title to ${TITLE_MAX} characters or fewer.`),
  description: z.string().max(DESCRIPTION_MAX, `Keep the description to ${DESCRIPTION_MAX} characters or fewer.`),
  dueDate: z.string().refine((v) => !v || v >= today, 'The due date cannot be in the past.'),
});

const step2Schema = z.object({
  workflowId: z.number({ error: 'Choose a workflow.' }),
  assignedTo: z.number({ error: 'Choose who does the work first.' }),
});

function collect(result: { success: boolean; error?: z.ZodError }): FormErrors {
  const errors: FormErrors = {};
  if (result.success || !result.error) return errors;
  for (const issue of result.error.issues) {
    const key = issue.path[0] as FieldKey;
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

export function validateStep(step: 1 | 2, form: AssignForm, today: string = isoDate()): FormErrors {
  return step === 1
    ? collect(step1Schema(today).safeParse(form))
    : collect(step2Schema.safeParse({ workflowId: form.workflowId ?? undefined, assignedTo: form.assignedTo ?? undefined }));
}

/** Steps in running order. */
export const sortSteps = (steps: WorkflowStep[]): WorkflowStep[] => [...steps].sort((a, b) => a.stepOrder - b.stepOrder);

export const errorMessage = (err: unknown, fallback: string): string =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;
