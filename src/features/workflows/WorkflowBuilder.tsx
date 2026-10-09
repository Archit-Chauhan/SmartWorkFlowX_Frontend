import React, { useEffect, useState } from 'react';
import axiosInstance from '../../api/axiosInstance';
import type {
  Workflow, WorkflowDetail, WorkflowStepCreateDto,
  WorkflowCreateRequest, PaginatedResponse
} from '../../models';
import {
  GitPullRequest, Plus, Trash2, Save, Eye, Edit2,
  Copy, Power, PowerOff, ChevronUp, AlertCircle, Sparkles
} from 'lucide-react';
import Pagination from '../../components/Pagination';
import EmptyState from '../../components/EmptyState';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

interface Role { roleId: number; roleName: string; }

const STATUS_STYLES: Record<string, string> = {
  Active:   'chip-completed',
  Draft:    'chip-warning',
  Inactive: 'chip-neutral',
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
  stepOrder: 1,
  approverRoleId: 2,
  stepName: '',
  description: '',
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
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formError, setFormError] = useState('');
  const [formalizing, setFormalizing] = useState(false);

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

  const handleFormalizeDescription = async () => {
    const raw = watch('description')?.trim();
    if (!raw) return;
    setFormalizing(true);
    try {
      const res = await axiosInstance.post<{ formalizedText: string }>('/Task/formalize-description', { rawText: raw, context: 'workflow' });
      setValue('description', res.data.formalizedText);
    } catch {
      // silently keep original text
    } finally {
      setFormalizing(false);
    }
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [wfResult, rolesResult] = await Promise.allSettled([
        axiosInstance.get<PaginatedResponse<Workflow>>(`/Workflow?page=${page}&limit=${limit}`),
        axiosInstance.get<Role[]>('/Workflow/roles'),
      ]);
      if (wfResult.status === 'fulfilled') {
        setWorkflows(wfResult.value.data.data);
        setTotal(wfResult.value.data.total);
      }
      if (rolesResult.status === 'fulfilled') {
        setRoles(rolesResult.value.data);
      }
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
  };

  const removeStep = (idx: number) => {
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
    
    setEditId(id);
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onSubmit = async (data: WorkflowFormValues) => {
    setFormError('');
    try {
      if (editId) {
        await axiosInstance.put(`/Workflow/${editId}`, data);
      } else {
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
    await axiosInstance.put(`/Workflow/${wf.workflowId}`, {
      title: detail.title, description: detail.description || '',
      status: 'Active',
      steps: detail.steps.map(s => ({
        stepOrder: s.stepOrder,
        approverRoleId: roles.find(r => r.roleName === s.approverRoleName)?.roleId ?? 2,
        stepName: s.stepName, description: s.description || '',
        onRejectAction: s.onRejectAction, escalationHours: s.escalationHours,
      })),
    });
    await fetchAll();
    setDetailCache(prev => { const n = { ...prev }; delete n[wf.workflowId]; return n; });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* ── Create / Edit Form ─────────────────────────────── */}
      <div className="card card-pad">
        <h2 className="section-title flex items-center gap-2 mb-5">
          <GitPullRequest className="text-accent" />
          {editId ? 'Edit Workflow Template' : 'Create Workflow Template'}
        </h2>

        {formError && (
          <div className="alert alert-error mb-4 flex items-center gap-3">
            <AlertCircle className="text-error" size={20} />
            <p className="text-sm text-error">{formError}</p>
          </div>
        )}

        <div className="grid gap-4">
          <div>
            <input
              className={`input ${errors.title ? 'input-error' : ''}`}
              placeholder="Workflow Title (e.g., Expense Approval)"
              {...register('title')}
            />
            {errors.title && <p className="field-error">{errors.title.message}</p>}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label !mb-0">Description</label>
              <button
                type="button"
                onClick={handleFormalizeDescription}
                disabled={formalizing || !watch('description')?.trim()}
                className="btn btn-ghost btn-sm text-accent hover:text-accent"
              >
                <Sparkles size={13} className={formalizing ? 'animate-pulse' : ''} />
                {formalizing ? 'Formalizing...' : 'Formalize with AI'}
              </button>
            </div>
            <textarea
              className="input resize-none"
              rows={2}
              placeholder="Type rough notes, then click 'Formalize with AI'..."
              {...register('description')}
            />
          </div>

          {editId && (
            <div className="flex items-center gap-3">
              <label className="label !mb-0">Status:</label>
              {(['Draft', 'Active', 'Inactive'] as const).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setValue('status', s)}
                  className={`chip cursor-pointer border border-transparent ${
                    statusValue === s ? STATUS_STYLES[s] + ' !border-current' : 'chip-neutral hover:border-hairline-strong'
                  }`}
                >{s}</button>
              ))}
            </div>
          )}
        </div>

        {/* Steps */}
        <div className="mt-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="section-title">Approval Steps</h3>
            <button type="button" onClick={addStep} title="Add step" className="btn btn-secondary btn-sm">
              <Plus size={15} /> Add Step
            </button>
          </div>

          {errors.steps?.root && <p className="field-error mb-2">{errors.steps.root.message}</p>}

          <div>
            {fields.map((field: any, idx: number) => (
              <div key={field.id} className="flex gap-3">
                <div className="flex flex-col items-center flex-shrink-0">
                  <span className="w-7 h-7 rounded-pill bg-accent text-on-accent text-xs font-semibold flex items-center justify-center">
                    {idx + 1}
                  </span>
                  {idx < fields.length - 1 && <span className="w-px flex-1 bg-hairline-strong" />}
                </div>
              <div className={`flex-1 min-w-0 flex flex-col gap-3 p-4 bg-surface-1 rounded-card border border-hairline ${idx < fields.length - 1 ? 'mb-3' : ''}`}>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-3 w-full sm:w-auto flex-1">
                    <div className="flex-1">
                      <input
                        className={`input min-w-0 ${errors.steps?.[idx]?.stepName ? 'input-error' : ''}`}
                        placeholder="Step Name (e.g., Manager Review)"
                        {...register(`steps.${idx}.stepName`)}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <select
                      className={`input flex-1 ${errors.steps?.[idx]?.approverRoleId ? 'input-error' : ''}`}
                      {...register(`steps.${idx}.approverRoleId`)}
                    >
                      {roles.map(r => <option key={r.roleId} value={r.roleId}>{r.roleName}</option>)}
                    </select>
                    <button type="button" onClick={() => removeStep(idx)} title="Remove step" className="btn btn-ghost px-2 flex-shrink-0 hover:text-error">
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>
                
                {errors.steps?.[idx]?.stepName && <p className="field-error">{errors.steps[idx].stepName?.message}</p>}

                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    className="input sm:flex-1 min-w-0"
                    placeholder="Instructions for approver (optional)"
                    {...register(`steps.${idx}.description`)}
                  />
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <select
                      className="input w-full sm:w-56"
                      {...register(`steps.${idx}.onRejectAction`)}
                    >
                      <option value="Cancel">On Reject → Cancel task</option>
                      <option value="GoBack">On Reject → Go back 1 step</option>
                    </select>
                    <input
                      type="number"
                      className="input w-full sm:w-24"
                      placeholder="Esc. hrs"
                      title="Escalation hours (optional)"
                      min={1}
                      {...register(`steps.${idx}.escalationHours`)}
                    />
                  </div>
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
            className="btn btn-primary flex-1"
          >
            {isSubmitting ? <><Save size={17} className="animate-pulse" /> Saving...</> : <><Save size={17} /> {editId ? 'Save Changes' : 'Create Workflow'}</>}
          </button>
          {isEditing && (
            <button type="button" onClick={resetForm} className="btn btn-secondary px-6">
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* ── Workflow List ──────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-hairline">
          <h3 className="section-title">Workflow Templates</h3>
        </div>

        {loading ? (
          <div className="empty-state">Loading...</div>
        ) : workflows.length === 0 ? (
          <EmptyState illustration="process" title="No workflows yet. Create one above." hint="A workflow defines the approval steps a task moves through." />
        ) : (
          <div className="divide-y divide-hairline">
            {workflows.map(wf => (
              <div key={wf.workflowId}>
                {/* Row */}
                <div className="px-6 py-4 flex flex-wrap gap-3 items-center">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-ink truncate">{wf.title}</h4>
                      <span className={`chip ${STATUS_STYLES[wf.status]}`}>
                        {wf.status}
                      </span>
                    </div>
                    <p className="caption mt-0.5">{wf.stepCount} approval step{wf.stepCount !== 1 ? 's' : ''}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {wf.status === 'Draft' && (
                      <button onClick={() => handleActivate(wf)} title="Activate"
                        className="btn btn-ghost px-2 text-success">
                        <Power size={17} />
                      </button>
                    )}
                    {wf.status === 'Active' && (
                      <button onClick={() => handleDeactivate(wf.workflowId)} title="Deactivate (soft-delete)"
                        className="btn btn-ghost px-2">
                        <PowerOff size={17} />
                      </button>
                    )}
                    <button onClick={() => handleClone(wf.workflowId)} title="Clone as template"
                      className="btn btn-ghost px-2">
                      <Copy size={17} />
                    </button>
                    <button onClick={() => populateEditForm(wf.workflowId)} title="Edit"
                      className="btn btn-ghost px-2">
                      <Edit2 size={17} />
                    </button>
                    <button onClick={() => toggleExpand(wf.workflowId)} title="View steps"
                      className="btn btn-ghost px-2">
                      {expandedId === wf.workflowId ? <ChevronUp size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                {/* Step Detail Panel */}
                {expandedId === wf.workflowId && detailCache[wf.workflowId] && (
                  <div className="bg-surface-1 px-6 py-4 border-t border-hairline space-y-2">
                    {detailCache[wf.workflowId].steps.map(s => (
                      <div key={s.stepId} className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 text-sm text-ink-muted bg-canvas p-3 rounded-card border border-hairline">
                        <div className="flex items-center gap-3 w-full sm:w-auto flex-1 min-w-0">
                          <span className="w-6 h-6 flex-shrink-0 rounded-pill bg-accent-soft text-accent text-xs font-semibold flex items-center justify-center">
                            {s.stepOrder}
                          </span>
                          <span className="font-medium text-ink truncate">{s.stepName}</span>
                          <span className="text-ink-subtle whitespace-nowrap">→ {s.approverRoleName}</span>
                        </div>
                        {s.description && <span className="text-ink-subtle italic text-xs w-full sm:w-auto truncate">· {s.description}</span>}
                        <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
                          <span className={`chip ${s.onRejectAction === 'GoBack' ? 'chip-warning' : 'chip-neutral'}`}>
                            {s.onRejectAction === 'GoBack' ? '↩ GoBack' : '✕ Cancel'}
                          </span>
                          {s.escalationHours && (
                            <span className="chip chip-warning">
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