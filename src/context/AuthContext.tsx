import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { User, UserRole, LoginRequest, AuthResponse } from '../models';
import axiosInstance from '../api/axiosInstance';

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  // 1. On Mount: Check if user is already logged in (Persistent Session)
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedRole = localStorage.getItem('role') as UserRole;
    const savedEmail = localStorage.getItem('email');

    if (savedToken && savedRole && savedEmail) {
      setRole(savedRole);
      setUser({ email: savedEmail } as User); // Minimal user object
    }
    setLoading(false);
  }, []);

  // 2. Login Logic
  const login = async (credentials: LoginRequest) => {
    try {
      const response = await axiosInstance.post<AuthResponse>('/Auth/login', credentials);
      const { token, role: userRole, email } = response.data;

      // Store in LocalStorage for persistence
      localStorage.setItem('token', token);
      localStorage.setItem('role', userRole);
      localStorage.setItem('email', email);

      setRole(userRole);
      setUser({ email } as User);
    } catch (error) {
      console.error("Login failed", error);
      throw error; // Re-throw so the UI can show an error message
    }
  };

  // 3. Logout Logic
  const logout = () => {
    localStorage.clear();
    setUser(null);
    setRole(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, role, isAuthenticated: !!user, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

// Custom Hook for easy access
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};