import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import MainLayout from '../layout/MainLayout';

// Feature Imports
import Login from '../features/auth/Login';
import ForgotPassword from '../features/auth/ForgotPassword';
import ResetPassword from '../features/auth/ResetPassword';
import Dashboard from '../features/reports/Dashboard';
import TaskList from '../features/tasks/TaskList';
import TaskAssign from '../features/tasks/TaskAssign';
import WorkflowBuilder from '../features/workflows/WorkflowBuilder';
import UserManagement from '../features/auth/UserManagement';
import AuditLog from '../features/reports/AuditLog';

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center text-gray-400">Loading...</div>;
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

const RoleRoute = ({ children, roles }: { children: React.ReactNode; roles: string[] }) => {
  const { role } = useAuth();
  return roles.includes(role || '') ? <>{children}</> : <Navigate to="/" replace />;
};

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Protected Layout */}
      <Route path="/" element={<PrivateRoute><MainLayout /></PrivateRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="tasks" element={<TaskList />} />
        <Route path="assign" element={
          <RoleRoute roles={['Admin', 'Manager']}>
            <TaskAssign />
          </RoleRoute>
        } />
        <Route path="workflows" element={
          <RoleRoute roles={['Admin', 'Manager']}>
            <WorkflowBuilder />
          </RoleRoute>
        } />
        <Route path="users" element={
          <RoleRoute roles={['Admin']}>
            <UserManagement />
          </RoleRoute>
        } />
        <Route path="audit" element={
          <RoleRoute roles={['Admin', 'Auditor']}>
            <AuditLog />
          </RoleRoute>
        } />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRoutes;