import React, { useEffect, useState } from 'react';
import axiosInstance from '../../api/axiosInstance';
import type {
  Workflow, WorkflowDetail, WorkflowStepCreateDto,
  WorkflowCreateRequest, PaginatedResponse
} from '../../models';
import {
  GitPullRequest, Plus, Trash2, Save, Eye, Edit2,
  Copy, Power, PowerOff, ChevronUp, AlertCircle
  Copy, Power, PowerOff, ChevronUp, AlertCircle
} from 'lucide-react';
import Pagination from '../../components/Pagination';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

interface Role { roleId: number; roleName: string; }

const STATUS_STYLES: Record<string, string> = {
  Active:   'bg-green-100 text-green-700',
  Draft:    'bg-yellow-100 text-yellow-700',
  Inactive: 'bg-gray-100 text-gray-500',
};

const workflowStepSchema = z.object({
  stepOrder: z.number(),
  approverRoleId: z.coerce.number().min(1, 'Role is required'),
  stepName: z.string().min(1, 'Step name is required'),
  description: z.string().optional(),
  onRejectAction: z.enum(['GoBack', 'Cancel']),
  escalationHours: z.coerce.number().optional().nullable().transform(val => val ? val : undefined)
});

const workflowSchema = z.object({
  title: z.string().min(1, 'Workflow title is required'),
  description: z.string().optional(),
  status: z.enum(['Draft', 'Active', 'Inactive']),
  steps: z.array(workflowStepSchema).min(1, 'At least one step is required')
});

type WorkflowFormValues = z.infer<typeof workflowSchema>;

const DEFAULT_STEP = {
const workflowStepSchema = z.object({
  stepOrder: z.number(),
  approverRoleId: z.coerce.number().min(1, 'Role is required'),
  stepName: z.string().min(1, 'Step name is required'),
  description: z.string().optional(),
  onRejectAction: z.enum(['GoBack', 'Cancel']),
  escalationHours: z.coerce.number().optional().nullable().transform(val => val ? val : undefined)
});

const workflowSchema = z.object({
  title: z.string().min(1, 'Workflow title is required'),
  description: z.string().optional(),
  status: z.enum(['Draft', 'Active', 'Inactive']),
  steps: z.array(workflowStepSchema).min(1, 'At least one step is required')
});

type WorkflowFormValues = z.infer<typeof workflowSchema>;

const DEFAULT_STEP = {
  stepOrder: 1,
  approverRoleId: 2,
  stepName: '',
  description: '',
  onRejectAction: 'Cancel' as const,
  escalationHours: undefined
};
  onRejectAction: 'Cancel' as const,
  escalationHours: undefined
};

const WorkflowBuilder: React.FC = () => {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const limit = 10;

  // Edit State
  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formError, setFormError] = useState('');

  // Detail view
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detailCache, setDetailCache] = useState<Record<number, WorkflowDetail>>({});

  const { register, control, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<WorkflowFormValues>({
    resolver: zodResolver(workflowSchema) as any,
    defaultValues: {
      title: '',
      description: '',
      status: 'Draft',
      steps: [DEFAULT_STEP]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "steps"
  });

  const statusValue = watch('status');

  const { register, control, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<WorkflowFormValues>({
    resolver: zodResolver(workflowSchema),
    defaultValues: {
      title: '',
      description: '',
      status: 'Draft',
      steps: [DEFAULT_STEP]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "steps"
  });

  const statusValue = watch('status');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [wf, r] = await Promise.all([
        axiosInstance.get<PaginatedResponse<Workflow>>(`/Workflow?page=${page}&limit=${limit}`),
        axiosInstance.get<Role[]>('/Admin/roles'),
      ]);
      setWorkflows(wf.data.data);
      setTotal(wf.data.total);
      setRoles(r.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [page]);

  const loadDetail = async (id: number) => {
    if (detailCache[id]) return;
    const res = await axiosInstance.get<WorkflowDetail>(`/Workflow/${id}`);
    setDetailCache(prev => ({ ...prev, [id]: res.data }));
  };

  const toggleExpand = (id: number) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    loadDetail(id);
  };

  const addStep = () => {
    append({ ...DEFAULT_STEP, stepOrder: fields.length + 1 });
    append({ ...DEFAULT_STEP, stepOrder: fields.length + 1 });
  };

  const removeStep = (idx: number) => {
    remove(idx);
    // Re-order steps after removal
    const currentSteps = watch('steps');
    currentSteps.forEach((s, i) => setValue(`steps.${i}.stepOrder`, i + 1));
    remove(idx);
    // Re-order steps after removal
    const currentSteps = watch('steps');
    currentSteps.forEach((_: any, i: number) => setValue(`steps.${i}.stepOrder`, i + 1));
  };

  const resetForm = () => {
    setIsEditing(false); setEditId(null); setFormError('');
    reset({
      title: '', description: '', status: 'Draft',
      steps: [DEFAULT_STEP]
    });
    setIsEditing(false); setEditId(null); setFormError('');
    reset({
      title: '', description: '', status: 'Draft',
      steps: [DEFAULT_STEP]
    });
  };

  const populateEditForm = async (id: number) => {
    let detail = detailCache[id];
    if (!detail) {
      const res = await axiosInstance.get<WorkflowDetail>(`/Workflow/${id}`);
      detail = res.data;
      setDetailCache(prev => ({ ...prev, [id]: detail }));
    }
    
    reset({
      title: detail.title,
      description: detail.description || '',
      status: detail.status as any,
      steps: detail.steps.map(s => ({
        stepOrder: s.stepOrder,
        approverRoleId: roles.find(r => r.roleName === s.approverRoleName)?.roleId ?? 2,
        stepName: s.stepName,
        description: s.description || '',
        onRejectAction: s.onRejectAction as any,
        escalationHours: s.escalationHours,
      }))
    });
    
    
    reset({
      title: detail.title,
      description: detail.description || '',
      status: detail.status as any,
      steps: detail.steps.map(s => ({
        stepOrder: s.stepOrder,
        approverRoleId: roles.find(r => r.roleName === s.approverRoleName)?.roleId ?? 2,
        stepName: s.stepName,
        description: s.description || '',
        onRejectAction: s.onRejectAction as any,
        escalationHours: s.escalationHours,
      }))
    });
    
    setEditId(id);
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onSubmit = async (data: WorkflowFormValues) => {
    setFormError('');
  const onSubmit = async (data: WorkflowFormValues) => {
    setFormError('');
    try {
      if (editId) {
        await axiosInstance.put(`/Workflow/${editId}`, data);
        await axiosInstance.put(`/Workflow/${editId}`, data);
      } else {
        const body: WorkflowCreateRequest = { 
          title: data.title, 
          description: data.description || '', 
          steps: data.steps as WorkflowStepCreateDto[] 
        };
        const body: WorkflowCreateRequest = { 
          title: data.title, 
          description: data.description || '', 
          steps: data.steps as WorkflowStepCreateDto[] 
        };
        await axiosInstance.post('/Workflow', body);
      }
      await fetchAll();
      setDetailCache({});
      resetForm();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to save workflow.');
    }
  };

  const handleClone = async (id: number) => {
    await axiosInstance.post(`/Workflow/${id}/clone`);
    await fetchAll();
  };

  const handleDeactivate = async (id: number) => {
    await axiosInstance.delete(`/Workflow/${id}`);
    await fetchAll();
    setDetailCache(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  const handleActivate = async (wf: Workflow) => {
    let detail = detailCache[wf.workflowId];
    if (!detail) { 
      const res = await axiosInstance.get<WorkflowDetail>(`/Workflow/${wf.workflowId}`);
      detail = res.data;
    }
    let detail = detailCache[wf.workflowId];
    if (!detail) { 
      const res = await axiosInstance.get<WorkflowDetail>(`/Workflow/${wf.workflowId}`);
      detail = res.data;
    }
    await axiosInstance.put(`/Workflow/${wf.workflowId}`, {
      title: detail.title, description: detail.description || '',
      title: detail.title, description: detail.description || '',
      status: 'Active',
      steps: detail.steps.map(s => ({
        stepOrder: s.stepOrder,
        approverRoleId: roles.find(r => r.roleName === s.approverRoleName)?.roleId ?? 2,
        stepName: s.stepName, description: s.description || '',
        stepName: s.stepName, description: s.description || '',
        onRejectAction: s.onRejectAction, escalationHours: s.escalationHours,
      })),
    });
    await fetchAll();
    setDetailCache(prev => { const n = { ...prev }; delete n[wf.workflowId]; return n; });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* ── Create / Edit Form ─────────────────────────────── */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold flex items-center gap-2 mb-5">
          <GitPullRequest className="text-blue-600" />
          {editId ? 'Edit Workflow Template' : 'Create Workflow Template'}
        </h2>

        {formError && (
          <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4 flex items-center gap-3">
            <AlertCircle className="text-red-400" size={20} />
            <p className="text-sm text-red-700">{formError}</p>
          </div>
        )}

        {formError && (
          <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4 flex items-center gap-3">
            <AlertCircle className="text-red-400" size={20} />
            <p className="text-sm text-red-700">{formError}</p>
          </div>
        )}

        <div className="grid gap-4">
          <div>
            <input
              className={`p-3 border rounded-lg w-full focus:ring-2 focus:ring-blue-200 outline-none ${errors.title ? 'border-red-500' : 'border-gray-200'}`}
              placeholder="Workflow Title (e.g., Expense Approval)"
              {...register('title')}
            />
            {errors.title && <p className="mt-1 text-sm text-red-500">{errors.title.message}</p>}
          </div>

          <div>
            <input
              className={`p-3 border rounded-lg w-full focus:ring-2 focus:ring-blue-200 outline-none ${errors.title ? 'border-red-500' : 'border-gray-200'}`}
              placeholder="Workflow Title (e.g., Expense Approval)"
              {...register('title')}
            />
            {errors.title && <p className="mt-1 text-sm text-red-500">{errors.title.message}</p>}
          </div>

          <textarea
            className="p-3 border border-gray-200 rounded-lg w-full resize-none focus:ring-2 focus:ring-blue-200 outline-none"
            rows={2}
            placeholder="Description..."
            {...register('description')}
            {...register('description')}
          />


          {editId && (
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-600">Status:</label>
              {(['Draft', 'Active', 'Inactive'] as const).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setValue('status', s)}
                  type="button"
                  onClick={() => setValue('status', s)}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all ${
                    statusValue === s ? STATUS_STYLES[s] + ' border-current' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    statusValue === s ? STATUS_STYLES[s] + ' border-current' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >{s}</button>
              ))}
            </div>
          )}
        </div>

        {/* Steps */}
        <div className="mt-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-gray-700">Approval Steps</h3>
            <button type="button" onClick={addStep} className="flex items-center gap-1 text-sm bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors">
            <button type="button" onClick={addStep} className="flex items-center gap-1 text-sm bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors">
              <Plus size={15} /> Add Step
            </button>
          </div>

          {errors.steps?.root && <p className="mb-2 text-sm text-red-500">{errors.steps.root.message}</p>}

          {errors.steps?.root && <p className="mb-2 text-sm text-red-500">{errors.steps.root.message}</p>}

          <div className="space-y-3">
            {fields.map((field, idx) => (
              <div key={field.id} className="flex flex-col gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
            {fields.map((field: any, idx: number) => (
              <div key={field.id} className="flex flex-col gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-3 w-full sm:w-auto flex-1">
                    <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {idx + 1}
                      {idx + 1}
                    </span>
                    <div className="flex-1">
                      <input
                        className={`w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 outline-none min-w-0 ${errors.steps?.[idx]?.stepName ? 'border-red-500' : 'border-gray-200'}`}
                        placeholder="Step Name (e.g., Manager Review)"
                        {...register(`steps.${idx}.stepName`)}
                      />
                    </div>
                    <div className="flex-1">
                      <input
                        className={`w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 outline-none min-w-0 ${errors.steps?.[idx]?.stepName ? 'border-red-500' : 'border-gray-200'}`}
                        placeholder="Step Name (e.g., Manager Review)"
                        {...register(`steps.${idx}.stepName`)}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <select
                      className={`flex-1 p-2 border rounded-lg bg-white text-sm focus:ring-2 focus:ring-blue-200 outline-none ${errors.steps?.[idx]?.approverRoleId ? 'border-red-500' : 'border-gray-200'}`}
                      {...register(`steps.${idx}.approverRoleId`)}
                      className={`flex-1 p-2 border rounded-lg bg-white text-sm focus:ring-2 focus:ring-blue-200 outline-none ${errors.steps?.[idx]?.approverRoleId ? 'border-red-500' : 'border-gray-200'}`}
                      {...register(`steps.${idx}.approverRoleId`)}
                    >
                      {roles.map(r => <option key={r.roleId} value={r.roleId}>{r.roleName}</option>)}
                    </select>
                    <button type="button" onClick={() => removeStep(idx)} className="text-red-400 hover:text-red-600 p-1 rounded transition-colors flex-shrink-0">
                    <button type="button" onClick={() => removeStep(idx)} className="text-red-400 hover:text-red-600 p-1 rounded transition-colors flex-shrink-0">
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>
                
                {errors.steps?.[idx]?.stepName && <p className="text-xs text-red-500 pl-10">{errors.steps[idx].stepName?.message}</p>}
                
                {errors.steps?.[idx]?.stepName && <p className="text-xs text-red-500 pl-10">{errors.steps[idx].stepName?.message}</p>}

                <div className="flex flex-col sm:flex-row gap-3 sm:pl-10">
                  <input
                    className="flex-1 p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-200 outline-none min-w-0"
                    placeholder="Instructions for approver (optional)"
                    {...register(`steps.${idx}.description`)}
                    {...register(`steps.${idx}.description`)}
                  />
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <select
                      className="w-full sm:w-48 p-2 border border-gray-200 rounded-lg bg-white text-sm focus:ring-2 focus:ring-blue-200 outline-none"
                      {...register(`steps.${idx}.onRejectAction`)}
                      {...register(`steps.${idx}.onRejectAction`)}
                    >
                      <option value="Cancel">On Reject → Cancel task</option>
                      <option value="GoBack">On Reject → Go back 1 step</option>
                    </select>
                    <input
                      type="number"
                      className="w-full sm:w-24 p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-200 outline-none"
                      placeholder="Esc. hrs"
                      title="Escalation hours (optional)"
                      min={1}
                      {...register(`steps.${idx}.escalationHours`)}
                      {...register(`steps.${idx}.escalationHours`)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={handleSubmit(onSubmit as any)}
            disabled={isSubmitting}
            type="button"
            onClick={handleSubmit(onSubmit as any)}
            disabled={isSubmitting}
            className="flex-1 bg-blue-600 text-white py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-60 font-semibold transition-colors"
          >
            {isSubmitting ? <><Save size={17} className="animate-pulse" /> Saving...</> : <><Save size={17} /> {editId ? 'Save Changes' : 'Create Workflow'}</>}
            {isSubmitting ? <><Save size={17} className="animate-pulse" /> Saving...</> : <><Save size={17} /> {editId ? 'Save Changes' : 'Create Workflow'}</>}
          </button>
          {isEditing && (
            <button type="button" onClick={resetForm} className="px-6 border border-gray-300 text-gray-600 py-3 rounded-xl hover:bg-gray-50 font-semibold transition-colors">
            <button type="button" onClick={resetForm} className="px-6 border border-gray-300 text-gray-600 py-3 rounded-xl hover:bg-gray-50 font-semibold transition-colors">
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* ── Workflow List ──────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800 text-lg">Workflow Templates</h3>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : workflows.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No workflows yet. Create one above.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {workflows.map(wf => (
              <div key={wf.workflowId}>
                {/* Row */}
                <div className="px-6 py-4 flex flex-wrap gap-3 items-center">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-800 truncate">{wf.title}</h4>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_STYLES[wf.status]}`}>
                        {wf.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{wf.stepCount} approval step{wf.stepCount !== 1 ? 's' : ''}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {wf.status === 'Draft' && (
                      <button onClick={() => handleActivate(wf)} title="Activate"
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                        <Power size={17} />
                      </button>
                    )}
                    {wf.status === 'Active' && (
                      <button onClick={() => handleDeactivate(wf.workflowId)} title="Deactivate (soft-delete)"
                        className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
                        <PowerOff size={17} />
                      </button>
                    )}
                    <button onClick={() => handleClone(wf.workflowId)} title="Clone as template"
                      className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors">
                      <Copy size={17} />
                    </button>
                    <button onClick={() => populateEditForm(wf.workflowId)} title="Edit"
                      className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
                      <Edit2 size={17} />
                    </button>
                    <button onClick={() => toggleExpand(wf.workflowId)} title="View steps"
                      className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
                      {expandedId === wf.workflowId ? <ChevronUp size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                {/* Step Detail Panel */}
                {expandedId === wf.workflowId && detailCache[wf.workflowId] && (
                  <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 space-y-2">
                    {detailCache[wf.workflowId].steps.map(s => (
                      <div key={s.stepId} className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 text-sm text-gray-600 bg-white p-3 rounded-lg border border-gray-100">
                        <div className="flex items-center gap-3 w-full sm:w-auto flex-1 min-w-0">
                          <span className="w-6 h-6 flex-shrink-0 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                            {s.stepOrder}
                          </span>
                          <span className="font-semibold text-gray-700 truncate">{s.stepName}</span>
                          <span className="text-gray-400 whitespace-nowrap">→ {s.approverRoleName}</span>
                        </div>
                        {s.description && <span className="text-gray-400 italic text-xs w-full sm:w-auto truncate">· {s.description}</span>}
                        <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            s.onRejectAction === 'GoBack' ? 'bg-orange-50 text-orange-600' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {s.onRejectAction === 'GoBack' ? '↩ GoBack' : '✕ Cancel'}
                          </span>
                          {s.escalationHours && (
                            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                              ⏱ {s.escalationHours}h
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        
        {!loading && Math.ceil(total / limit) > 1 && (
          <Pagination
            currentPage={page}
            totalPages={Math.ceil(total / limit)}
            totalItems={total}
            pageSize={limit}
            onPageChange={setPage}
          />
        )}
      </div>
    </div>
  );
};

export default WorkflowBuilder;