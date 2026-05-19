import React, { useEffect, useState } from 'react';
import axiosInstance from '../../api/axiosInstance';
import type { Workflow, TaskCreateRequest, TaskPriority, PaginatedResponse } from '../../models';
import { Send, ClipboardList } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

interface User { userId: number; name: string; email: string; roleName: string; }

const taskAssignSchema = z.object({
  title: z.string().min(1, 'Task Title is required'),
  description: z.string().optional(),
  workflowId: z.coerce.number().min(1, 'Please select a workflow'),
  assignedTo: z.coerce.number().min(1, 'Please select a user'),
  priority: z.enum(['Low', 'Medium', 'High']),
  dueDate: z.string().optional()
});

type TaskAssignFormValues = z.infer<typeof taskAssignSchema>;

const TaskAssign: React.FC = () => {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<TaskAssignFormValues>({
    resolver: zodResolver(taskAssignSchema),
    defaultValues: {
      workflowId: 0,
      assignedTo: 0,
      priority: 'Medium',
      title: '',
      description: '',
      dueDate: ''
    }
  });

  const priorityValue = watch('priority');

  useEffect(() => {
    const load = async () => {
      try {
        const [wf, u] = await Promise.all([
          axiosInstance.get<PaginatedResponse<Workflow>>('/Workflow?page=1&limit=1000'),
          axiosInstance.get<PaginatedResponse<User>>('/Admin/users?page=1&limit=1000'),
        ]);
        setWorkflows(wf.data.data.filter(w => w.status === 'Active'));
        setUsers(u.data.data);
      } catch (err) {
        console.error("Failed to load data", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const onSubmit = async (data: TaskAssignFormValues) => {
    setMessage(null);
    try {
      const body: TaskCreateRequest = {
        title: data.title, 
        description: data.description || '', 
        workflowId: data.workflowId, 
        assignedTo: data.assignedTo,
        priority: data.priority, 
        dueDate: data.dueDate || undefined,
      };
      await axiosInstance.post('/Task/assign', body);
      setMessage({ type: 'success', text: `Task "${data.title}" assigned successfully!` });
      reset({
        workflowId: 0,
        assignedTo: 0,
        priority: 'Medium',
        title: '',
        description: '',
        dueDate: ''
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to assign task.' });
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

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
        <div className="grid gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Task Title <span className="text-red-500">*</span></label>
            <input
              className={`w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-200 outline-none ${errors.title ? 'border-red-500' : 'border-gray-200'}`}
              placeholder="e.g. Q1 Expense Report Approval"
              {...register('title')}
            />
            {errors.title && <p className="mt-1 text-sm text-red-500">{errors.title.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              className="w-full border border-gray-200 rounded-lg p-3 text-sm resize-none focus:ring-2 focus:ring-blue-200 outline-none"
              rows={3}
              placeholder="Any additional context for the assignee..."
              {...register('description')}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Workflow (Active only) <span className="text-red-500">*</span></label>
              <select
                className={`w-full border rounded-lg p-3 text-sm bg-white focus:ring-2 focus:ring-blue-200 outline-none ${errors.workflowId ? 'border-red-500' : 'border-gray-200'}`}
                {...register('workflowId')}
              >
                <option value={0} disabled>Select workflow...</option>
                {workflows.map(w => <option key={w.workflowId} value={w.workflowId}>{w.title} ({w.stepCount} steps)</option>)}
              </select>
              {errors.workflowId && <p className="mt-1 text-sm text-red-500">{errors.workflowId.message}</p>}
              {workflows.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">⚠ No active workflows. Activate one in Workflows first.</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assign To <span className="text-red-500">*</span></label>
              <select
                className={`w-full border rounded-lg p-3 text-sm bg-white focus:ring-2 focus:ring-blue-200 outline-none ${errors.assignedTo ? 'border-red-500' : 'border-gray-200'}`}
                {...register('assignedTo')}
              >
                <option value={0} disabled>Select user...</option>
                {users.map(u => <option key={u.userId} value={u.userId}>{u.name} — {u.roleName}</option>)}
              </select>
              {errors.assignedTo && <p className="mt-1 text-sm text-red-500">{errors.assignedTo.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <div className="flex flex-col sm:flex-row gap-2">
                {(['Low', 'Medium', 'High'] as TaskPriority[]).map(p => (
                  <button
                    key={p} type="button"
                    onClick={() => setValue('priority', p)}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-all ${
                      priorityValue === p
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
                {...register('dueDate')}
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
          disabled={isSubmitting || workflows.length === 0}
          className="w-full bg-blue-600 text-white py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-60 font-semibold transition-colors"
        >
          <Send size={17} />
          {isSubmitting ? 'Assigning...' : 'Assign Task'}
        </button>
      </form>
    </div>
  );
};

export default TaskAssign;
