// Contract for GET /Report/dashboard. The demo mock implements it today; the .NET endpoint will return the same shape.
// See docs/DASHBOARD_SPEC.md for the exact meaning of every number.

export type DashboardBucket = 'day' | 'week';

/** All filters are optional except the date range. Dates are yyyy-MM-dd, inclusive. */
export interface DashboardFilters {
  from: string;
  to: string;
  status?: string;
  priority?: string;
  categoryId?: number;
  workflowId?: number;
  assigneeId?: number;
}

export interface KpiValue {
  current: number;
  /** Same measure over the previous period of equal length. null when it cannot be computed. */
  previous: number | null;
}

export interface DashboardKpis {
  created: KpiValue;
  completed: KpiValue;
  /** Not completed, cancelled or rejected at the end of the range. */
  open: KpiValue;
  /** Open and past due at the end of the range. */
  overdue: KpiValue;
  /** Percent (0-100) of tasks completed in the range that finished on or before their due date. */
  onTimeRatePct: KpiValue;
  /** Mean hours from creation to completion for tasks completed in the range. */
  avgCompletionHours: KpiValue;
}

export interface TrendPoint {
  /** Bucket start, yyyy-MM-dd (the Monday for weekly buckets). */
  date: string;
  created: number;
  completed: number;
}

export interface DashboardRange {
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
  bucket: DashboardBucket;
}

export interface WorkflowStat {
  workflowId: number;
  title: string;
  total: number;
  completed: number;
  avgCycleHours: number | null;
}

export interface WorkloadRow {
  userId: number;
  name: string;
  pending: number;
  inProgress: number;
  completed: number;
}

export interface OverdueTask {
  taskId: number;
  title: string;
  assigneeName?: string;
  workflowTitle?: string;
  priority: string;
  dueDate: string;
  daysOverdue: number;
}

export interface DashboardOptions {
  workflows: { id: number; title: string }[];
  categories: { id: number; name: string; colorHex: string }[];
  /** Empty for the Employee scope. */
  assignees: { id: number; name: string }[];
}

export interface DashboardResponse {
  /** 'self' means the numbers cover only the signed-in user's tasks (Employee). */
  scope: 'all' | 'self';
  generatedAt: string;
  range: DashboardRange;
  kpis: DashboardKpis;
  series: TrendPoint[];
  byStatus: { status: string; count: number }[];
  byPriority: { priority: string; count: number }[];
  byCategory: { categoryId: number | null; name: string; colorHex: string; count: number }[];
  byWorkflow: WorkflowStat[];
  /** Empty for the Employee scope. */
  workload: WorkloadRow[];
  overdueAging: { bucket: '1-3 days' | '4-7 days' | '8-14 days' | '15+ days'; count: number }[];
  topOverdue: OverdueTask[];
  options: DashboardOptions;
}
