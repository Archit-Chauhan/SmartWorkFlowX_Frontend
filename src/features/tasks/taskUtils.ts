import type { TaskItem } from '../../models';

/** A task that still needs somebody to act on it. */
export const isActive = (t: TaskItem): boolean => t.status !== 'Completed' && t.status !== 'Cancelled';

export type DueTone = 'overdue' | 'soon' | 'normal' | 'none';

export interface DueInfo {
  /** "3 days overdue", "Due tomorrow", "No due date" */
  label: string;
  /** "Tue, 14 Oct" - empty when there is no due date */
  dateText: string;
  tone: DueTone;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function dueInfo(task: TaskItem, now: Date = new Date()): DueInfo {
  if (!task.dueDate) return { label: 'No due date', dateText: '', tone: 'none' };

  const due = new Date(task.dueDate);
  const dateText = due.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

  if (isActive(task) && due.getTime() < now.getTime()) {
    const days = Math.max(1, Math.ceil((now.getTime() - due.getTime()) / DAY_MS));
    return { label: days === 1 ? '1 day overdue' : `${days} days overdue`, dateText, tone: 'overdue' };
  }

  const days = Math.round((startOfDay(due).getTime() - startOfDay(now).getTime()) / DAY_MS);
  if (days <= 0) return { label: 'Due today', dateText, tone: 'soon' };
  if (days === 1) return { label: 'Due tomorrow', dateText, tone: 'soon' };
  return { label: `Due in ${days} days`, dateText, tone: days <= 2 ? 'soon' : 'normal' };
}

export type DueGroup = 'overdue' | 'week' | 'later' | 'none';

export const DUE_GROUP_LABEL: Record<DueGroup, string> = {
  overdue: 'Overdue',
  week: 'Due this week',
  later: 'Later',
  none: 'No due date',
};

export function dueGroup(task: TaskItem, now: Date = new Date()): DueGroup {
  if (!task.dueDate) return 'none';
  const info = dueInfo(task, now);
  if (info.tone === 'overdue') return 'overdue';
  const days = Math.round((startOfDay(new Date(task.dueDate)).getTime() - startOfDay(now).getTime()) / DAY_MS);
  return days <= 7 ? 'week' : 'later';
}

export interface TaskGroup {
  group: DueGroup;
  tasks: TaskItem[];
}

/**
 * Splits tasks into consecutive urgency groups, keeping the incoming order.
 * The server already sorts by due date, so a group never repeats inside a page.
 */
export function groupByUrgency(tasks: TaskItem[], now: Date = new Date()): TaskGroup[] {
  const groups: TaskGroup[] = [];
  for (const task of tasks) {
    const g = dueGroup(task, now);
    const last = groups[groups.length - 1];
    if (last && last.group === g) last.tasks.push(task);
    else groups.push({ group: g, tasks: [task] });
  }
  return groups;
}

/** Step 0 is the person doing the work; steps 1..n are approvals. */
export function stepLabel(task: TaskItem): string {
  if (task.currentStepOrder === 0) return 'Starting step';
  return task.totalSteps ? `Step ${task.currentStepOrder} of ${task.totalSteps}` : `Step ${task.currentStepOrder}`;
}

export type SegmentState = 'done' | 'current' | 'todo';

/** One segment per step (the starting step plus each approval). Empty when the workflow length is unknown. */
export function stepSegments(task: TaskItem): SegmentState[] {
  if (!task.totalSteps) return [];
  return Array.from({ length: task.totalSteps + 1 }, (_, i) =>
    i < task.currentStepOrder ? 'done' : i === task.currentStepOrder ? 'current' : 'todo');
}

export function actionVerb(task: TaskItem): 'Complete' | 'Approve' {
  return task.currentStepOrder === 0 ? 'Complete' : 'Approve';
}

/** What happens to the task when the person confirms. Never guesses when the workflow length is unknown. */
export function nextStepText(task: TaskItem): string {
  if (task.totalSteps === undefined) return 'The task moves to the next step, or is completed if this was the last one.';
  if (task.currentStepOrder >= task.totalSteps) return 'This is the final step, so the task will be marked Completed.';
  return `The task moves to step ${task.currentStepOrder + 1} and the next approver is notified.`;
}

export const REJECT_REASONS = ['Missing documents', 'Budget exceeded', 'Needs more detail', 'Wrong approver'] as const;
