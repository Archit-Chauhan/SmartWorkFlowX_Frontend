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
  assignedTo?: number;
  assigneeName?: string;
  status: TaskStatus;
  priority: TaskPriority;
  currentStepOrder: number;
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