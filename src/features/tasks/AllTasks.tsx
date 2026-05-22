import React, { useEffect, useState, useCallback } from 'react';
import axiosInstance from '../../api/axiosInstance';
import type { TaskItem, TaskCategory } from '../../models';
import { Flag, AlertTriangle, RotateCcw, ChevronDown, ChevronUp, CheckCircle, XCircle, ListFilter } from 'lucide-react';
import type { TaskStepHistory } from '../../models';

const PRIORITY_STYLES: Record<string, string> = {
  High:   'bg-red-100 text-red-700 border-red-200',
  Medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  Low:    'bg-green-100 text-green-700 border-green-200',
};

const STATUS_STYLES: Record<string, string> = {
  Completed:    'bg-emerald-100 text-emerald-700',
  'In Progress':'bg-blue-100 text-blue-700',
  Cancelled:    'bg-gray-100 text-gray-500',
  Rejected:     'bg-red-100 text-red-600',
  Pending:      'bg-yellow-100 text-yellow-700',
};

const STATUSES = ['In Progress', 'Completed', 'Cancelled', 'Pending'];
const PRIORITIES = ['Low', 'Medium', 'High'];

interface AllTaskItem extends TaskItem {
  assigneeName?: string;
}

const AllTasks: React.FC = () => {
  const [tasks, setTasks] = useState<AllTaskItem[]>([]);
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState<number | null>(null);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [history, setHistory] = useState<Record<number, TaskStepHistory[]>>({});

  const isOverdue = (t: AllTaskItem) =>
    !!t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'Completed' && t.status !== 'Cancelled';

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus)      params.set('status', filterStatus);
      if (filterPriority)    params.set('priority', filterPriority);
      if (filterCategoryId)  params.set('categoryId', String(filterCategoryId));
      const res = await axiosInstance.get<AllTaskItem[]>(`/Task/all?${params.toString()}`);
      setTasks(res.data);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterPriority, filterCategoryId]);

  useEffect(() => {
    axiosInstance.get<TaskCategory[]>('/Task/categories').then(r => setCategories(r.data));
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

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

  const clearFilters = () => {
    setFilterStatus('');
    setFilterPriority('');
    setFilterCategoryId(null);
  };

  const hasActiveFilters = filterStatus || filterPriority || filterCategoryId;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <ListFilter className="text-blue-600" size={24} /> All Tasks
        </h2>
        <p className="text-gray-500 mt-1">
          {loading ? 'Loading...' : `${tasks.length} task${tasks.length !== 1 ? 's' : ''} found`}
        </p>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-4">
        <div className="flex flex-wrap gap-3">
          {/* Status filter */}
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-200 outline-none"
            >
              <option value="">All statuses</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Priority filter */}
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Priority</label>
            <select
              value={filterPriority}
              onChange={e => setFilterPriority(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-200 outline-none"
            >
              <option value="">All priorities</option>
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {/* Clear button */}
          {hasActiveFilters && (
            <div className="flex items-end">
              <button
                onClick={clearFilters}
                className="px-3 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>

        {/* Category filter pills */}
        {categories.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Category</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilterCategoryId(null)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  !filterCategoryId ? 'bg-gray-700 text-white border-gray-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                All
              </button>
              {categories.map(c => (
                <button
                  key={c.categoryId}
                  onClick={() => setFilterCategoryId(filterCategoryId === c.categoryId ? null : c.categoryId)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
                  style={
                    filterCategoryId === c.categoryId
                      ? { backgroundColor: c.colorHex, color: '#fff', borderColor: c.colorHex }
                      : { borderColor: c.colorHex, color: c.colorHex }
                  }
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Task List */}
      {loading ? (
        <div className="flex justify-center items-center h-48 text-gray-400">
          <Flag size={20} className="animate-pulse mr-2" /> Loading tasks...
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ListFilter size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="font-medium">No tasks match the current filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map(task => (
            <div
              key={task.taskId}
              className={`bg-white rounded-xl border shadow-sm overflow-hidden ${isOverdue(task) ? 'border-red-300' : 'border-gray-200'}`}
            >
              <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                <div className="flex items-start sm:items-center gap-3 sm:gap-4 flex-1 min-w-0">
                  <div className={`p-2 flex-shrink-0 rounded-lg border ${PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.Medium}`}>
                    <Flag size={16} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-gray-800 truncate">{task.title}</h4>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {task.workflowTitle || 'No workflow'} · Step {task.currentStepOrder}
                      {task.assigneeName && <> · <span className="text-gray-600 font-medium">{task.assigneeName}</span></>}
                      {task.dueDate && (
                        <> ·{' '}
                          <span className={isOverdue(task) ? 'text-red-500 font-semibold' : ''}>
                            Due {new Date(task.dueDate).toLocaleDateString()}
                          </span>
                        </>
                      )}
                    </p>
                    {task.description && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{task.description}</p>
                    )}
                    {task.rejectedReason && (
                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <RotateCcw size={10} /> Rejected: {task.rejectedReason}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:gap-3 flex-shrink-0">
                  {isOverdue(task) && (
                    <span className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full bg-red-100 text-red-600 border border-red-200 uppercase tracking-wide">
                      <AlertTriangle size={11} /> Overdue
                    </span>
                  )}
                  {task.categoryName && (
                    <span
                      className="text-xs font-semibold px-2 py-1 rounded-full"
                      style={{ backgroundColor: `${task.categoryColor}22`, color: task.categoryColor, border: `1px solid ${task.categoryColor}44` }}
                    >
                      {task.categoryName}
                    </span>
                  )}
                  <span className={`text-xs font-bold px-2 py-1 rounded-full border ${PRIORITY_STYLES[task.priority]}`}>
                    {task.priority}
                  </span>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase ${STATUS_STYLES[task.status] || STATUS_STYLES.Pending}`}>
                    {task.status}
                  </span>
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
          ))}
        </div>
      )}
    </div>
  );
};

export default AllTasks;
