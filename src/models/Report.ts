export interface TasksPerUser {
  userName: string;
  pendingCount: number;
  inProgressCount: number;
  completedCount: number;
}

export interface SystemAnalytics {
  totalUsers: number;
  totalWorkflows: number;
  activeWorkflows: number;
  pendingTasks: number;
  inProgressTasks: number;
  completedTasks: number;
  overdueTasks: number;
  avgCompletionTimeHours: number;
  tasksPerUser: TasksPerUser[];
}

export interface AuditLogEntry {
  userName: string;
  action: string;
  entityName: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  total: number;
  page: number;
  pageSize: number;
  data: T[];
}