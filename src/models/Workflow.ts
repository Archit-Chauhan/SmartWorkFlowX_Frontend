export type WorkflowStatus = 'Draft' | 'Active' | 'Inactive';
export type OnRejectAction = 'GoBack' | 'Cancel';

export interface WorkflowStep {
  stepId: number;
  stepOrder: number;
  stepName: string;
  description?: string;
  approverRoleName: string;
  onRejectAction: OnRejectAction;
  escalationHours?: number;
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
  steps: WorkflowStepCreateDto[];
}

export interface WorkflowUpdateRequest {
  title: string;
  description: string;
  status: WorkflowStatus;
  steps: WorkflowStepCreateDto[];
}