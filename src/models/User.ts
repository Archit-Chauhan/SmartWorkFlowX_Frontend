export type UserRole = 'Admin' | 'Manager' | 'Employee' | 'Auditor';

export interface User {
  userId: number;
  name: string;
  email: string;
  roleId: number;
  role?: Role;
  isDeleted: boolean;
  deletedAt?: string;
  createdAt?: string;
}

export interface Role {
  roleId: number;
  roleName: UserRole;
}
/** A row of GET /Admin/users (flat shape, includes deactivated users). */
export interface AdminUser {
  userId: number;
  name: string;
  email: string;
  roleName: string;
  roleId: number;
  createdAt: string;
  isDeleted: boolean;
  deletedAt?: string | null;
  openTaskCount: number;
}

export type UserStatusFilter = 'all' | 'active' | 'deactivated';

export interface UserCounts {
  all: number;
  active: number;
  deactivated: number;
}

export interface AdminUsersResponse {
  data: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
  counts: UserCounts;
}

/** An entry of GET /Admin/roles. */
export interface RoleOption {
  roleId: number;
  roleName: string;
}
