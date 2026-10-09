export type WorkflowStatus = 'Draft' | 'Active' | 'Inactive';
export type OnRejectAction = 'GoBack' | 'Cancel';

export interface WorkflowStep {
  stepId: number;
  stepOrder: number;
  stepName: string;
  description?: string;
  approverRoleName: string;
  /** Id of the approver role: the edit form uses this, never the role name. */
  approverRoleId: number;
  onRejectAction: OnRejectAction;
  escalationHours?: number | null;
}

export interface WorkflowStepCreateDto {
  stepOrder: number;
  approverRoleId: number;
  stepName: string;
  description?: string;
  onRejectAction: OnRejectAction;
  escalationHours?: number;
}

export interface Workflow {
  workflowId: number;
  title: string;
  status: WorkflowStatus;
  stepCount: number;
  description?: string | null;
  createdByName?: string;
  createdAt?: string;
  /** Tasks of this workflow that are Pending or In Progress. Above zero the workflow is locked. */
  activeTaskCount?: number;
  steps?: WorkflowStepSummary[];
}

export interface WorkflowStepSummary {
  stepOrder: number;
  stepName: string;
  approverRoleName: string;
}

export interface WorkflowRole {
  roleId: number;
  roleName: string;
}

export interface WorkflowDetail {
  workflowId: number;
  title: string;
  description?: string;
  status: WorkflowStatus;
  createdByName: string;
  createdAt: string;
  steps: WorkflowStep[];
}

export interface WorkflowCreateRequest {
  title: string;
  description: string;
  /** Draft (default) or Active. */
  status?: 'Draft' | 'Active';
  steps: WorkflowStepCreateDto[];
}

export interface WorkflowUpdateRequest {
  title: string;
  description: string;
  status: WorkflowStatus;
  steps: WorkflowStepCreateDto[];
}