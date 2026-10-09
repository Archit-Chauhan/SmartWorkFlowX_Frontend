import React, { useEffect, useState, useCallback } from 'react';
import axiosInstance from '../../api/axiosInstance';
import type { TaskItem, TaskCategory } from '../../models';
import { Flag, AlertTriangle, RotateCcw, ChevronDown, ChevronUp, CheckCircle, XCircle, ListFilter } from 'lucide-react';
import EmptyState from '../../components/EmptyState';
import type { TaskStepHistory } from '../../models';

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
        <h2 className="page-title flex items-center gap-2">
          <ListFilter className="text-accent" size={24} /> All Tasks
        </h2>
        <p className="caption mt-1">
          {loading ? 'Loading...' : `${tasks.length} task${tasks.length !== 1 ? 's' : ''} found`}
        </p>
      </div>

      {/* Filter Bar */}
      <div className="card p-4 space-y-4">
        <div className="flex flex-wrap gap-3">
          {/* Status filter */}
          <div className="flex-1 min-w-[140px]">
            <label className="label">Status</label>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="input"
            >
              <option value="">All statuses</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Priority filter */}
          <div className="flex-1 min-w-[140px]">
            <label className="label">Priority</label>
            <select
              value={filterPriority}
              onChange={e => setFilterPriority(e.target.value)}
              className="input"
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
                className="btn btn-secondary"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>

        {/* Category filter pills */}
        {categories.length > 0 && (
          <div>
            <p className="label">Category</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilterCategoryId(null)}
                className={`btn btn-sm rounded-pill ${
                  !filterCategoryId ? 'btn-primary' : 'btn-secondary'
                }`}
              >
                All
              </button>
              {categories.map(c => (
                <button
                  key={c.categoryId}
                  onClick={() => setFilterCategoryId(filterCategoryId === c.categoryId ? null : c.categoryId)}
                  className="btn btn-sm rounded-pill bg-transparent"
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
        <div className="empty-state flex justify-center items-center h-48">
          <Flag size={20} className="animate-pulse mr-2" /> Loading tasks...
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState illustration="empty" title="No tasks match the current filters." hint="Try clearing a filter to see more." />
      ) : (
        <div className="space-y-3">
          {tasks.map(task => (
            <div
              key={task.taskId}
              className={`card overflow-hidden ${isOverdue(task) ? 'border-error' : ''}`}
            >
              <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                  <div className={`chip ${PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.Medium} p-2 flex-shrink-0 rounded-control`}>
                    <Flag size={16} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-ink truncate">{task.title}</h4>
                    <p className="caption mt-0.5">
                      {task.workflowTitle || 'No workflow'} · Step {task.currentStepOrder}
                      {task.assigneeName && <> · <span className="text-ink font-medium">{task.assigneeName}</span></>}
                      {task.dueDate && (
                        <> ·{' '}
                          <span className={`font-mono ${isOverdue(task) ? 'text-error font-semibold' : ''}`}>
                            Due {new Date(task.dueDate).toLocaleDateString()}
                          </span>
                        </>
                      )}
                    </p>
                    {task.description && (
                      <p className="text-xs text-ink-muted mt-1 line-clamp-2">{task.description}</p>
                    )}
                    {task.rejectedReason && (
                      <p className="text-xs text-error mt-1 flex items-center gap-1">
                        <RotateCcw size={10} /> Rejected: {task.rejectedReason}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                  {isOverdue(task) && (
                    <span className="chip chip-rejected uppercase tracking-wide">
                      <AlertTriangle size={11} /> Overdue
                    </span>
                  )}
                  {task.categoryName && (
                    <span
                      className="chip"
                      style={{ backgroundColor: `${task.categoryColor}22`, color: task.categoryColor, border: `1px solid ${task.categoryColor}44` }}
                    >
                      {task.categoryName}
                    </span>
                  )}
                  <span className={`chip ${PRIORITY_STYLES[task.priority]}`}>
                    {task.priority}
                  </span>
                  <span className={`chip ${STATUS_STYLES[task.status] || STATUS_STYLES.Pending}`}>
                    {task.status}
                  </span>
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
          ))}
        </div>
      )}
    </div>
  );
};

export default AllTasks;
