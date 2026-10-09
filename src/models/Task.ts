export type TaskStatus = 'Pending' | 'In Progress' | 'Completed' | 'Cancelled' | 'Rejected';
export type TaskPriority = 'Low' | 'Medium' | 'High';

export interface TaskCategory {
  categoryId: number;
  name: string;
  colorHex: string;
}

export interface TaskItem {
  taskId: number;
  title: string;
  description?: string;
  workflowId: number;
  workflowTitle?: string;
  /** Null/absent when nobody holds the task (finished, or waiting for a role pool). */
  assignedTo?: number | null;
  assigneeName?: string | null;
  /** All Tasks only: the role whose pool the task is waiting in, when nobody holds it. */
  assignedRoleName?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  currentStepOrder: number;
  /** Number of approval steps in the workflow (the API may omit it). */
  totalSteps?: number;
  rejectedReason?: string;
  dueDate?: string;
  completedAt?: string;
  createdAt: string;
  categoryId?: number;
  categoryName?: string;
  categoryColor?: string;
}

export interface TaskCreateRequest {
  title: string;
  description: string;
  workflowId: number;
  assignedTo: number;
  priority: TaskPriority;
  dueDate?: string;
  categoryId?: number;
}

export interface TaskRejectRequest {
  reason: string;
  comment?: string;
}

export interface TaskStepHistory {
  stepOrder: number;
  actedByName: string;
  action: 'Approved' | 'Rejected' | 'Completed';
  comment?: string;
  actedAt: string;
}

/** The groups behind the tabs of /Task/all. `closed` = Rejected or Cancelled. */
export type TaskGroupFilter = 'all' | 'open' | 'completed' | 'closed';

/** Paged answer of GET /Task/all (see docs/ALL_TASKS_SPEC.md). `counts` ignores group/status. */
export interface AllTasksResponse {
  data: TaskItem[];
  total: number;
  page: number;
  pageSize: number;
  counts: Record<TaskGroupFilter, number>;
}

/** A person who can be given a task (GET /Task/assignable-users). */
export interface AssignableUser {
  userId: number;
  name: string;
  email: string;
  roleName: string;
  /** Pending or In Progress tasks the person already holds. Older servers omit it. */
  openTaskCount?: number;
}
