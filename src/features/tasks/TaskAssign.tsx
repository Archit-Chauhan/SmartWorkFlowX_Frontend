import React, { useEffect, useState } from 'react';
import axiosInstance from '../../api/axiosInstance';
import type { Workflow, TaskCreateRequest, TaskPriority } from '../../models';
import { Send, ClipboardList } from 'lucide-react';

interface User { userId: number; name: string; email: string; roleName: string; }

const TaskAssign: React.FC = () => {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [workflowId, setWorkflowId] = useState<number>(0);
  const [assignedTo, setAssignedTo] = useState<number>(0);
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [dueDate, setDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const load = async () => {
      const [wf, u] = await Promise.all([
        axiosInstance.get<Workflow[]>('/Workflow'),
        axiosInstance.get<User[]>('/Admin/users'),
      ]);
      setWorkflows(wf.data.filter(w => w.status === 'Active'));
      setUsers(u.data);
      setLoading(false);
    };
    load();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workflowId || !assignedTo) {
      setMessage({ type: 'error', text: 'Please select a workflow and a user.' });
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const body: TaskCreateRequest = {
        title, description, workflowId, assignedTo: Number(assignedTo),
        priority, dueDate: dueDate || undefined,
      };
      await axiosInstance.post('/Task/assign', body);
      setMessage({ type: 'success', text: `Task "${title}" assigned successfully!` });
      setTitle(''); setDescription(''); setWorkflowId(0); setAssignedTo(0);
      setPriority('Medium'); setDueDate('');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to assign task.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="text-center py-16 text-gray-400">Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <ClipboardList className="text-blue-600" /> Assign New Task
        </h2>
        <p className="text-gray-500 mt-1">Start a workflow for an employee by assigning a task.</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
        <div className="grid gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Task Title <span className="text-red-500">*</span></label>
            <input
              required
              className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-200 outline-none"
              placeholder="e.g. Q1 Expense Report Approval"
              value={title} onChange={e => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              className="w-full border border-gray-200 rounded-lg p-3 text-sm resize-none focus:ring-2 focus:ring-blue-200 outline-none"
              rows={3}
              placeholder="Any additional context for the assignee..."
              value={description} onChange={e => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Workflow (Active only) <span className="text-red-500">*</span></label>
              <select
                required
                className="w-full border border-gray-200 rounded-lg p-3 text-sm bg-white focus:ring-2 focus:ring-blue-200 outline-none"
                value={workflowId}
                onChange={e => setWorkflowId(parseInt(e.target.value))}
              >
                <option value={0} disabled>Select workflow...</option>
                {workflows.map(w => <option key={w.workflowId} value={w.workflowId}>{w.title} ({w.stepCount} steps)</option>)}
              </select>
              {workflows.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">⚠ No active workflows. Activate one in Workflows first.</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assign To <span className="text-red-500">*</span></label>
              <select
                required
                className="w-full border border-gray-200 rounded-lg p-3 text-sm bg-white focus:ring-2 focus:ring-blue-200 outline-none"
                value={assignedTo}
                onChange={e => setAssignedTo(parseInt(e.target.value))}
              >
                <option value={0} disabled>Select user...</option>
                {users.map(u => <option key={u.userId} value={u.userId}>{u.name} — {u.roleName}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <div className="flex gap-2">
                {(['Low', 'Medium', 'High'] as TaskPriority[]).map(p => (
                  <button
                    key={p} type="button"
                    onClick={() => setPriority(p)}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-all ${
                      priority === p
                        ? p === 'High' ? 'bg-red-500 text-white border-red-500'
                          : p === 'Medium' ? 'bg-yellow-500 text-white border-yellow-500'
                          : 'bg-green-500 text-white border-green-500'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >{p}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date (optional)</label>
              <input
                type="date"
                className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-200 outline-none"
                value={dueDate} onChange={e => setDueDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>
        </div>

        {message && (
          <div className={`px-4 py-3 rounded-lg text-sm font-medium ${
            message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {message.text}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || workflows.length === 0}
          className="w-full bg-blue-600 text-white py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-60 font-semibold transition-colors"
        >
          <Send size={17} />
          {submitting ? 'Assigning...' : 'Assign Task'}
        </button>
      </form>
    </div>
  );
};

export default TaskAssign;
