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
    <div className="flex justify-center items-center h-64 text-ink-subtle">
      <Activity size={20} className="animate-pulse mr-2" /> Loading Dashboard...
    </div>
  );

  const primaryCards = [
    { label: 'Total Users',       value: stats?.totalUsers ?? 0,       icon: <Users size={20} className="text-ink-subtle" /> },
    { label: 'Active Workflows',  value: stats?.activeWorkflows ?? 0,  icon: <GitBranch size={20} className="text-ink-subtle" /> },
    { label: 'In Progress Tasks', value: stats?.inProgressTasks ?? 0,  icon: <Clock size={20} className="text-ink-subtle" /> },
    { label: 'Completed Tasks',   value: stats?.completedTasks ?? 0,   icon: <CheckCircle size={20} className="text-ink-subtle" /> },
    { label: 'Pending Tasks',     value: stats?.pendingTasks ?? 0,     icon: <Timer size={20} className="text-ink-subtle" /> },
    { label: 'Overdue Tasks',     value: stats?.overdueTasks ?? 0,     icon: <AlertTriangle size={20} className="text-ink-subtle" /> },
  ];

  const totalTasks = (stats?.pendingTasks ?? 0) + (stats?.inProgressTasks ?? 0) + (stats?.completedTasks ?? 0);
  const completionRate = totalTasks > 0 ? Math.round(((stats?.completedTasks ?? 0) / totalTasks) * 100) : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="sr-only">Dashboard</h1>
        <p className="text-ink-muted">Welcome back! Here's what's happening in SmartWorkFlowX today.</p>
      </div>

      {/* Overdue Alert Banner */}
      {(stats?.overdueTasks ?? 0) > 0 && (
        <div className="alert alert-error flex items-center gap-3">
          <AlertTriangle size={20} className="flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold">
              {stats!.overdueTasks} task{stats!.overdueTasks > 1 ? 's are' : ' is'} overdue
            </p>
            <p className="text-xs mt-0.5">These tasks have passed their due date and are still in progress.</p>
          </div>
        </div>
      )}

      {/* Primary Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {primaryCards.map((stat, idx) => (
          <div key={idx} className="card card-pad flex items-center justify-between gap-4">
            <div>
              <p className="caption">{stat.label}</p>
              <p className="text-2xl font-semibold text-ink mt-1">{stat.value}</p>
            </div>
            {stat.icon}
          </div>
        ))}
      </div>

      {/* Task Status Distribution */}
      {totalTasks > 0 && (
        <div className="card card-pad">
          <div className="flex items-center justify-between mb-3">
            <h3 className="section-title">Task Distribution</h3>
            <span className="text-sm font-semibold text-ink">{completionRate}% complete</span>
          </div>
          <div className="flex h-3 rounded-pill overflow-hidden gap-px">
            {(stats?.completedTasks ?? 0) > 0 && (
              <div className="bg-status-completed transition-all" style={{ width: `${Math.round(((stats?.completedTasks ?? 0) / totalTasks) * 100)}%` }} />
            )}
            {(stats?.inProgressTasks ?? 0) > 0 && (
              <div className="bg-status-progress transition-all" style={{ width: `${Math.round(((stats?.inProgressTasks ?? 0) / totalTasks) * 100)}%` }} />
            )}
            {(stats?.pendingTasks ?? 0) > 0 && (
              <div className="bg-status-pending transition-all" style={{ width: `${Math.round(((stats?.pendingTasks ?? 0) / totalTasks) * 100)}%` }} />
            )}
          </div>
          <div className="flex flex-wrap gap-4 mt-3">
            <span className="flex items-center gap-1.5 caption">
              <span className="w-2.5 h-2.5 rounded-pill bg-status-completed inline-block" />
              Completed ({stats?.completedTasks ?? 0})
            </span>
            <span className="flex items-center gap-1.5 caption">
              <span className="w-2.5 h-2.5 rounded-pill bg-status-progress inline-block" />
              In Progress ({stats?.inProgressTasks ?? 0})
            </span>
            <span className="flex items-center gap-1.5 caption">
              <span className="w-2.5 h-2.5 rounded-pill bg-status-pending inline-block" />
              Pending ({stats?.pendingTasks ?? 0})
            </span>
          </div>
        </div>
      )}

      {/* Avg Completion Time + Overdue Alert */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card card-pad flex items-center justify-between gap-4">
          <div>
            <p className="caption">Avg Completion Time</p>
            <p className="text-2xl font-semibold text-ink mt-1">
              {stats?.avgCompletionTimeHours
                ? `${stats.avgCompletionTimeHours}h`
                : '—'}
            </p>
          </div>
          <BarChart2 size={20} className="text-ink-subtle" />
        </div>

        <div className="card card-pad flex items-center justify-between gap-4">
          <div>
            <p className="caption">Total Workflows</p>
            <p className="text-2xl font-semibold text-ink mt-1">{stats?.totalWorkflows ?? 0}</p>
            <p className="text-xs text-ink-subtle">{stats?.activeWorkflows ?? 0} active</p>
          </div>
          <GitBranch size={20} className="text-ink-subtle" />
        </div>
      </div>

      {/* Per-User Breakdown */}
      {stats && stats.tasksPerUser.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-hairline flex items-center justify-between">
            <h3 className="section-title">Tasks Per User</h3>
            <span className="caption">{stats.tasksPerUser.length} users with tasks</span>
          </div>
          <div className="divide-y divide-hairline">
            {stats.tasksPerUser.map((u, i) => (
              <div key={i} className="px-6 py-3 flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-4">
                <div className="w-8 h-8 rounded-pill bg-surface-2 flex items-center justify-center text-sm font-semibold text-ink-muted flex-shrink-0">
                  {(u.userName || 'U').charAt(0).toUpperCase()}
                </div>
                <span className="flex-1 min-w-[120px] font-medium text-ink text-sm truncate">{u.userName || 'Unknown User'}</span>
                <div className="flex flex-wrap gap-2 sm:gap-3 text-xs w-full sm:w-auto">
                  {u.pendingCount > 0 && (
                    <span className="chip chip-pending">
                      {u.pendingCount} pending
                    </span>
                  )}
                  {u.inProgressCount > 0 && (
                    <span className="chip chip-progress">
                      {u.inProgressCount} in progress
                    </span>
                  )}
                  {u.completedCount > 0 && (
                    <span className="chip chip-completed">
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
        <div className="card card-pad">
          <h3 className="section-title mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {role === 'Admin' && (
              <Link to="/users"
                className="flex items-center gap-4 p-4 border border-hairline rounded-card hover:bg-surface-1 transition-colors group">
                <div className="bg-surface-2 text-ink-muted p-2 rounded-control group-hover:bg-accent group-hover:text-on-accent transition-colors">
                  <UserPlus size={20} />
                </div>
                <div>
                  <p className="font-semibold text-ink">Manage Users</p>
                  <p className="caption">Add, view or remove users.</p>
                </div>
              </Link>
            )}
            <Link to="/workflows"
              className="flex items-center gap-4 p-4 border border-hairline rounded-card hover:bg-surface-1 transition-colors group">
              <div className="bg-surface-2 text-ink-muted p-2 rounded-control group-hover:bg-accent group-hover:text-on-accent transition-colors">
                <GitBranch size={20} />
              </div>
              <div>
                <p className="font-semibold text-ink">Manage Workflows</p>
                <p className="caption">Create, edit or clone workflow templates.</p>
              </div>
            </Link>
            <Link to="/assign"
              className="flex items-center gap-4 p-4 border border-hairline rounded-card hover:bg-surface-1 transition-colors group">
              <div className="bg-surface-2 text-ink-muted p-2 rounded-control group-hover:bg-accent group-hover:text-on-accent transition-colors">
                <CheckCircle size={20} />
              </div>
              <div>
                <p className="font-semibold text-ink">Assign Task</p>
                <p className="caption">Kick off a new workflow for an employee.</p>
              </div>
            </Link>
            {role === 'Admin' && (
              <Link to="/audit"
                className="flex items-center gap-4 p-4 border border-hairline rounded-card hover:bg-surface-1 transition-colors group">
                <div className="bg-surface-2 text-ink-muted p-2 rounded-control group-hover:bg-accent group-hover:text-on-accent transition-colors">
                  <FileSearch size={20} />
                </div>
                <div>
                  <p className="font-semibold text-ink">Audit Logs</p>
                  <p className="caption">Monitor all system activity and compliance.</p>
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