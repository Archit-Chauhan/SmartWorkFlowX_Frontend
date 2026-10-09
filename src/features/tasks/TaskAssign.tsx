import React, { useEffect, useState } from 'react';
import axiosInstance from '../../api/axiosInstance';
import type { Workflow, TaskCreateRequest, TaskPriority, PaginatedResponse, TaskCategory } from '../../models';
import { Send, Sparkles } from 'lucide-react';
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
  dueDate: z.string().optional(),
  categoryId: z.coerce.number().optional()
});

type TaskAssignFormValues = z.infer<typeof taskAssignSchema>;

const TaskAssign: React.FC = () => {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [formalizing, setFormalizing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<TaskAssignFormValues>({
    resolver: zodResolver(taskAssignSchema) as any,
    defaultValues: {
      workflowId: 0,
      assignedTo: 0,
      priority: 'Medium',
      title: '',
      description: '',
      dueDate: '',
      categoryId: undefined
    }
  });

  const priorityValue = watch('priority');
  const descriptionValue = watch('description');

  const handleFormalize = async () => {
    const raw = descriptionValue?.trim();
    if (!raw) return;
    setFormalizing(true);
    try {
      const res = await axiosInstance.post<{ formalizedText: string }>('/Task/formalize-description', { rawText: raw, context: 'task' });
      setValue('description', res.data.formalizedText);
    } catch {
      // silently fail — user keeps their original text
    } finally {
      setFormalizing(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [wf, u, cats] = await Promise.allSettled([
          axiosInstance.get<PaginatedResponse<Workflow>>('/Workflow?page=1&limit=1000'),
          axiosInstance.get<User[]>('/Task/assignable-users'),
          axiosInstance.get<TaskCategory[]>('/Task/categories'),
        ]);
        if (wf.status === 'fulfilled') setWorkflows(wf.value.data.data.filter(w => w.status === 'Active'));
        if (u.status === 'fulfilled') setUsers(u.value.data);
        if (cats.status === 'fulfilled') setCategories(cats.value.data);
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
        categoryId: data.categoryId || undefined,
      };
      await axiosInstance.post('/Task/assign', body);
      setMessage({ type: 'success', text: `Task "${data.title}" assigned successfully!` });
      reset({
        workflowId: 0,
        assignedTo: 0,
        priority: 'Medium',
        title: '',
        description: '',
        dueDate: '',
        categoryId: undefined
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to assign task.' });
    }
  };

  if (loading) return <div className="empty-state">Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="sr-only">Assign Task</h1>
        <p className="caption">Start a workflow for an employee by assigning a task.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="card card-pad space-y-5">
        <div className="grid gap-4">
          <div>
            <label className="label">Task Title <span className="text-error">*</span></label>
            <input
              className={`input ${errors.title ? 'input-error' : ''}`}
              placeholder="e.g. Q1 Expense Report Approval"
              {...register('title')}
            />
            {errors.title && <p className="field-error">{errors.title.message}</p>}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label mb-0">Description</label>
              <button
                type="button"
                onClick={handleFormalize}
                disabled={formalizing || !descriptionValue?.trim()}
                className="btn btn-ghost btn-sm text-accent"
              >
                <Sparkles size={13} className={formalizing ? 'animate-pulse' : ''} />
                {formalizing ? 'Formalizing...' : 'Formalize with AI'}
              </button>
            </div>
            <textarea
              className="input resize-none"
              rows={3}
              placeholder="Type rough notes, then click 'Formalize with AI'..."
              {...register('description')}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Workflow (Active only) <span className="text-error">*</span></label>
              <select
                className={`input ${errors.workflowId ? 'input-error' : ''}`}
                {...register('workflowId')}
              >
                <option value={0} disabled>Select workflow...</option>
                {workflows.map(w => <option key={w.workflowId} value={w.workflowId}>{w.title} ({w.stepCount} steps)</option>)}
              </select>
              {errors.workflowId && <p className="field-error">{errors.workflowId.message}</p>}
              {workflows.length === 0 && (
                <p className="caption text-warning mt-1">⚠ No active workflows. Activate one in Workflows first.</p>
              )}
            </div>

            <div>
              <label className="label">Assign To <span className="text-error">*</span></label>
              <select
                className={`input ${errors.assignedTo ? 'input-error' : ''}`}
                {...register('assignedTo')}
              >
                <option value={0} disabled>Select user...</option>
                {users.map(u => <option key={u.userId} value={u.userId}>{u.name} — {u.roleName}</option>)}
              </select>
              {errors.assignedTo && <p className="field-error">{errors.assignedTo.message}</p>}
            </div>
          </div>

          <div>
            <label className="label">Category (optional)</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setValue('categoryId', undefined)}
                className={`btn btn-sm rounded-pill ${
                  !watch('categoryId') ? 'btn-primary' : 'btn-secondary'
                }`}
              >
                None
              </button>
              {categories.map(c => (
                <button
                  key={c.categoryId}
                  type="button"
                  onClick={() => setValue('categoryId', c.categoryId)}
                  className="btn btn-sm rounded-pill bg-transparent"
                  style={
                    watch('categoryId') === c.categoryId
                      ? { backgroundColor: c.colorHex, color: '#fff', borderColor: c.colorHex }
                      : { borderColor: c.colorHex, color: c.colorHex }
                  }
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Priority</label>
              <div className="flex flex-col sm:flex-row gap-2">
                {(['Low', 'Medium', 'High'] as TaskPriority[]).map(p => (
                  <button
                    key={p} type="button"
                    onClick={() => setValue('priority', p)}
                    className={`btn flex-1 ${
                      priorityValue === p
                        ? p === 'High' ? 'bg-error text-on-accent'
                          : p === 'Medium' ? 'bg-warning text-ink'
                          : 'bg-success text-on-accent'
                        : 'btn-secondary'
                    }`}
                  >{p}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Due Date (optional)</label>
              <input
                type="date"
                className="input font-mono"
                {...register('dueDate')}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>
        </div>

        {message && (
          <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}>
            {message.text}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || workflows.length === 0}
          className="btn btn-primary w-full"
        >
          <Send size={17} />
          {isSubmitting ? 'Assigning...' : 'Assign Task'}
        </button>
      </form>
    </div>
  );
};

export default TaskAssign;
