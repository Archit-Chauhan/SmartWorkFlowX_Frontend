import React, { useEffect, useState } from 'react';
import axiosInstance from '../../api/axiosInstance';
import type { SystemAnalytics } from '../../models';
import {
  Users, GitBranch, Clock, CheckCircle, UserPlus, FileSearch,
  AlertTriangle, Activity, BarChart2, Timer
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<SystemAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const { role } = useAuth();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await axiosInstance.get<SystemAnalytics>('/Report/analytics');
        setStats(response.data);
      } catch (error) {
        console.error('Failed to fetch analytics', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) return (
    <div className="flex justify-center items-center h-64 text-gray-400">
      <Activity size={20} className="animate-pulse mr-2" /> Loading Dashboard...
    </div>
  );

  const primaryCards = [
    { label: 'Total Users',       value: stats?.totalUsers ?? 0,       icon: <Users size={20} className="text-blue-600" />,    color: 'bg-blue-50',   border: 'border-blue-100' },
    { label: 'Active Workflows',  value: stats?.activeWorkflows ?? 0,  icon: <GitBranch size={20} className="text-purple-600" />, color: 'bg-purple-50', border: 'border-purple-100' },
    { label: 'In Progress Tasks', value: stats?.inProgressTasks ?? 0,  icon: <Clock size={20} className="text-blue-500" />,    color: 'bg-blue-50',   border: 'border-blue-100' },
    { label: 'Completed Tasks',   value: stats?.completedTasks ?? 0,   icon: <CheckCircle size={20} className="text-green-600" />, color: 'bg-green-50', border: 'border-green-100' },
    { label: 'Pending Tasks',     value: stats?.pendingTasks ?? 0,     icon: <Timer size={20} className="text-yellow-600" />,  color: 'bg-yellow-50', border: 'border-yellow-100' },
    { label: 'Overdue Tasks',     value: stats?.overdueTasks ?? 0,     icon: <AlertTriangle size={20} className="text-red-500" />, color: 'bg-red-50',  border: 'border-red-100' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">System Overview</h2>
        <p className="text-gray-500 mt-1">Welcome back! Here's what's happening in SmartWorkFlowX today.</p>
      </div>

      {/* Primary Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {primaryCards.map((stat, idx) => (
          <div key={idx} className={`bg-white p-5 rounded-xl shadow-sm border ${stat.border} flex items-center gap-4`}>
            <div className={`p-3 rounded-xl ${stat.color}`}>
              {stat.icon}
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Avg Completion Time + Overdue Alert */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-indigo-50">
            <BarChart2 size={20} className="text-indigo-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Avg Completion Time</p>
            <p className="text-2xl font-bold text-gray-900">
              {stats?.avgCompletionTimeHours
                ? `${stats.avgCompletionTimeHours}h`
                : '—'}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-50">
            <GitBranch size={20} className="text-amber-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Total Workflows</p>
            <p className="text-2xl font-bold text-gray-900">{stats?.totalWorkflows ?? 0}</p>
            <p className="text-xs text-gray-400">{stats?.activeWorkflows ?? 0} active</p>
          </div>
        </div>
      </div>

      {/* Per-User Breakdown */}
      {stats && stats.tasksPerUser.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">Tasks Per User</h3>
            <span className="text-xs text-gray-400">{stats.tasksPerUser.length} users with tasks</span>
          </div>
          <div className="divide-y divide-gray-50">
            {stats.tasksPerUser.map((u, i) => (
              <div key={i} className="px-6 py-3 flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-600 flex-shrink-0">
                  {(u.userName || 'U').charAt(0).toUpperCase()}
                </div>
                <span className="flex-1 font-medium text-gray-700 text-sm">{u.userName || 'Unknown User'}</span>
                <div className="flex gap-3 text-xs">
                  {u.pendingCount > 0 && (
                    <span className="bg-yellow-50 text-yellow-700 px-2 py-1 rounded-full font-semibold">
                      {u.pendingCount} pending
                    </span>
                  )}
                  {u.inProgressCount > 0 && (
                    <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-full font-semibold">
                      {u.inProgressCount} in progress
                    </span>
                  )}
                  {u.completedCount > 0 && (
                    <span className="bg-green-50 text-green-700 px-2 py-1 rounded-full font-semibold">
                      {u.completedCount} done
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Admin/Manager Quick Actions */}
      {(role === 'Admin' || role === 'Manager') && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {role === 'Admin' && (
              <Link to="/users"
                className="flex items-center gap-4 p-4 border border-blue-100 rounded-xl hover:bg-blue-50 transition-colors group">
                <div className="bg-blue-100 p-2 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <UserPlus size={20} />
                </div>
                <div>
                  <p className="font-bold text-gray-800">Manage Users</p>
                  <p className="text-xs text-gray-500">Add, view or remove users.</p>
                </div>
              </Link>
            )}
            <Link to="/workflows"
              className="flex items-center gap-4 p-4 border border-purple-100 rounded-xl hover:bg-purple-50 transition-colors group">
              <div className="bg-purple-100 p-2 rounded-lg group-hover:bg-purple-600 group-hover:text-white transition-colors">
                <GitBranch size={20} />
              </div>
              <div>
                <p className="font-bold text-gray-800">Manage Workflows</p>
                <p className="text-xs text-gray-500">Create, edit or clone workflow templates.</p>
              </div>
            </Link>
            <Link to="/assign"
              className="flex items-center gap-4 p-4 border border-green-100 rounded-xl hover:bg-green-50 transition-colors group">
              <div className="bg-green-100 p-2 rounded-lg group-hover:bg-green-600 group-hover:text-white transition-colors">
                <CheckCircle size={20} />
              </div>
              <div>
                <p className="font-bold text-gray-800">Assign Task</p>
                <p className="text-xs text-gray-500">Kick off a new workflow for an employee.</p>
              </div>
            </Link>
            {role === 'Admin' && (
              <Link to="/audit"
                className="flex items-center gap-4 p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors group">
                <div className="bg-gray-100 p-2 rounded-lg group-hover:bg-gray-800 group-hover:text-white transition-colors">
                  <FileSearch size={20} />
                </div>
                <div>
                  <p className="font-bold text-gray-800">Audit Logs</p>
                  <p className="text-xs text-gray-500">Monitor all system activity and compliance.</p>
                </div>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;