import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { AlertCircle, ChevronDown, ChevronUp, Copy, Lock, Pencil, Plus, Power, Search } from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';
import EmptyState from '../../components/EmptyState';
import type { PaginatedResponse, Workflow, WorkflowDetail } from '../../models';
import { Journey, StepChain } from './WorkflowJourney';
import { Banner, ConfirmDialog } from './WorkflowParts';
import {
  FILTERS, LIST_LIMIT, STATUS_CHIP, errorMessage, filterWorkflows, formatDate, isLocked, activeTasks,
  lockChipText, lockedMessage, plural, statusCounts, type StatusFilter,
} from './workflowUtils';

type Load = 'loading' | 'error' | 'ready';
type DetailState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: WorkflowDetail };
type Action = { kind: 'activate' | 'deactivate' | 'clone'; workflow: Workflow };

const FILTER_LABEL: Record<StatusFilter, string> = { all: 'All', Active: 'Active', Draft: 'Draft', Inactive: 'Inactive' };

const ListSkeleton: React.FC = () => (
  <div className="flex flex-col gap-2.5" aria-hidden="true">
    {[0, 1, 2].map((i) => (
      <div key={i} className="card animate-pulse space-y-3 p-4">
        <div className="h-4 w-1/3 rounded-control bg-surface-2" />
        <div className="h-3 w-2/3 rounded-control bg-surface-2" />
        <div className="h-6 w-full rounded-control bg-surface-2" />
      </div>
    ))}
  </div>
);

const ACTION_COPY = {
  activate: { done: (t: string) => `“${t}” is now active.`, busy: 'Activating...', fail: 'Could not activate this workflow. Please try again.' },
  deactivate: { done: (t: string) => `“${t}” deactivated.`, busy: 'Deactivating...', fail: 'Could not deactivate this workflow. Please try again.' },
  clone: { done: (t: string) => `Created “${t} (Copy)” as a draft.`, busy: 'Cloning...', fail: 'Could not clone this workflow. Please try again.' },
} as const;

const WorkflowList: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<Workflow[]>([]);
  const [total, setTotal] = useState(0);
  const [load, setLoad] = useState<Load>('loading');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');
  const [banner, setBanner] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);
  const [details, setDetails] = useState<Record<number, DetailState>>({});
  const [action, setAction] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);

  const fetchList = useCallback(async (silent: boolean) => {
    if (!silent) setLoad('loading');
    try {
      const res = await axiosInstance.get<PaginatedResponse<Workflow>>(`/Workflow?page=1&limit=${LIST_LIMIT}`);
      setItems(res.data.data);
      setTotal(res.data.total);
      setLoad('ready');
    } catch {
      if (!silent) setLoad('error');
    }
  }, []);

  useEffect(() => { fetchList(false); }, [fetchList]);

  const fetchDetail = async (id: number) => {
    setDetails((d) => ({ ...d, [id]: { status: 'loading' } }));
    try {
      const res = await axiosInstance.get<WorkflowDetail>(`/Workflow/${id}`);
      setDetails((d) => ({ ...d, [id]: { status: 'ready', data: res.data } }));
    } catch {
      setDetails((d) => ({ ...d, [id]: { status: 'error' } }));
    }
  };

  const toggle = (id: number) => {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id);
    if (details[id]?.status !== 'ready') fetchDetail(id);
  };

  const edit = (w: Workflow) => {
    if (isLocked(w)) { setBanner(lockedMessage(w, 'modify')); return; }
    setBanner('');
    navigate(`/workflows/${w.workflowId}/edit`);
  };

  const ask = (kind: Action['kind'], w: Workflow) => {
    if (kind === 'deactivate' && isLocked(w)) { setBanner(lockedMessage(w, 'deactivate')); return; }
    setBanner('');
    setAction({ kind, workflow: w });
  };

  const confirm = async () => {
    if (!action) return;
    const { kind, workflow } = action;
    setBusy(true);
    try {
      if (kind === 'activate') await axiosInstance.post(`/Workflow/${workflow.workflowId}/activate`);
      else if (kind === 'clone') await axiosInstance.post(`/Workflow/${workflow.workflowId}/clone`);
      else await axiosInstance.delete(`/Workflow/${workflow.workflowId}`);
      setAction(null);
      setDetails({});
      toast.success(ACTION_COPY[kind].done(workflow.title));
      await fetchList(true);
    } catch (err) {
      setAction(null);
      setBanner(errorMessage(err, ACTION_COPY[kind].fail));
      fetchList(true);
    } finally {
      setBusy(false);
    }
  };

  const counts = statusCounts(items);
  const visible = filterWorkflows(items, filter, query);
  const clearFilters = () => { setFilter('all'); setQuery(''); };

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Workflows</h1>
          <p className="mt-1 text-sm text-ink-muted">Reusable approval journeys. Pick one in Assign Task and every task follows its steps.</p>
        </div>
        <Link to="/workflows/new" className="btn btn-primary"><Plus size={16} aria-hidden="true" /> New workflow</Link>
      </div>

      {banner && <Banner message={banner} onDismiss={() => setBanner('')} />}

      {load === 'loading' && <ListSkeleton />}

      {load === 'error' && (
        <div className="card empty-state flex flex-col items-center gap-3" role="alert">
          <AlertCircle size={28} className="text-error" aria-hidden="true" />
          <p>We couldn't load your workflows.</p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => fetchList(false)}>Try again</button>
        </div>
      )}

      {load === 'ready' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={filter === f}
                  onClick={() => setFilter(f)}
                  className={`inline-flex h-9 cursor-pointer items-center gap-1 rounded-pill border px-3.5 text-sm transition-colors ${
                    filter === f ? 'border-accent bg-accent-soft font-semibold text-accent' : 'border-hairline-strong bg-canvas text-ink-muted hover:bg-surface-1'}`}
                >
                  {FILTER_LABEL[f]}{' '}<b className="font-semibold">{counts[f]}</b>
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-64">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
              <input
                type="search"
                className="input pl-9"
                placeholder="Search workflows"
                aria-label="Search workflows"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          {total > LIST_LIMIT && <p className="alert alert-info">Showing the first {LIST_LIMIT} workflows</p>}

          {items.length === 0 ? (
            <div className="card">
              <EmptyState illustration="process" title="No workflows yet" hint="A workflow defines the approval steps a task moves through.">
                <Link to="/workflows/new" className="btn btn-primary mt-2"><Plus size={16} aria-hidden="true" /> New workflow</Link>
              </EmptyState>
            </div>
          ) : visible.length === 0 ? (
            <div className="card">
              <EmptyState illustration="empty" title="No workflows match" hint="Try another filter or search, or create a new workflow.">
                <button type="button" className="btn btn-secondary btn-sm mt-2" onClick={clearFilters}>Clear filters</button>
              </EmptyState>
            </div>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
              {visible.map((w) => (
                <WorkflowRow
                  key={w.workflowId}
                  workflow={w}
                  open={openId === w.workflowId}
                  detail={details[w.workflowId]}
                  onToggle={() => toggle(w.workflowId)}
                  onRetryDetail={() => fetchDetail(w.workflowId)}
                  onEdit={() => edit(w)}
                  onAsk={(kind) => ask(kind, w)}
                />
              ))}
            </ul>
          )}
        </>
      )}

      {action && (
        <ConfirmDialog
          tone={action.kind === 'deactivate' ? 'danger' : 'accent'}
          icon={action.kind === 'clone' ? <Copy size={20} /> : <Power size={20} />}
          title={{ activate: 'Activate this workflow?', deactivate: 'Deactivate this workflow?', clone: 'Clone this workflow?' }[action.kind]}
          subject={action.workflow.title}
          bullets={
            action.kind === 'activate' ? [
              <><b>{action.workflow.title}</b> becomes available in Assign Task.</>,
              'You will not be able to edit it while tasks are in progress.',
            ] : action.kind === 'deactivate' ? [
              'It disappears from Assign Task, so no new tasks can start.',
              'Tasks already finished are not affected.',
              'You can activate it again later.',
            ] : [
              <>A copy named “{action.workflow.title} (Copy)” is created as a <b>Draft</b>.</>,
              'Steps, roles and rules are copied exactly.',
            ]
          }
          confirmLabel={{ activate: 'Yes, activate', deactivate: 'Yes, deactivate', clone: 'Yes, clone' }[action.kind]}
          busyLabel={ACTION_COPY[action.kind].busy}
          busy={busy}
          onConfirm={confirm}
          onCancel={() => setAction(null)}
        />
      )}
    </div>
  );
};

interface RowProps {
  workflow: Workflow;
  open: boolean;
  detail?: DetailState;
  onToggle: () => void;
  onRetryDetail: () => void;
  onEdit: () => void;
  onAsk: (kind: Action['kind']) => void;
}

const WorkflowRow: React.FC<RowProps> = ({ workflow: w, open, detail, onToggle, onRetryDetail, onEdit, onAsk }) => {
  const locked = isLocked(w);
  const n = activeTasks(w);
  const lockTitle = locked ? `Locked: ${plural(n, 'task')} in progress` : undefined;
  const steps = (w.steps ?? []).map((s) => ({ name: s.stepName, roleName: s.approverRoleName }));
  const panelId = `wf-details-${w.workflowId}`;

  return (
    <li>
      <article className="card flex flex-col gap-2.5 p-4" aria-label={w.title}>
        <div className="flex flex-wrap items-start justify-between gap-2.5">
          <div className="min-w-0 flex-1 basis-64">
            <h2 className="section-title flex flex-wrap items-center gap-2 break-words">
              {w.title}
              <span className={`chip ${STATUS_CHIP[w.status]}`}>{w.status}</span>
              {locked && (
                <span className="chip chip-progress" title="Cannot be edited or deactivated while tasks are in progress">
                  <Lock size={12} aria-hidden="true" /> {lockChipText(n)}
                </span>
              )}
            </h2>
            <p className="mt-0.5 break-words text-sm text-ink-muted">{w.description || <i>No description</i>}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className="btn btn-secondary btn-sm" aria-disabled={locked || undefined} title={lockTitle} onClick={onEdit}>
              <Pencil size={14} aria-hidden="true" /> Edit
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => onAsk('clone')}>
              <Copy size={14} aria-hidden="true" /> Clone
            </button>
            {w.status === 'Active' ? (
              <button type="button" className="btn btn-secondary btn-sm" aria-disabled={locked || undefined} title={lockTitle} onClick={() => onAsk('deactivate')}>
                <Power size={14} aria-hidden="true" /> Deactivate
              </button>
            ) : (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => onAsk('activate')}>
                <Power size={14} aria-hidden="true" /> Activate
              </button>
            )}
          </div>
        </div>

        {steps.length > 0 && <StepChain steps={steps} />}

        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs text-ink-subtle">
          <span>{plural(w.stepCount, 'approval step')}</span>
          {(w.createdByName || w.createdAt) && (
            <span>Created{w.createdByName ? ` by ${w.createdByName}` : ''}{w.createdAt ? `, ${formatDate(w.createdAt)}` : ''}</span>
          )}
          <button
            type="button"
            className="btn btn-primary btn-sm ml-auto font-bold"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={onToggle}
          >
            {open ? 'Hide details' : 'Show details'}
            {open ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
          </button>
        </div>

        {open && (
          <div id={panelId} className="border-t border-hairline pt-3">
            {(!detail || detail.status === 'loading') && <p className="text-sm text-ink-muted" role="status">Loading details...</p>}
            {detail?.status === 'error' && (
              <p className="flex flex-wrap items-center gap-2 text-sm text-error" role="alert">
                Couldn't load the details.
                <button type="button" className="btn btn-secondary btn-sm" onClick={onRetryDetail}>Try again</button>
              </p>
            )}
            {detail?.status === 'ready' && (
              <div className="space-y-3">
                <p className="break-words text-sm text-ink-muted">{detail.data.description || <i>No description</i>}</p>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-ink-subtle">Journey</p>
                  <Journey
                    detailed
                    steps={[...detail.data.steps].sort((a, b) => a.stepOrder - b.stepOrder).map((s) => ({
                      name: s.stepName, roleName: s.approverRoleName, instructions: s.description,
                      onReject: s.onRejectAction, escalationHours: s.escalationHours,
                    }))}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </article>
    </li>
  );
};

export default WorkflowList;
