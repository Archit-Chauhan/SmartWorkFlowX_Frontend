import React, { useEffect, useState } from 'react';
import axiosInstance from '../../api/axiosInstance';
import type {
  Workflow, WorkflowDetail, WorkflowStepCreateDto,
  WorkflowCreateRequest, OnRejectAction, PaginatedResponse
} from '../../models';
import {
  GitPullRequest, Plus, Trash2, Save, Eye, Edit2,
  Copy, Power, PowerOff, ChevronUp
} from 'lucide-react';
import Pagination from '../../components/Pagination';

interface Role { roleId: number; roleName: string; }

const STATUS_STYLES: Record<string, string> = {
  Active:   'bg-green-100 text-green-700',
  Draft:    'bg-yellow-100 text-yellow-700',
  Inactive: 'bg-gray-100 text-gray-500',
};

const DEFAULT_STEP = (): WorkflowStepCreateDto => ({
  stepOrder: 1,
  approverRoleId: 2,
  stepName: '',
  description: '',
  onRejectAction: 'Cancel',
  escalationHours: undefined,
});

const WorkflowBuilder: React.FC = () => {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const limit = 10;

  // Create/Edit Form State
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<string>('Draft');
  const [steps, setSteps] = useState<WorkflowStepCreateDto[]>([DEFAULT_STEP()]);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Detail view
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detailCache, setDetailCache] = useState<Record<number, WorkflowDetail>>({});

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

  // ── Form helpers ──────────────────────────────────────────
  const addStep = () => {
    const order = steps.length + 1;
    setSteps([...steps, { ...DEFAULT_STEP(), stepOrder: order }]);
  };

  const removeStep = (idx: number) => {
    setSteps(steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, stepOrder: i + 1 })));
  };

  const updateStep = <K extends keyof WorkflowStepCreateDto>(idx: number, key: K, val: WorkflowStepCreateDto[K]) => {
    const copy = [...steps];
    copy[idx] = { ...copy[idx], [key]: val };
    setSteps(copy);
  };

  const resetForm = () => {
    setIsEditing(false); setEditId(null);
    setTitle(''); setDescription(''); setStatus('Draft');
    setSteps([DEFAULT_STEP()]); setFormError('');
  };

  const populateEditForm = async (id: number) => {
    let detail = detailCache[id];
    if (!detail) {
      const res = await axiosInstance.get<WorkflowDetail>(`/Workflow/${id}`);
      detail = res.data;
      setDetailCache(prev => ({ ...prev, [id]: detail }));
    }
    setTitle(detail.title);
    setDescription(detail.description || '');
    setStatus(detail.status);
    setSteps(detail.steps.map(s => ({
      stepOrder: s.stepOrder,
      approverRoleId: roles.find(r => r.roleName === s.approverRoleName)?.roleId ?? 2,
      stepName: s.stepName,
      description: s.description || '',
      onRejectAction: s.onRejectAction,
      escalationHours: s.escalationHours,
    })));
    setEditId(id);
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = async () => {
    if (!title.trim()) { setFormError('Workflow title is required.'); return; }
    if (steps.some(s => !s.stepName.trim())) { setFormError('Every step needs a name.'); return; }
    setSaving(true); setFormError('');
    try {
      if (editId) {
        await axiosInstance.put(`/Workflow/${editId}`, { title, description, status, steps });
      } else {
        const body: WorkflowCreateRequest = { title, description, steps };
        await axiosInstance.post('/Workflow', body);
      }
      await fetchAll();
      setDetailCache({});
      resetForm();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to save workflow.');
    } finally {
      setSaving(false);
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
    const detail = detailCache[wf.workflowId];
    if (!detail) { await populateEditForm(wf.workflowId); return; }
    await axiosInstance.put(`/Workflow/${wf.workflowId}`, {
      title: detail.title, description: detail.description,
      status: 'Active',
      steps: detail.steps.map(s => ({
        stepOrder: s.stepOrder,
        approverRoleId: roles.find(r => r.roleName === s.approverRoleName)?.roleId ?? 2,
        stepName: s.stepName, description: s.description,
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

        <div className="grid gap-4">
          <input
            className="p-3 border border-gray-200 rounded-lg w-full focus:ring-2 focus:ring-blue-200 outline-none"
            placeholder="Workflow Title (e.g., Expense Approval)"
            value={title} onChange={e => setTitle(e.target.value)}
          />
          <textarea
            className="p-3 border border-gray-200 rounded-lg w-full resize-none focus:ring-2 focus:ring-blue-200 outline-none"
            rows={2}
            placeholder="Description..."
            value={description} onChange={e => setDescription(e.target.value)}
          />
          {editId && (
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-600">Status:</label>
              {(['Draft', 'Active', 'Inactive'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all ${
                    status === s ? STATUS_STYLES[s] + ' border-current' : 'border-gray-200 text-gray-500 hover:border-gray-300'
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
            <button onClick={addStep} className="flex items-center gap-1 text-sm bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors">
              <Plus size={15} /> Add Step
            </button>
          </div>

          <div className="space-y-3">
            {steps.map((step, idx) => (
              <div key={idx} className="flex flex-col gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-3 w-full sm:w-auto flex-1">
                    <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {step.stepOrder}
                    </span>
                    <input
                      className="flex-1 p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-200 outline-none min-w-0"
                      placeholder="Step Name (e.g., Manager Review)"
                      value={step.stepName}
                      onChange={e => updateStep(idx, 'stepName', e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <select
                      className="flex-1 p-2 border border-gray-200 rounded-lg bg-white text-sm focus:ring-2 focus:ring-blue-200 outline-none"
                      value={step.approverRoleId}
                      onChange={e => updateStep(idx, 'approverRoleId', parseInt(e.target.value))}
                    >
                      {roles.map(r => <option key={r.roleId} value={r.roleId}>{r.roleName}</option>)}
                    </select>
                    <button onClick={() => removeStep(idx)} className="text-red-400 hover:text-red-600 p-1 rounded transition-colors flex-shrink-0">
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 sm:pl-10">
                  <input
                    className="flex-1 p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-200 outline-none min-w-0"
                    placeholder="Instructions for approver (optional)"
                    value={step.description || ''}
                    onChange={e => updateStep(idx, 'description', e.target.value)}
                  />
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <select
                      className="w-full sm:w-48 p-2 border border-gray-200 rounded-lg bg-white text-sm focus:ring-2 focus:ring-blue-200 outline-none"
                      value={step.onRejectAction}
                      onChange={e => updateStep(idx, 'onRejectAction', e.target.value as OnRejectAction)}
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
                      value={step.escalationHours ?? ''}
                      onChange={e => updateStep(idx, 'escalationHours', e.target.value ? parseInt(e.target.value) : undefined)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {formError && (
          <p className="mt-3 text-sm text-red-500 bg-red-50 border border-red-200 px-4 py-2 rounded-lg">{formError}</p>
        )}

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-blue-600 text-white py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-60 font-semibold transition-colors"
          >
            {saving ? <><Save size={17} className="animate-pulse" /> Saving...</> : <><Save size={17} /> {editId ? 'Save Changes' : 'Create Workflow'}</>}
          </button>
          {isEditing && (
            <button onClick={resetForm} className="px-6 border border-gray-300 text-gray-600 py-3 rounded-xl hover:bg-gray-50 font-semibold transition-colors">
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