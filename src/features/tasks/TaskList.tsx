import React, { useEffect, useState } from 'react';
import axiosInstance from '../../api/axiosInstance';
import type { TaskItem, TaskStepHistory, TaskRejectRequest, PaginatedResponse } from '../../models';
import {
  CheckCircle, Clock, XCircle, AlertTriangle,
  ChevronDown, ChevronUp, RotateCcw, Flag, Activity
} from 'lucide-react';
import Pagination from '../../components/Pagination';
import EmptyState from '../../components/EmptyState';

const PRIORITY_STYLES: Record<string, string> = {
  High:   'chip-rejected',
  Medium: 'chip-warning',
  Low:    'chip-neutral',
};

const STATUS_STYLES: Record<string, string> = {
  Completed:   'chip-completed',
  'In Progress': 'chip-progress',
  Cancelled:   'chip-rejected',
  Rejected:    'chip-rejected',
  Pending:     'chip-pending',
};

type Tab = 'action' | 'activity';

const TaskList: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('action');
  
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [actionPage, setActionPage] = useState(1);
  const [actionTotal, setActionTotal] = useState(0);

  const [activityTasks, setActivityTasks] = useState<TaskItem[]>([]);
  const [activityPage, setActivityPage] = useState(1);
  const [activityTotal, setActivityTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [history, setHistory] = useState<Record<number, TaskStepHistory[]>>({});
  const [rejectModalTask, setRejectModalTask] = useState<TaskItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectComment, setRejectComment] = useState('');
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const limit = 10;

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get<PaginatedResponse<TaskItem>>(`/Task/my-tasks?page=${actionPage}&limit=${limit}`);
      setTasks(res.data.data);
      setActionTotal(res.data.total);
    } finally {
      setLoading(false);
    }
  };

  const fetchActivity = async () => {
    setActivityLoading(true);
    try {
      const res = await axiosInstance.get<PaginatedResponse<TaskItem>>(`/Task/my-activity?page=${activityPage}&limit=${limit}`);
      setActivityTasks(res.data.data);
      setActivityTotal(res.data.total);
    } finally {
      setActivityLoading(false);
    }
  };

  useEffect(() => { fetchTasks(); }, [actionPage]);

  useEffect(() => {
    if (activeTab === 'activity') {
      fetchActivity();
    }
  }, [activeTab, activityPage]);

  const loadHistory = async (taskId: number) => {
    if (history[taskId]) return;
    const res = await axiosInstance.get<TaskStepHistory[]>(`/Task/${taskId}/history`);
    setHistory(prev => ({ ...prev, [taskId]: res.data }));
  };

  const toggleExpand = (taskId: number) => {
    if (expandedId === taskId) {
      setExpandedId(null);
    } else {
      setExpandedId(taskId);
      loadHistory(taskId);
    }
  };

  const handleApprove = async (task: TaskItem) => {
    setActionLoading(task.taskId);
    try {
      await axiosInstance.post(`/Task/${task.taskId}/approve`, null);
      await fetchTasks();
      setHistory(prev => { const n = { ...prev }; delete n[task.taskId]; return n; });
      if (activeTab === 'activity') fetchActivity();
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectModalTask || !rejectReason.trim()) return;
    setActionLoading(rejectModalTask.taskId);
    try {
      const body: TaskRejectRequest = { reason: rejectReason, comment: rejectComment };
      await axiosInstance.post(`/Task/${rejectModalTask.taskId}/reject`, body);
      setRejectModalTask(null);
      setRejectReason('');
      setRejectComment('');
      await fetchTasks();
      setHistory(prev => { const n = { ...prev }; delete n[rejectModalTask.taskId]; return n; });
      if (activeTab === 'activity') fetchActivity();
    } finally {
      setActionLoading(null);
    }
  };

  const isActive = (t: TaskItem) => t.status !== 'Completed' && t.status !== 'Cancelled';
  const isOverdue = (t: TaskItem) => !!t.dueDate && new Date(t.dueDate) < new Date() && isActive(t);

  const renderTaskCard = (task: TaskItem, showActions: boolean) => (
    <div key={task.taskId} className={`card overflow-hidden ${isOverdue(task) ? 'border-error' : ''}`}>
      {/* Main Row */}
      <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
          {/* Priority flag */}
          <div className={`chip ${PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.Medium} p-2 flex-shrink-0 rounded-control`}>
            <Flag size={16} />
          </div>
          <div className="min-w-0">
            <h4 className="font-semibold text-ink truncate">{task.title}</h4>
            <p className="caption mt-0.5">
              Step {task.currentStepOrder} ·{' '}
              {task.workflowTitle || 'Workflow'} ·{' '}
              <span className={`font-mono ${task.dueDate && isOverdue(task) ? 'text-error font-semibold' : ''}`}>
                {task.dueDate ? `Due ${new Date(task.dueDate).toLocaleDateString()}` : 'No due date'}
              </span>
            </p>
            {task.description && (
              <p className="text-xs text-ink-muted mt-1 line-clamp-2">{task.description}</p>
            )}
            {task.rejectedReason && (
              <p className="text-xs text-error mt-1 flex items-center gap-1">
                <RotateCcw size={10} /> Sent back: {task.rejectedReason}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
          {/* Overdue badge */}
          {isOverdue(task) && (
            <span className="chip chip-rejected uppercase tracking-wide">
              Overdue
            </span>
          )}

          {/* Category badge */}
          {task.categoryName && (
            <span
              className="chip"
              style={{ backgroundColor: `${task.categoryColor}22`, color: task.categoryColor, border: `1px solid ${task.categoryColor}44` }}
            >
              {task.categoryName}
            </span>
          )}

          {/* Priority badge */}
          <span className={`chip ${PRIORITY_STYLES[task.priority]}`}>
            {task.priority}
          </span>

          {/* Status badge */}
          <span className={`chip ${STATUS_STYLES[task.status] || STATUS_STYLES.Pending}`}>
            {task.status}
          </span>

          {/* Actions — only in Action Center tab */}
          {showActions && isActive(task) && (
            <>
              <button
                onClick={() => handleApprove(task)}
                disabled={actionLoading === task.taskId}
                className="btn btn-primary btn-sm"
              >
                <CheckCircle size={15} />
                {task.currentStepOrder === 0 ? 'Complete' : 'Approve'}
              </button>
              <button
                onClick={() => setRejectModalTask(task)}
                disabled={actionLoading === task.taskId}
                className="btn btn-ghost btn-sm text-error"
              >
                <XCircle size={15} />
                Reject
              </button>
            </>
          )}

          {/* Expand toggle */}
          <button
            onClick={() => toggleExpand(task.taskId)}
            className="btn btn-ghost btn-sm px-2"
            title="View approval history"
          >
            {expandedId === task.taskId ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {/* History Panel */}
      {expandedId === task.taskId && (
        <div className="border-t border-hairline bg-surface-1 px-5 py-4">
          <p className="caption font-semibold uppercase tracking-wider mb-3">Approval History</p>
          {(history[task.taskId] ?? []).length === 0 ? (
            <p className="text-xs text-ink-subtle italic">No actions taken yet.</p>
          ) : (
            <div className="space-y-2">
              {(history[task.taskId] ?? []).map((h, i) => (
                <div key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm [&>span]:whitespace-nowrap [&>span:nth-child(5)]:whitespace-normal">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                    h.action === 'Approved' || h.action === 'Completed' ? 'bg-surface-2 text-success' : 'bg-surface-2 text-error'
                  }`}>
                    {h.action === 'Approved' || h.action === 'Completed' ? <CheckCircle size={12} /> : <XCircle size={12} />}
                  </div>
                  <span className="font-medium text-ink">Step {h.stepOrder}</span>
                  <span className={`font-semibold ${h.action === 'Approved' || h.action === 'Completed' ? 'text-success' : 'text-error'}`}>
                    {h.action}
                  </span>
                  <span className="text-ink-muted">by {h.actedByName}</span>
                  {h.comment && <span className="text-ink-subtle italic">· "{h.comment}"</span>}
                  <span className="ml-auto text-ink-subtle text-xs font-mono">{new Date(h.actedAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const currentList = activeTab === 'action' ? tasks : activityTasks;
  const isCurrentLoading = activeTab === 'action' ? loading : activityLoading;
  
  const currentPage = activeTab === 'action' ? actionPage : activityPage;
  const currentTotal = activeTab === 'action' ? actionTotal : activityTotal;
  const totalPages = Math.ceil(currentTotal / limit);

  return (
    <div className="space-y-6">
      {/* Header with tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="page-title">
            {activeTab === 'action' ? 'Action Center' : 'My Activity'}
          </h2>
          <p className="caption">
            {activeTab === 'action'
              ? `${actionTotal} task${actionTotal !== 1 ? 's' : ''} assigned to you`
              : `${activityTotal} task${activityTotal !== 1 ? 's' : ''} you've acted on`}
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex bg-surface-1 border border-hairline rounded-control p-1 self-start">
          <button
            onClick={() => setActiveTab('action')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-control text-sm font-medium transition-colors ${
              activeTab === 'action'
                ? 'bg-accent-soft text-accent'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            <CheckCircle size={15} />
            Action Center
            {actionTotal > 0 && (
              <span className={`chip ml-1 ${
                activeTab === 'action' ? 'bg-accent text-on-accent' : 'chip-neutral'
              }`}>
                {actionTotal}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-control text-sm font-medium transition-colors ${
              activeTab === 'activity'
                ? 'bg-accent-soft text-accent'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            <Activity size={15} />
            My Activity
          </button>
        </div>
      </div>

      {/* Content */}
      {isCurrentLoading ? (
        <div className="empty-state flex justify-center items-center h-48">
          <Clock size={20} className="animate-spin mr-2" /> Loading tasks...
        </div>
      ) : currentList.length === 0 ? (
        activeTab === 'action' ? (
          <EmptyState illustration="task-list" title="All clear! No tasks assigned to you." hint="New work shows up here as soon as it is assigned." />
        ) : (
          <EmptyState illustration="empty" title="No activity yet." hint="Tasks you complete or approve will appear here." />
        )
      ) : (
        <div className="space-y-3">
          {currentList.map(task => renderTaskCard(task, activeTab === 'action'))}
          
          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={currentTotal}
              pageSize={limit}
              onPageChange={(page) => {
                if (activeTab === 'action') setActionPage(page);
                else setActivityPage(page);
              }}
            />
          )}
        </div>
      )}

      {/* Reject Modal */}
      {rejectModalTask && (
        <div className="fixed inset-0 bg-overlay flex items-center justify-center z-50 p-4">
          <div className="bg-canvas border border-hairline rounded-card shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 chip-rejected rounded-control">
                <AlertTriangle size={20} className="text-error" />
              </div>
              <div>
                <h3 className="section-title">Reject Task</h3>
                <p className="caption">{rejectModalTask.title}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="label">
                  Reason <span className="text-error">*</span>
                </label>
                <input
                  className="input"
                  placeholder="e.g. Missing documentation, Budget exceeded..."
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Additional Comment (optional)</label>
                <textarea
                  className="input resize-none"
                  rows={3}
                  placeholder="Any additional notes for the assignee..."
                  value={rejectComment}
                  onChange={e => setRejectComment(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setRejectModalTask(null); setRejectReason(''); setRejectComment(''); }}
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectSubmit}
                disabled={!rejectReason.trim() || actionLoading !== null}
                className="btn btn-danger flex-1"
              >
                {actionLoading ? 'Rejecting...' : 'Submit Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskList;