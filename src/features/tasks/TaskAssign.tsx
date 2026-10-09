import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle, Loader2, RotateCcw, Send, Sparkles } from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';
import EmptyState from '../../components/EmptyState';
import type {
  AssignableUser, PaginatedResponse, TaskCategory, TaskCreateRequest, Workflow, WorkflowDetail, WorkflowStep,
} from '../../models';
import { DialogShell } from './TaskDialogs';
import {
  CategoryChips, CHIP_BASE, CHIP_OFF, CHIP_ON, PersonPicker, PreviewCard, PriorityChips, WorkflowCards,
} from './AssignParts';
import type { StepsState } from './AssignParts';
import {
  DESCRIPTION_MAX, DUE_CHIPS, EMPTY_FORM, TITLE_MAX, errorMessage, formatDue, isoDate, sortSteps, validateStep,
} from './assignUtils';
import type { AssignForm, FieldKey, FormErrors } from './assignUtils';

const STEPS = ['The task', 'Workflow and person'] as const;
const FIELD_ORDER: FieldKey[] = ['title', 'description', 'dueDate', 'workflowId', 'assignedTo'];
const FIELD_DOM_ID: Record<FieldKey, string> = {
  title: 'assign-title',
  description: 'assign-description',
  dueDate: 'assign-due',
  workflowId: 'assign-workflow-first',
  assignedTo: 'assign-person',
};

interface Done {
  title: string;
  who: string;
  workflow: string;
  keep: Pick<AssignForm, 'workflowId' | 'priority' | 'categoryId'>;
}

const Counter: React.FC<{ value: number; max: number }> = ({ value, max }) => (
  <span className={`caption tabular-nums ${value > max ? 'text-error font-semibold' : ''}`}>{value}/{max}</span>
);

const FieldError: React.FC<{ id: string; message?: string }> = ({ id, message }) =>
  message ? <p id={id} className="field-error flex items-center gap-1"><AlertTriangle size={12} aria-hidden="true" />{message}</p> : null;

const TaskAssign: React.FC = () => {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<AssignForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [formalizing, setFormalizing] = useState(false);
  const [originalDescription, setOriginalDescription] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const [focusReq, setFocusReq] = useState<{ id: string; n: number } | null>(null);

  const [stepsById, setStepsById] = useState<Record<number, WorkflowStep[] | 'error'>>({});
  const stepsRef = useRef(stepsById);
  const inflight = useRef(new Set<number>());

  const labelIds = { priority: useId(), category: useId(), due: useId(), workflow: useId(), person: useId() };

  const focusId = useCallback((id: string) => setFocusReq((r) => ({ id, n: (r?.n ?? 0) + 1 })), []);
  const patch = (changes: Partial<AssignForm>) => {
    setForm((f) => ({ ...f, ...changes }));
    const cleared = (Object.keys(changes) as FieldKey[]).filter((k) => k in errors);
    if (cleared.length) setErrors((e) => { const next = { ...e }; cleared.forEach((k) => delete next[k]); return next; });
  };

  useEffect(() => {
    if (!focusReq) return;
    document.getElementById(focusReq.id)?.focus();
  }, [focusReq]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    const [wf, u, cats] = await Promise.allSettled([
      axiosInstance.get<PaginatedResponse<Workflow>>('/Workflow?page=1&limit=1000'),
      axiosInstance.get<AssignableUser[]>('/Task/assignable-users'),
      axiosInstance.get<TaskCategory[]>('/Task/categories'),
    ]);
    if (wf.status === 'fulfilled') setWorkflows(wf.value.data.data.filter((w) => w.status === 'Active'));
    if (u.status === 'fulfilled') setUsers(u.value.data);
    if (cats.status === 'fulfilled') setCategories(cats.value.data);
    setLoadFailed(wf.status === 'rejected' || u.status === 'rejected');
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Workflow steps for the journey: fetched when a workflow is picked, cached per id.
  useEffect(() => { stepsRef.current = stepsById; });
  useEffect(() => {
    const id = form.workflowId;
    if (id === null || Array.isArray(stepsRef.current[id]) || inflight.current.has(id)) return;
    inflight.current.add(id);
    setStepsById((s) => { const next = { ...s }; delete next[id]; return next; });
    axiosInstance.get<WorkflowDetail>(`/Workflow/${id}`)
      .then((res) => setStepsById((s) => ({ ...s, [id]: sortSteps(res.data.steps ?? []) })))
      .catch(() => setStepsById((s) => ({ ...s, [id]: 'error' })))
      .finally(() => inflight.current.delete(id));
  }, [form.workflowId]);

  const workflow = workflows.find((w) => w.workflowId === form.workflowId);
  const assignee = users.find((u) => u.userId === form.assignedTo);
  const category = categories.find((c) => c.categoryId === form.categoryId);
  const steps: StepsState = form.workflowId === null ? undefined : (stepsById[form.workflowId] ?? 'loading');

  const showErrors = (found: FormErrors, forStep: 1 | 2) => {
    setErrors(found);
    const first = FIELD_ORDER.find((k) => found[k]);
    if (!first) return false;
    setStep(forStep);
    focusId(FIELD_DOM_ID[first]);
    return true;
  };

  const goBack = () => { setErrors({}); setStep(1); focusId('assign-step-heading'); };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    if (step === 1) {
      if (showErrors(validateStep(1, form), 1)) return;
      setStep(2);
      focusId('assign-step-heading');
      return;
    }
    if (showErrors(validateStep(2, form), 2)) return;
    if (showErrors(validateStep(1, form), 1)) return; // e.g. midnight passed while filling in
    setErrors({});
    setConfirming(true);
  };

  const formalize = async () => {
    const raw = form.description.trim();
    if (!raw) return;
    setFormalizing(true);
    try {
      const res = await axiosInstance.post<{ formalizedText: string }>('/Task/formalize-description', { rawText: raw, context: 'task' });
      setOriginalDescription(form.description);
      patch({ description: res.data.formalizedText });
    } catch (err) {
      toast.error(errorMessage(err, 'Could not formalize the description. Your text is unchanged.'));
    } finally {
      setFormalizing(false);
    }
  };

  const restoreDescription = () => {
    if (originalDescription === null) return;
    patch({ description: originalDescription });
    setOriginalDescription(null);
    focusId('assign-description');
  };

  const confirm = async () => {
    if (form.workflowId === null || form.assignedTo === null || !workflow || !assignee) return;
    const body: TaskCreateRequest = {
      title: form.title.trim(),
      description: form.description.trim(),
      workflowId: form.workflowId,
      assignedTo: form.assignedTo,
      priority: form.priority,
      ...(form.dueDate ? { dueDate: form.dueDate } : {}),
      ...(form.categoryId !== null ? { categoryId: form.categoryId } : {}),
    };
    setSaving(true);
    try {
      await axiosInstance.post('/Task/assign', body);
      setConfirming(false);
      setDone({ title: body.title, who: assignee.name, workflow: workflow.title, keep: { workflowId: form.workflowId, priority: form.priority, categoryId: form.categoryId } });
      focusId('assign-another');
      // Open-task counts changed; refresh them quietly.
      axiosInstance.get<AssignableUser[]>('/Task/assignable-users').then((r) => setUsers(r.data)).catch(() => undefined);
    } catch (err) {
      setConfirming(false);
      setServerError(errorMessage(err, 'Could not assign the task. Please try again.'));
      focusId('assign-banner');
    } finally {
      setSaving(false);
    }
  };

  const reset = (keep?: Done['keep']) => {
    setForm({ ...EMPTY_FORM, ...(keep ?? {}) });
    setErrors({});
    setServerError(null);
    setOriginalDescription(null);
    setDone(null);
    setStep(1);
    focusId('assign-title');
  };

  if (loading) return <div className="empty-state" role="status">Loading...</div>;

  if (loadFailed) {
    return (
      <div className="mx-auto max-w-xl card card-pad space-y-3">
        <div role="alert" className="alert alert-error">We could not load what this screen needs. Check your connection and try again.</div>
        <button type="button" className="btn btn-secondary" onClick={() => void load()}>Try again</button>
      </div>
    );
  }

  if (workflows.length === 0) {
    return (
      <div className="mx-auto max-w-xl card card-pad">
        <h1 className="sr-only">Assign Task</h1>
        <EmptyState illustration="empty" title="No active workflows" hint="A task needs an active workflow to follow. Activate one, then come back to assign it.">
          <Link to="/workflows" className="btn btn-primary mt-2">Go to Workflows</Link>
        </EmptyState>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="sr-only">Assign Task</h1>
        <div role="status" className="card card-pad flex flex-col items-start gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-success text-on-accent"><Check size={22} aria-hidden="true" /></span>
          <h2 className="section-title">Task assigned</h2>
          <p className="text-sm text-ink-muted">
            <strong className="text-ink break-words">{done.title}</strong> was assigned to <strong className="text-ink">{done.who}</strong> through{' '}
            <strong className="text-ink">{done.workflow}</strong>. They have been notified.
          </p>
          <div className="flex flex-wrap gap-2">
            <button id="assign-another" type="button" className="btn btn-primary" onClick={() => reset(done.keep)}>Assign another with the same workflow</button>
            <button type="button" className="btn btn-secondary" onClick={() => reset()}>Start a blank form</button>
            <Link to={`/all-tasks?q=${encodeURIComponent(done.title)}`} className="btn btn-ghost">View in All Tasks</Link>
          </div>
          <p className="caption">&ldquo;Assign another&rdquo; keeps the workflow, priority and category, and clears the title, description, person and date.</p>
        </div>
      </div>
    );
  }

  const errorCount = Object.keys(errors).length;
  const today = isoDate();
  const firstApproval = Array.isArray(steps) ? steps[0] : undefined;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="sr-only">Assign Task</h1>
        <p className="caption">Start a workflow for an employee by assigning a task.</p>
      </div>

      <div className="grid gap-6 min-[900px]:grid-cols-[minmax(0,1fr)_340px]">
        <form onSubmit={onSubmit} noValidate className="card card-pad space-y-5 min-w-0">
          <ol className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Progress">
            {STEPS.map((name, i) => {
              const n = i + 1;
              const state = n < step ? 'done' : n === step ? 'current' : 'todo';
              return (
                <li key={name} aria-current={n === step ? 'step' : undefined} className={`flex items-center gap-2 text-sm font-semibold ${state === 'todo' ? 'text-ink-subtle' : 'text-ink'}`}>
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${state === 'todo' ? 'bg-surface-2 text-ink-muted' : state === 'done' ? 'bg-success text-on-accent' : 'bg-accent text-on-accent'}`}>
                    {state === 'done' ? <Check size={13} strokeWidth={3} aria-hidden="true" /> : n}
                  </span>
                  <span>{name}</span>
                </li>
              );
            })}
          </ol>

          {serverError && (
            <div id="assign-banner" role="alert" tabIndex={-1} className="alert alert-warning flex items-start gap-2">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{serverError}</span>
            </div>
          )}
          {errorCount > 0 && (
            <div role="alert" className="alert alert-warning flex items-start gap-2">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>Please fix {errorCount} thing{errorCount > 1 ? 's' : ''} below.</span>
            </div>
          )}

          <h2 id="assign-step-heading" tabIndex={-1} className="section-title outline-none">
            Step {step} of 2: {STEPS[step - 1]}
          </h2>

          {step === 1 && (
            <div className="space-y-5">
              <div>
                <div className="flex items-baseline justify-between gap-2">
                  <label htmlFor="assign-title" className="label">Task title <span className="text-error" aria-hidden="true">*</span></label>
                  <Counter value={form.title.length} max={TITLE_MAX} />
                </div>
                <input
                  id="assign-title"
                  className={`input ${errors.title ? 'input-error' : ''}`}
                  autoComplete="off"
                  placeholder="e.g. Q1 expense report approval"
                  value={form.title}
                  aria-required="true"
                  aria-invalid={errors.title ? true : undefined}
                  aria-describedby={errors.title ? 'assign-title-error' : undefined}
                  onChange={(e) => patch({ title: e.target.value })}
                />
                <FieldError id="assign-title-error" message={errors.title} />
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor="assign-description" className="label mb-0">Description <span className="font-normal text-ink-subtle">(optional)</span></label>
                  <span className="flex items-center gap-1">
                    {originalDescription !== null && (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={restoreDescription} disabled={formalizing}>
                        <RotateCcw size={13} aria-hidden="true" /> Restore original
                      </button>
                    )}
                    <button type="button" className="btn btn-ghost btn-sm text-accent" onClick={() => void formalize()} disabled={formalizing || !form.description.trim()}>
                      <Sparkles size={13} className={formalizing ? 'animate-pulse' : ''} aria-hidden="true" />
                      {formalizing ? 'Formalizing...' : 'Formalize with AI'}
                    </button>
                  </span>
                </div>
                <textarea
                  id="assign-description"
                  className={`input mt-1 resize-none ${errors.description ? 'input-error' : ''}`}
                  rows={4}
                  placeholder="Type rough notes, then use Formalize with AI"
                  value={form.description}
                  aria-invalid={errors.description ? true : undefined}
                  aria-describedby={errors.description ? 'assign-description-error' : undefined}
                  onChange={(e) => patch({ description: e.target.value })}
                />
                <div className="flex justify-between gap-2">
                  <FieldError id="assign-description-error" message={errors.description} />
                  <span className="ml-auto"><Counter value={form.description.length} max={DESCRIPTION_MAX} /></span>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <span id={labelIds.priority} className="label">Priority</span>
                  <PriorityChips labelledBy={labelIds.priority} value={form.priority} onChange={(priority) => patch({ priority })} />
                </div>
                <div>
                  <span id={labelIds.category} className="label">Category <span className="font-normal text-ink-subtle">(optional)</span></span>
                  <CategoryChips labelledBy={labelIds.category} categories={categories} value={form.categoryId} onChange={(categoryId) => patch({ categoryId })} />
                </div>
              </div>

              <div>
                <span id={labelIds.due} className="label">Due date <span className="font-normal text-ink-subtle">(optional)</span></span>
                <div role="group" aria-labelledby={labelIds.due} className="flex flex-wrap items-center gap-2">
                  {DUE_CHIPS.map((c) => {
                    const value = isoDate(c.days);
                    const on = form.dueDate === value;
                    return (
                      <button key={c.label} type="button" aria-pressed={on} className={`${CHIP_BASE} ${on ? CHIP_ON : CHIP_OFF}`} onClick={() => patch({ dueDate: value })}>
                        {c.label}
                      </button>
                    );
                  })}
                  <input
                    id="assign-due"
                    type="date"
                    min={today}
                    aria-label="Pick a due date"
                    className={`input w-auto font-mono ${errors.dueDate ? 'input-error' : ''}`}
                    value={form.dueDate}
                    aria-invalid={errors.dueDate ? true : undefined}
                    aria-describedby={errors.dueDate ? 'assign-due-error' : undefined}
                    onChange={(e) => patch({ dueDate: e.target.value })}
                  />
                  {form.dueDate && (
                    <>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => patch({ dueDate: '' })}>Clear</button>
                      <span className="caption">{formatDue(form.dueDate)}</span>
                    </>
                  )}
                </div>
                <FieldError id="assign-due-error" message={errors.dueDate} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <span id={labelIds.workflow} className="label">Workflow <span className="text-error" aria-hidden="true">*</span> <span className="font-normal text-ink-subtle">(active only)</span></span>
                <WorkflowCards
                  labelledBy={labelIds.workflow}
                  workflows={workflows}
                  value={form.workflowId}
                  onChange={(workflowId) => patch({ workflowId })}
                  describedBy={errors.workflowId ? 'assign-workflow-error' : undefined}
                  firstId="assign-workflow-first"
                />
                <FieldError id="assign-workflow-error" message={errors.workflowId} />
              </div>
              <div>
                <span id={labelIds.person} className="label">Assign to <span className="text-error" aria-hidden="true">*</span> <span className="font-normal text-ink-subtle">(does the work first)</span></span>
                <PersonPicker
                  users={users}
                  value={form.assignedTo}
                  onChange={(assignedTo) => patch({ assignedTo })}
                  invalid={Boolean(errors.assignedTo)}
                  errorId="assign-person-error"
                  inputId="assign-person"
                  labelId={labelIds.person}
                />
                <FieldError id="assign-person-error" message={errors.assignedTo} />
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4">
            {step === 2 ? (
              <button type="button" className="btn btn-secondary" onClick={goBack}><ArrowLeft size={16} aria-hidden="true" /> Back</button>
            ) : <span />}
            <div className="flex items-center gap-3">
              {step === 2 && <span className="caption hidden sm:inline">You will be asked to confirm first.</span>}
              <button type="submit" className="btn btn-primary">
                {step === 1 ? <>Continue <ArrowRight size={16} aria-hidden="true" /></> : <><Send size={16} aria-hidden="true" /> Review and assign</>}
              </button>
            </div>
          </div>
        </form>

        <PreviewCard form={form} workflowTitle={workflow?.title} assignee={assignee} category={category} steps={steps} />
      </div>

      {confirming && workflow && assignee && (
        <DialogShell
          tone="accent"
          icon={<Send size={20} />}
          title="Assign this task?"
          description={`${assignee.name} is notified straight away and can start working.`}
          busy={saving}
          onClose={() => setConfirming(false)}
          footer={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setConfirming(false)} disabled={saving}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={() => void confirm()} disabled={saving} data-autofocus>
                {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                {saving ? 'Assigning...' : 'Yes, assign'}
              </button>
            </>
          }
        >
          <div className="rounded-control border border-hairline bg-surface-1 px-3 py-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-subtle">Task</p>
            <p className="font-semibold text-ink break-words">{form.title.trim()}</p>
            <p className="caption">{workflow.title} · {form.priority} priority · {formatDue(form.dueDate)}</p>
          </div>
          <ul className="list-disc pl-5 text-sm text-ink-muted space-y-1">
            <li>{assignee.name} completes the work first (step 0).</li>
            <li>
              {firstApproval
                ? <>Then {steps && Array.isArray(steps) ? steps.length : workflow.stepCount} approval step{(Array.isArray(steps) ? steps.length : workflow.stepCount) === 1 ? '' : 's'}, starting with &ldquo;{firstApproval.stepName}&rdquo; (any {firstApproval.approverRoleName}).</>
                : <>Then {workflow.stepCount} approval step{workflow.stepCount === 1 ? '' : 's'} in the {workflow.title} workflow.</>}
            </li>
            <li>You can follow it from All Tasks. You cannot unassign it from here.</li>
          </ul>
        </DialogShell>
      )}
    </div>
  );
};

export default TaskAssign;
