import { describe, it, expect } from 'vitest';
import type { TaskItem } from '../models';
import { actionVerb, dueGroup, dueInfo, groupByUrgency, nextStepText, stepLabel, stepSegments } from '../features/tasks/taskUtils';

const NOW = new Date('2026-10-09T10:00:00');

const make = (over: Partial<TaskItem> = {}): TaskItem => ({
  taskId: 1,
  title: 'Task',
  workflowId: 1,
  status: 'In Progress',
  priority: 'Medium',
  currentStepOrder: 1,
  createdAt: '2026-10-01T00:00:00',
  ...over,
});

const dueIn = (days: number, hour = 12) => {
  const d = new Date(NOW);
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

describe('dueInfo', () => {
  it('has a neutral label without a due date', () => {
    expect(dueInfo(make(), NOW)).toMatchObject({ label: 'No due date', tone: 'none', dateText: '' });
  });

  it('counts overdue days, rounding up, with a minimum of one', () => {
    expect(dueInfo(make({ dueDate: dueIn(-3) }), NOW)).toMatchObject({ label: '3 days overdue', tone: 'overdue' });
    expect(dueInfo(make({ dueDate: new Date(NOW.getTime() - 60_000).toISOString() }), NOW).label).toBe('1 day overdue');
  });

  it('labels today, tomorrow and later in calendar days', () => {
    expect(dueInfo(make({ dueDate: dueIn(0, 23) }), NOW)).toMatchObject({ label: 'Due today', tone: 'soon' });
    expect(dueInfo(make({ dueDate: dueIn(1) }), NOW)).toMatchObject({ label: 'Due tomorrow', tone: 'soon' });
    expect(dueInfo(make({ dueDate: dueIn(2) }), NOW)).toMatchObject({ label: 'Due in 2 days', tone: 'soon' });
    expect(dueInfo(make({ dueDate: dueIn(9) }), NOW)).toMatchObject({ label: 'Due in 9 days', tone: 'normal' });
  });

  it('never calls a finished task overdue', () => {
    expect(dueInfo(make({ status: 'Completed', dueDate: dueIn(-5) }), NOW).tone).not.toBe('overdue');
  });
});

describe('grouping', () => {
  it('puts tasks into overdue / week / later / none', () => {
    expect(dueGroup(make({ dueDate: dueIn(-1) }), NOW)).toBe('overdue');
    expect(dueGroup(make({ dueDate: dueIn(7) }), NOW)).toBe('week');
    expect(dueGroup(make({ dueDate: dueIn(8) }), NOW)).toBe('later');
    expect(dueGroup(make(), NOW)).toBe('none');
  });

  it('keeps the server order and starts a new group only when the group changes', () => {
    const tasks = [
      make({ taskId: 1, dueDate: dueIn(-2) }),
      make({ taskId: 2, dueDate: dueIn(-1) }),
      make({ taskId: 3, dueDate: dueIn(3) }),
      make({ taskId: 4 }),
    ];
    const groups = groupByUrgency(tasks, NOW);
    expect(groups.map((g) => g.group)).toEqual(['overdue', 'week', 'none']);
    expect(groups[0].tasks.map((t) => t.taskId)).toEqual([1, 2]);
  });

  it('returns no groups for an empty list', () => {
    expect(groupByUrgency([], NOW)).toEqual([]);
  });
});

describe('steps', () => {
  it('labels the starting step and approval steps', () => {
    expect(stepLabel(make({ currentStepOrder: 0 }))).toBe('Starting step');
    expect(stepLabel(make({ currentStepOrder: 2 }))).toBe('Step 2');
    expect(stepLabel(make({ currentStepOrder: 2, totalSteps: 4 }))).toBe('Step 2 of 4');
  });

  it('builds progress segments only when the workflow length is known', () => {
    expect(stepSegments(make())).toEqual([]);
    expect(stepSegments(make({ currentStepOrder: 2, totalSteps: 3 }))).toEqual(['done', 'done', 'current', 'todo']);
    expect(stepSegments(make({ currentStepOrder: 0, totalSteps: 2 }))).toEqual(['current', 'todo', 'todo']);
  });

  it('uses Complete for the starting step and Approve afterwards', () => {
    expect(actionVerb(make({ currentStepOrder: 0 }))).toBe('Complete');
    expect(actionVerb(make({ currentStepOrder: 1 }))).toBe('Approve');
  });

  it('describes what happens next without guessing', () => {
    expect(nextStepText(make({ currentStepOrder: 1, totalSteps: 3 }))).toContain('step 2');
    expect(nextStepText(make({ currentStepOrder: 3, totalSteps: 3 }))).toContain('Completed');
    expect(nextStepText(make({ currentStepOrder: 1 }))).toContain('next step');
  });
});
