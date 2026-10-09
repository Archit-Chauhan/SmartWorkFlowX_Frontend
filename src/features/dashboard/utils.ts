import type { DashboardFilters, DashboardResponse, KpiValue } from '../../models/Dashboard';

export type RangePreset = '7d' | '30d' | '90d' | 'month';
export type RangeKind = RangePreset | 'custom';

export const DEFAULT_RANGE: RangePreset = '30d';
export const MAX_RANGE_DAYS = 366;
export const STATUS_OPTIONS = ['Pending', 'In Progress', 'Completed', 'Rejected', 'Cancelled'];
export const PRIORITY_OPTIONS = ['Low', 'Medium', 'High'];

/** Everything the URL carries: the date range plus the optional dropdown filters. */
export interface DashboardUrlState {
  range: RangeKind;
  /** Only meaningful when range === 'custom'. */
  from?: string;
  to?: string;
  status?: string;
  priority?: string;
  categoryId?: number;
  workflowId?: number;
  assigneeId?: number;
}

const PRESETS: RangePreset[] = ['7d', '30d', '90d', 'month'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

const pad = (n: number): string => String(n).padStart(2, '0');

/** yyyy-MM-dd from local date parts (toISOString would shift the day in some timezones). */
export function formatDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parses yyyy-MM-dd as a local date, or null when malformed or not a real calendar date. */
export function parseDate(s: string): Date | null {
  if (!DATE_RE.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null;
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

/** Number of calendar days from..to inclusive (0 when either date is invalid). */
export function daysInRange(from: string, to: string): number {
  const a = parseDate(from);
  const b = parseDate(to);
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / DAY_MS) + 1;
}

/** Returns an error message, or null when the custom range is acceptable. */
export function validateCustomRange(from: string, to: string): string | null {
  if (!parseDate(from) || !parseDate(to)) return 'Enter both dates.';
  if (from > to) return 'Start date must be on or before the end date.';
  if (daysInRange(from, to) > MAX_RANGE_DAYS) return `Range can be at most ${MAX_RANGE_DAYS} days.`;
  return null;
}

export function resolveRange(state: Pick<DashboardUrlState, 'range' | 'from' | 'to'>, today: Date): { from: string; to: string } {
  const to = formatDate(today);
  switch (state.range) {
    case '7d': return { from: formatDate(addDays(today, -6)), to };
    case '90d': return { from: formatDate(addDays(today, -89)), to };
    case 'month': return { from: formatDate(new Date(today.getFullYear(), today.getMonth(), 1)), to };
    case 'custom':
      if (state.from && state.to) return { from: state.from, to: state.to };
      return { from: formatDate(addDays(today, -29)), to };
    default: return { from: formatDate(addDays(today, -29)), to };
  }
}

function positiveInt(v: string | null): number | undefined {
  if (!v || !/^\d+$/.test(v)) return undefined;
  const n = Number(v);
  return n > 0 ? n : undefined;
}

export function parseUrlState(params: URLSearchParams): DashboardUrlState {
  const rangeParam = params.get('range');
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  let base: Pick<DashboardUrlState, 'range' | 'from' | 'to'> = { range: DEFAULT_RANGE };
  if (rangeParam && (PRESETS as string[]).includes(rangeParam)) {
    base = { range: rangeParam as RangePreset };
  } else if (validateCustomRange(from, to) === null) {
    base = { range: 'custom', from, to };
  }
  return {
    ...base,
    status: params.get('status') || undefined,
    priority: params.get('priority') || undefined,
    categoryId: positiveInt(params.get('categoryId')),
    workflowId: positiveInt(params.get('workflowId')),
    assigneeId: positiveInt(params.get('assigneeId')),
  };
}

export function serializeUrlState(state: DashboardUrlState): URLSearchParams {
  const p = new URLSearchParams();
  if (state.range === 'custom' && state.from && state.to) {
    p.set('from', state.from);
    p.set('to', state.to);
  } else if (state.range !== 'custom') {
    p.set('range', state.range);
  }
  if (state.status) p.set('status', state.status);
  if (state.priority) p.set('priority', state.priority);
  if (state.categoryId) p.set('categoryId', String(state.categoryId));
  if (state.workflowId) p.set('workflowId', String(state.workflowId));
  if (state.assigneeId) p.set('assigneeId', String(state.assigneeId));
  return p;
}

export function toFilters(state: DashboardUrlState, today: Date): DashboardFilters {
  const { from, to } = resolveRange(state, today);
  return {
    from, to,
    status: state.status,
    priority: state.priority,
    categoryId: state.categoryId,
    workflowId: state.workflowId,
    assigneeId: state.assigneeId,
  };
}

/** Query params for the API: only the filters that are set. */
export function toQueryParams(f: DashboardFilters): Record<string, string | number> {
  const out: Record<string, string | number> = { from: f.from, to: f.to };
  if (f.status) out.status = f.status;
  if (f.priority) out.priority = f.priority;
  if (f.categoryId) out.categoryId = f.categoryId;
  if (f.workflowId) out.workflowId = f.workflowId;
  if (f.assigneeId) out.assigneeId = f.assigneeId;
  return out;
}

export function hasActiveFilters(state: DashboardUrlState): boolean {
  return Boolean(state.status || state.priority || state.categoryId || state.workflowId || state.assigneeId);
}

export function tasksExportFileName(from: string, to: string): string {
  return `tasks-${from}_${to}.csv`;
}

// ---------- Numbers ----------

/** Relative change in percent, rounded. null when there is no usable previous value. */
export function percentChange(current: number, previous: number | null): number | null {
  if (previous === null || previous === 0) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

export type ChangeDirection = 'up' | 'down' | 'flat' | 'none';
export type ChangeTone = 'good' | 'bad' | 'neutral';
/** Which way a measure should move: 'up' = higher is better, 'down' = lower is better. */
export type Polarity = 'up' | 'down' | 'neutral';

export interface ChangeInfo {
  text: string;
  direction: ChangeDirection;
}

const signed = (n: number): string => (n > 0 ? `+${n}` : String(n));
const round1 = (n: number): number => Math.round(n * 10) / 10;

/** Change badge text: "+12%", "-3 pts" for percent measures, "no data" when it cannot be compared. */
export function formatChange(kpi: KpiValue, isPercentMeasure = false): ChangeInfo {
  if (isPercentMeasure) {
    if (kpi.previous === null) return { text: 'no data', direction: 'none' };
    const diff = round1(kpi.current - kpi.previous);
    return { text: `${signed(diff)} pts`, direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat' };
  }
  const pct = percentChange(kpi.current, kpi.previous);
  if (pct === null) return { text: 'no data', direction: 'none' };
  return { text: `${signed(pct)}%`, direction: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat' };
}

export function changeTone(direction: ChangeDirection, polarity: Polarity): ChangeTone {
  if (direction === 'none' || direction === 'flat' || polarity === 'neutral') return 'neutral';
  return direction === polarity ? 'good' : 'bad';
}

/** Hours as "5.2 h", or "1.4 d" from 24 hours up. */
export function formatHours(hours: number | null): string {
  if (hours === null || Number.isNaN(hours)) return '-';
  if (hours < 24) return `${round1(hours).toFixed(1)} h`;
  return `${round1(hours / 24).toFixed(1)} d`;
}

export function formatPercent(v: number | null): string {
  return v === null ? '-' : `${round1(v)}%`;
}

export function completionPct(completed: number, total: number): number {
  return total > 0 ? Math.round((completed / total) * 100) : 0;
}

// ---------- Labels and colours ----------

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "3 Mar" from yyyy-MM-dd. */
export function formatShortDate(s: string): string {
  const d = parseDate(s);
  return d ? `${d.getDate()} ${MONTHS[d.getMonth()]}` : s;
}

export function formatClock(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function statusColor(status: string): string {
  switch (status.toLowerCase().replace(/[\s_-]/g, '')) {
    case 'pending': return 'var(--status-pending)';
    case 'inprogress': return 'var(--status-progress)';
    case 'completed': return 'var(--status-completed)';
    case 'rejected': return 'var(--status-rejected)';
    case 'cancelled': return 'var(--warning)';
    default: return 'var(--chart-3)';
  }
}

export function priorityChip(priority: string): string {
  switch (priority.toLowerCase()) {
    case 'high': return 'chip-rejected';
    case 'medium': return 'chip-warning';
    default: return 'chip-neutral';
  }
}

export function isEmptyDashboard(d: DashboardResponse): boolean {
  const { created, completed, open } = d.kpis;
  return created.current === 0 && completed.current === 0 && open.current === 0
    && d.series.every(p => p.created === 0 && p.completed === 0);
}

// ---------- CSV ----------

/** Quotes a field when it holds a comma, quote or line break. */
export function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csvRow(cells: (string | number | null | undefined)[]): string {
  return cells.map(escapeCsv).join(',');
}

export const CSV_BOM = '﻿';

const KPI_ROWS: { label: string; key: keyof DashboardResponse['kpis']; pct?: boolean }[] = [
  { label: 'Created', key: 'created' },
  { label: 'Completed', key: 'completed' },
  { label: 'Open', key: 'open' },
  { label: 'Overdue', key: 'overdue' },
  { label: 'On-time rate (%)', key: 'onTimeRatePct', pct: true },
  { label: 'Avg completion time (hours)', key: 'avgCompletionHours' },
];

/** Summary CSV (UTF-8 BOM first so Excel reads it correctly): KPIs with change, then each breakdown. */
export function buildSummaryCsv(d: DashboardResponse): string {
  const lines: string[] = [];
  lines.push(csvRow(['Period', d.range.from, d.range.to]));
  lines.push(csvRow(['Previous period', d.range.previousFrom, d.range.previousTo]));
  lines.push('');
  lines.push(csvRow(['KPI', 'Current', 'Previous', 'Change']));
  for (const r of KPI_ROWS) {
    const k = d.kpis[r.key];
    lines.push(csvRow([r.label, k.current, k.previous, formatChange(k, r.pct).text]));
  }
  lines.push('', csvRow(['Created vs completed', 'Created', 'Completed']));
  d.series.forEach(p => lines.push(csvRow([p.date, p.created, p.completed])));
  lines.push('', csvRow(['Status', 'Count']));
  d.byStatus.forEach(s => lines.push(csvRow([s.status, s.count])));
  lines.push('', csvRow(['Priority', 'Count']));
  d.byPriority.forEach(s => lines.push(csvRow([s.priority, s.count])));
  lines.push('', csvRow(['Category', 'Count']));
  d.byCategory.forEach(s => lines.push(csvRow([s.name, s.count])));
  lines.push('', csvRow(['Workflow', 'Total', 'Completed', 'Avg cycle (hours)']));
  d.byWorkflow.forEach(w => lines.push(csvRow([w.title, w.total, w.completed, w.avgCycleHours === null ? '' : round1(w.avgCycleHours)])));
  if (d.workload.length > 0) {
    lines.push('', csvRow(['Assignee', 'Pending', 'In progress', 'Completed']));
    d.workload.forEach(w => lines.push(csvRow([w.name, w.pending, w.inProgress, w.completed])));
  }
  lines.push('', csvRow(['Overdue aging', 'Count']));
  d.overdueAging.forEach(a => lines.push(csvRow([a.bucket, a.count])));
  return CSV_BOM + lines.join('\r\n') + '\r\n';
}
