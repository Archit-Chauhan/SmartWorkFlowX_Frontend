export type UserRole = 'Admin' | 'Manager' | 'Employee' | 'Auditor';

export interface User {
  userId: number;
  name: string;
  email: string;
  roleId: number;
  role?: Role;
}

export interface Role {
  roleId: number;
  roleName: UserRole;
}