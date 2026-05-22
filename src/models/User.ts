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