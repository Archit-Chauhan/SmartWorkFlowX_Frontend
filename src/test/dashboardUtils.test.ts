import { describe, it, expect } from 'vitest';
import type { DashboardResponse } from '../models/Dashboard';
import {
  buildSummaryCsv, changeTone, CSV_BOM, escapeCsv, formatChange, formatDate, formatHours, isEmptyDashboard,
  parseUrlState, percentChange, resolveRange, serializeUrlState, tasksExportFileName, toQueryParams,
  validateCustomRange, daysInRange,
} from '../features/dashboard/utils';

const fixture: DashboardResponse = {
  scope: 'all',
  generatedAt: '2026-03-10T09:30:00Z',
  range: { from: '2026-02-09', to: '2026-03-10', previousFrom: '2026-01-10', previousTo: '2026-02-08', bucket: 'day' },
  kpis: {
    created: { current: 12, previous: 10 },
    completed: { current: 8, previous: 0 },
    open: { current: 5, previous: 4 },
    overdue: { current: 2, previous: 3 },
    onTimeRatePct: { current: 75, previous: 80 },
    avgCompletionHours: { current: 30, previous: null },
  },
  series: [{ date: '2026-03-09', created: 1, completed: 0 }],
  byStatus: [{ status: 'In Progress', count: 3 }],
  byPriority: [{ priority: 'High', count: 2 }],
  byCategory: [{ categoryId: 1, name: 'HR, Admin', colorHex: '#123456', count: 4 }],
  byWorkflow: [{ workflowId: 1, title: 'Onboarding "v2"', total: 5, completed: 2, avgCycleHours: 12.34 }],
  workload: [{ userId: 1, name: 'Ann', pending: 1, inProgress: 2, completed: 3 }],
  overdueAging: [{ bucket: '1-3 days', count: 2 }],
  topOverdue: [],
  options: { workflows: [], categories: [], assignees: [] },
};

describe('date ranges', () => {
  const today = new Date(2026, 2, 10); // 10 Mar 2026 local
  it('formats with local parts', () => {
    expect(formatDate(new Date(2026, 0, 1, 0, 5))).toBe('2026-01-01');
  });
  it('resolves presets', () => {
    expect(resolveRange({ range: '7d' }, today)).toEqual({ from: '2026-03-04', to: '2026-03-10' });
    expect(resolveRange({ range: '30d' }, today)).toEqual({ from: '2026-02-09', to: '2026-03-10' });
    expect(resolveRange({ range: '90d' }, today)).toEqual({ from: '2025-12-11', to: '2026-03-10' });
    expect(resolveRange({ range: 'month' }, today)).toEqual({ from: '2026-03-01', to: '2026-03-10' });
  });
  it('uses custom dates as given', () => {
    expect(resolveRange({ range: 'custom', from: '2026-01-01', to: '2026-01-31' }, today)).toEqual({ from: '2026-01-01', to: '2026-01-31' });
  });
  it('counts days inclusively', () => {
    expect(daysInRange('2026-03-01', '2026-03-01')).toBe(1);
    expect(daysInRange('2026-02-09', '2026-03-10')).toBe(30);
  });
  it('validates custom ranges', () => {
    expect(validateCustomRange('2026-01-01', '2026-01-31')).toBeNull();
    expect(validateCustomRange('2026-02-01', '2026-01-31')).not.toBeNull();
    expect(validateCustomRange('', '2026-01-31')).not.toBeNull();
    expect(validateCustomRange('2025-01-01', '2026-01-01')).toBeNull();
    expect(validateCustomRange('2025-01-01', '2026-01-02')).not.toBeNull();
  });
});

describe('url state', () => {
  it('defaults to 30d', () => {
    expect(parseUrlState(new URLSearchParams(''))).toMatchObject({ range: '30d' });
  });
  it('parses presets and filters', () => {
    const s = parseUrlState(new URLSearchParams('range=7d&status=Pending&categoryId=3&workflowId=x'));
    expect(s).toMatchObject({ range: '7d', status: 'Pending', categoryId: 3, workflowId: undefined });
  });
  it('parses custom ranges and falls back on invalid ones', () => {
    expect(parseUrlState(new URLSearchParams('from=2026-01-01&to=2026-01-31'))).toMatchObject({ range: 'custom', from: '2026-01-01', to: '2026-01-31' });
    expect(parseUrlState(new URLSearchParams('from=2026-02-01&to=2026-01-31')).range).toBe('30d');
    expect(parseUrlState(new URLSearchParams('range=bogus')).range).toBe('30d');
  });
  it('round-trips', () => {
    const state = { range: 'custom' as const, from: '2026-01-01', to: '2026-01-31', priority: 'High', assigneeId: 4 };
    const qs = serializeUrlState(state).toString();
    expect(parseUrlState(new URLSearchParams(qs))).toMatchObject(state);
    expect(serializeUrlState({ range: '90d' }).toString()).toBe('range=90d');
  });
  it('builds API params with only set filters', () => {
    expect(toQueryParams({ from: 'a', to: 'b', categoryId: 2 })).toEqual({ from: 'a', to: 'b', categoryId: 2 });
    expect(tasksExportFileName('2026-01-01', '2026-01-31')).toBe('tasks-2026-01-01_2026-01-31.csv');
  });
});

describe('numbers', () => {
  it('computes percent change', () => {
    expect(percentChange(12, 10)).toBe(20);
    expect(percentChange(5, 0)).toBeNull();
    expect(percentChange(5, null)).toBeNull();
  });
  it('formats change badges', () => {
    expect(formatChange({ current: 12, previous: 10 })).toEqual({ text: '+20%', direction: 'up' });
    expect(formatChange({ current: 2, previous: 4 })).toEqual({ text: '-50%', direction: 'down' });
    expect(formatChange({ current: 2, previous: 0 })).toEqual({ text: 'no data', direction: 'none' });
    expect(formatChange({ current: 75, previous: 80 }, true)).toEqual({ text: '-5 pts', direction: 'down' });
    expect(formatChange({ current: 80, previous: 80 }, true)).toEqual({ text: '0 pts', direction: 'flat' });
  });
  it('maps direction to tone by polarity', () => {
    expect(changeTone('up', 'down')).toBe('bad');
    expect(changeTone('down', 'down')).toBe('good');
    expect(changeTone('up', 'up')).toBe('good');
    expect(changeTone('up', 'neutral')).toBe('neutral');
    expect(changeTone('none', 'down')).toBe('neutral');
  });
  it('formats hours', () => {
    expect(formatHours(5.24)).toBe('5.2 h');
    expect(formatHours(33.6)).toBe('1.4 d');
    expect(formatHours(null)).toBe('-');
  });
});

describe('csv', () => {
  it('escapes fields', () => {
    expect(escapeCsv('plain')).toBe('plain');
    expect(escapeCsv('a,b')).toBe('"a,b"');
    expect(escapeCsv('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsv(null)).toBe('');
    expect(escapeCsv(0)).toBe('0');
  });
  it('builds the summary with a BOM, KPIs and breakdowns', () => {
    const csv = buildSummaryCsv(fixture);
    expect(csv.startsWith(CSV_BOM)).toBe(true);
    expect(csv).toContain('Created,12,10,+20%');
    expect(csv).toContain('Completed,8,0,no data');
    expect(csv).toContain('On-time rate (%),75,80,-5 pts');
    expect(csv).toContain('"HR, Admin",4');
    expect(csv).toContain('"Onboarding ""v2""",5,2,12.3');
    expect(csv).toContain('Ann,1,2,3');
    expect(csv).toContain('1-3 days,2');
  });
  it('omits the workload section when empty', () => {
    expect(buildSummaryCsv({ ...fixture, workload: [] })).not.toContain('Assignee');
  });
});

describe('isEmptyDashboard', () => {
  it('is false with activity and true when everything is zero', () => {
    expect(isEmptyDashboard(fixture)).toBe(false);
    const zero = { current: 0, previous: 0 };
    expect(isEmptyDashboard({
      ...fixture,
      kpis: { ...fixture.kpis, created: zero, completed: zero, open: zero },
      series: [{ date: '2026-03-09', created: 0, completed: 0 }],
    })).toBe(true);
  });
});
