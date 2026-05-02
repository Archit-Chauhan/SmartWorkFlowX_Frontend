import React, { useEffect, useState } from 'react';
import axiosInstance from '../../api/axiosInstance';
import type { TaskItem, TaskStepHistory, TaskRejectRequest, PaginatedResponse } from '../../models';
import {
  CheckCircle, Clock, XCircle, AlertTriangle,
  ChevronDown, ChevronUp, RotateCcw, Flag, Activity
} from 'lucide-react';
import Pagination from '../../components/Pagination';

const PRIORITY_STYLES: Record<string, string> = {
  High:   'bg-red-100 text-red-700 border-red-200',
  Medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  Low:    'bg-green-100 text-green-700 border-green-200',
};

const STATUS_STYLES: Record<string, string> = {
  Completed:   'bg-emerald-100 text-emerald-700',
  'In Progress': 'bg-blue-100 text-blue-700',
  Cancelled:   'bg-gray-100 text-gray-500',
  Rejected:    'bg-red-100 text-red-600',
  Pending:     'bg-yellow-100 text-yellow-700',
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

  const renderTaskCard = (task: TaskItem, showActions: boolean) => (
    <div key={task.taskId} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Main Row */}
      <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div className="flex items-start sm:items-center gap-3 sm:gap-4 flex-1 min-w-0">
          {/* Priority flag */}
          <div className={`p-2 flex-shrink-0 rounded-lg border ${PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.Medium}`}>
            <Flag size={16} />
          </div>
          <div className="min-w-0">
            <h4 className="font-semibold text-gray-800 truncate">{task.title}</h4>
            <p className="text-xs text-gray-400 mt-0.5">
              Step {task.currentStepOrder} ·{' '}
              {task.workflowTitle || 'Workflow'} ·{' '}
              {task.dueDate ? `Due ${new Date(task.dueDate).toLocaleDateString()}` : 'No due date'}
            </p>
            {task.rejectedReason && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <RotateCcw size={10} /> Sent back: {task.rejectedReason}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 flex-shrink-0">
          {/* Priority badge */}
          <span className={`text-xs font-bold px-2 py-1 rounded-full border ${PRIORITY_STYLES[task.priority]}`}>
            {task.priority}
          </span>

          {/* Status badge */}
          <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase ${STATUS_STYLES[task.status] || STATUS_STYLES.Pending}`}>
            {task.status}
          </span>

          {/* Actions — only in Action Center tab */}
          {showActions && isActive(task) && (
            <>
              <button
                onClick={() => handleApprove(task)}
                disabled={actionLoading === task.taskId}
                className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 transition-colors"
              >
                <CheckCircle size={15} />
                {task.currentStepOrder === 0 ? 'Complete' : 'Approve'}
              </button>
              <button
                onClick={() => setRejectModalTask(task)}
                disabled={actionLoading === task.taskId}
                className="flex items-center gap-1.5 bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-lg hover:bg-red-100 text-sm font-medium disabled:opacity-50 transition-colors"
              >
                <XCircle size={15} />
                Reject
              </button>
            </>
          )}

          {/* Expand toggle */}
          <button
            onClick={() => toggleExpand(task.taskId)}
            className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            title="View approval history"
          >
            {expandedId === task.taskId ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {/* History Panel */}
      {expandedId === task.taskId && (
        <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Approval History</p>
          {(history[task.taskId] ?? []).length === 0 ? (
            <p className="text-xs text-gray-400 italic">No actions taken yet.</p>
          ) : (
            <div className="space-y-2">
              {(history[task.taskId] ?? []).map((h, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                    h.action === 'Approved' || h.action === 'Completed' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                  }`}>
                    {h.action === 'Approved' || h.action === 'Completed' ? <CheckCircle size={12} /> : <XCircle size={12} />}
                  </div>
                  <span className="font-medium text-gray-700">Step {h.stepOrder}</span>
                  <span className={`font-semibold ${h.action === 'Approved' || h.action === 'Completed' ? 'text-green-600' : 'text-red-500'}`}>
                    {h.action}
                  </span>
                  <span className="text-gray-500">by {h.actedByName}</span>
                  {h.comment && <span className="text-gray-400 italic">· "{h.comment}"</span>}
                  <span className="ml-auto text-gray-400 text-xs">{new Date(h.actedAt).toLocaleString()}</span>
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
          <h2 className="text-2xl font-bold text-gray-800">
            {activeTab === 'action' ? 'Action Center' : 'My Activity'}
          </h2>
          <p className="text-sm text-gray-500">
            {activeTab === 'action'
              ? `${actionTotal} task${actionTotal !== 1 ? 's' : ''} assigned to you`
              : `${activityTotal} task${activityTotal !== 1 ? 's' : ''} you've acted on`}
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex bg-gray-100 rounded-lg p-1 self-start">
          <button
            onClick={() => setActiveTab('action')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'action'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <CheckCircle size={15} />
            Action Center
            {actionTotal > 0 && (
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold ${
                activeTab === 'action' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'
              }`}>
                {actionTotal}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'activity'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Activity size={15} />
            My Activity
          </button>
        </div>
      </div>

      {/* Content */}
      {isCurrentLoading ? (
        <div className="flex justify-center items-center h-48 text-gray-400">
          <Clock size={20} className="animate-spin mr-2" /> Loading tasks...
        </div>
      ) : currentList.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          {activeTab === 'action' ? (
            <>
              <CheckCircle size={40} className="mx-auto mb-3 text-green-400" />
              <p className="font-medium">All clear! No tasks assigned to you.</p>
            </>
          ) : (
            <>
              <Activity size={40} className="mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No activity yet.</p>
              <p className="text-sm mt-1">Tasks you complete or approve will appear here.</p>
            </>
          )}
        </div>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">Reject Task</h3>
                <p className="text-xs text-gray-500">{rejectModalTask.title}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-red-300 focus:border-red-400 outline-none"
                  placeholder="e.g. Missing documentation, Budget exceeded..."
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Additional Comment (optional)</label>
                <textarea
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm resize-none focus:ring-2 focus:ring-red-300 focus:border-red-400 outline-none"
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
                className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectSubmit}
                disabled={!rejectReason.trim() || actionLoading !== null}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
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