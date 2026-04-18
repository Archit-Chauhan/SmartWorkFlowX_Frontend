import type { UserRole } from './User';

export interface LoginRequest {
  email: string;
  password?: string; // We'll keep it optional in the model for safety
}

export interface AuthResponse {
  token: string;
  email: string;
  role: UserRole;
}

export interface DecodedToken {
  nameid: string; // This is the UserId from JWT
  role: UserRole;
  exp: number;
  iat: number;
}