import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  AlertCircle, Check, ChevronDown, ChevronLeft, ChevronUp, Loader2, Lock, Plus, Sparkles, Trash2, Undo2,
} from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';
import type { PaginatedResponse, Workflow, WorkflowDetail, WorkflowRole, WorkflowStatus } from '../../models';
import { Journey } from './WorkflowJourney';
import { Banner, ConfirmDialog } from './WorkflowParts';
import {
  LIST_LIMIT, MAX_ESCALATION, MAX_STEPS, MIN_ESCALATION, createRequest, descriptionKey, draftFromDetail, emptyDraft,
  errorMessage, escalationKey, fieldId, instructionsKey, isLocked, lockedMessage, nameKey, newStep, plural, roleKey,
  stepsKey, titleKey, updateRequest, validateDraft, type FormErrors, type StepDraft, type WorkflowDraft,
} from './workflowUtils';

type Phase = 'loading' | 'ready' | 'error' | 'missing' | 'locked';
type RejectChoice = StepDraft['onReject'];

const ADD_STEP_ID = 'wf-add-step';

const Required: React.FC = () => <span className="text-error" aria-hidden="true">*</span>;

const FieldError: React.FC<{ errors: FormErrors; name: string }> = ({ errors, name }) =>
  errors[name] ? (
    <p id={`${fieldId(name)}-err`} className="field-error flex items-center gap-1">
      <AlertCircle size={13} aria-hidden="true" /> {errors[name]}
    </p>
  ) : null;

const invalid = (errors: FormErrors, name: string) =>
  errors[name] ? { 'aria-invalid': true as const, 'aria-describedby': `${fieldId(name)}-err` } : {};

interface RadioCardsProps {
  labelId: string;
  value: RejectChoice;
  stepIndex: number;
  onChange: (v: RejectChoice) => void;
}

/** "If this step is rejected": two radio cards with arrow-key movement. */
const RejectChoices: React.FC<RadioCardsProps> = ({ labelId, value, stepIndex, onChange }) => {
  const options: { value: RejectChoice; title: string; help: string }[] = [
    { value: 'Cancel', title: 'Cancel the task', help: 'It ends here.' },
    { value: 'GoBack', title: 'Send back one step', help: stepIndex === 0 ? 'Back to the person who did the work.' : `Back to step ${stepIndex}.` },
  ];
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (e: React.KeyboardEvent, from: number) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const to = (from + step + options.length) % options.length;
    onChange(options[to].value);
    refs.current[to]?.focus();
  };
  return (
    <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-labelledby={labelId}>
      {options.map((o, i) => {
        const checked = value === o.value;
        return (
          <button
            key={o.value}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => move(e, i)}
            className={`grid cursor-pointer grid-cols-[18px_1fr] gap-2 rounded-card border p-2.5 text-left text-ink ${
              checked ? 'border-accent bg-accent-soft' : 'border-hairline-strong bg-canvas hover:bg-surface-1'}`}
          >
            <span className={`mt-0.5 grid h-4 w-4 place-items-center rounded-full border-2 ${checked ? 'border-accent' : 'border-hairline-strong'}`} aria-hidden="true">
              {checked && <span className="h-2 w-2 rounded-full bg-accent" />}
            </span>
            <span>
              <b className="block text-[13px]">{o.title}</b>
              <span className="text-xs text-ink-muted">{o.help}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
};

const WorkflowBuilder: React.FC = () => {
  const { id } = useParams();
  const editId = id === undefined ? null : Number(id);
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>('loading');
  const [loadMessage, setLoadMessage] = useState('');
  const [roles, setRoles] = useState<WorkflowRole[]>([]);
  const [others, setOthers] = useState<string[]>([]);
  const [lockedWorkflow, setLockedWorkflow] = useState<Workflow | null>(null);
  const [currentStatus, setCurrentStatus] = useState<WorkflowStatus>('Draft');
  const [draft, setDraft] = useState<WorkflowDraft>(() => emptyDraft(null));
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState<'draft' | 'publish' | null>(null);
  const [formalizing, setFormalizing] = useState(false);
  const [original, setOriginal] = useState<string | null>(null);
  const [focusTick, setFocusTick] = useState(0);
  const stepCount = useRef(1);
  stepCount.current = draft.steps.length;

  const load = useCallback(async () => {
    setPhase('loading');
    const invalidId = editId !== null && !Number.isInteger(editId);
    if (invalidId) { setLoadMessage('Workflow not found.'); setPhase('missing'); return; }
    try {
      const [rolesRes, listRes, detailRes] = await Promise.all([
        axiosInstance.get<WorkflowRole[]>('/Workflow/roles'),
        axiosInstance.get<PaginatedResponse<Workflow>>(`/Workflow?page=1&limit=${LIST_LIMIT}`).catch(() => null),
        editId === null ? Promise.resolve(null) : axiosInstance.get<WorkflowDetail>(`/Workflow/${editId}`),
      ]);
      const roleList = rolesRes.data;
      if (!roleList?.length) { setLoadMessage('No approver roles are available, so a workflow cannot be built yet.'); setPhase('error'); return; }
      const list = listRes?.data.data ?? [];
      setRoles(roleList);
      setOthers(list.filter((w) => w.workflowId !== editId).map((w) => w.title));
      if (detailRes) {
        const self = list.find((w) => w.workflowId === editId);
        if (self && isLocked(self)) { setLockedWorkflow(self); setPhase('locked'); return; }
        setCurrentStatus(detailRes.data.status);
        setDraft(draftFromDetail(detailRes.data));
      } else {
        setDraft(emptyDraft(roleList[0].roleId));
      }
      setPhase('ready');
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) { setLoadMessage(errorMessage(err, 'Workflow not found.')); setPhase('missing'); return; }
      setLoadMessage("We couldn't load this page.");
      setPhase('error');
    }
  }, [editId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (focusTick === 0) return;
    document.getElementById(fieldId(nameKey(stepCount.current - 1)))?.focus();
  }, [focusTick]);

  const roleName = (roleId: number | null) => roles.find((r) => r.roleId === roleId)?.roleName ?? 'Approver';
  const clearError = (...keys: string[]) => setErrors((e) => {
    if (!keys.some((k) => k in e)) return e;
    const next = { ...e };
    keys.forEach((k) => delete next[k]);
    return next;
  });

  const setTitle = (title: string) => { setDraft((d) => ({ ...d, title })); clearError(titleKey); };
  const setDescription = (description: string) => { setDraft((d) => ({ ...d, description })); clearError(descriptionKey); };
  const patchStep = (i: number, patch: Partial<StepDraft>, ...clears: string[]) => {
    setDraft((d) => ({ ...d, steps: d.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
    clearError(...clears);
  };
  const addStep = () => {
    setDraft((d) => (d.steps.length >= MAX_STEPS ? d : { ...d, steps: [...d.steps, newStep(roles[0]?.roleId ?? null)] }));
    clearError(stepsKey);
    setFocusTick((t) => t + 1);
  };
  const removeStep = (i: number) => {
    setDraft((d) => ({ ...d, steps: d.steps.filter((_, j) => j !== i) }));
    setErrors({});
  };
  const moveStep = (i: number, delta: -1 | 1) => {
    setDraft((d) => {
      const steps = [...d.steps];
      [steps[i], steps[i + delta]] = [steps[i + delta], steps[i]];
      return { ...d, steps };
    });
    setErrors({});
  };

  const formalize = async () => {
    const raw = draft.description.trim();
    if (!raw || formalizing) return;
    setFormalizing(true);
    try {
      const res = await axiosInstance.post<{ formalizedText: string }>('/Task/formalize-description', { rawText: raw, context: 'workflow' });
      setOriginal(draft.description);
      setDescription(res.data.formalizedText);
    } catch {
      toast.error("Couldn't formalize the description. Your text was kept.");
    } finally {
      setFormalizing(false);
    }
  };
  const restore = () => {
    if (original === null) return;
    setDescription(original);
    setOriginal(null);
  };

  /** Runs the same rules as the server; on failure shows the messages and focuses the first bad field. */
  const check = (): boolean => {
    const found = validateDraft(draft, others);
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) document.getElementById(first === stepsKey ? ADD_STEP_ID : fieldId(first))?.focus();
    return !first;
  };

  const save = async (status: 'Draft' | 'Active') => {
    setServerError('');
    setSaving(status === 'Draft' && editId === null ? 'draft' : 'publish');
    try {
      if (editId === null) await axiosInstance.post('/Workflow', createRequest(draft, status));
      else await axiosInstance.put(`/Workflow/${editId}`, updateRequest(draft, currentStatus));
      const title = draft.title.trim();
      toast.success(editId !== null ? `“${title}” saved.` : status === 'Active' ? `“${title}” saved and active.` : `“${title}” saved as a draft.`);
      navigate('/workflows');
    } catch (err) {
      setConfirming(false);
      setServerError(errorMessage(err, 'Could not save this workflow. Please try again.'));
    } finally {
      setSaving(null);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (check()) setConfirming(true);
  };
  const onSaveDraft = () => { if (!saving && check()) save('Draft'); };

  const back = (
    <Link to="/workflows" className="btn btn-ghost btn-sm"><ChevronLeft size={15} aria-hidden="true" /> Back to workflows</Link>
  );

  if (phase === 'loading') {
    return (
      <div className="mx-auto max-w-5xl space-y-3" role="status" aria-live="polite">
        <span className="sr-only">Loading</span>
        <div className="card h-64 animate-pulse bg-surface-1" aria-hidden="true" />
      </div>
    );
  }

  if (phase === 'error' || phase === 'missing') {
    return (
      <div className="mx-auto max-w-5xl space-y-3">
        {back}
        <div className="card empty-state flex flex-col items-center gap-3" role="alert">
          <AlertCircle size={28} className="text-error" aria-hidden="true" />
          <p>{loadMessage}</p>
          {phase === 'error' && <button type="button" className="btn btn-secondary btn-sm" onClick={load}>Try again</button>}
        </div>
      </div>
    );
  }

  if (phase === 'locked' && lockedWorkflow) {
    return (
      <div className="mx-auto max-w-5xl space-y-3">
        {back}
        <div className="card flex flex-col items-center gap-3 p-8 text-center">
          <span className="chip chip-progress h-10 w-10 justify-center rounded-full"><Lock size={20} aria-hidden="true" /></span>
          <h1 className="section-title">This workflow can't be edited right now</h1>
          <p className="max-w-md text-sm text-ink-muted" role="alert">{lockedMessage(lockedWorkflow, 'modify')}</p>
          <Link to="/workflows" className="btn btn-primary">Back to workflows</Link>
        </div>
      </div>
    );
  }

  const isNew = editId === null;
  const errorCount = Object.keys(errors).length;
  const busy = saving !== null;
  const title = isNew ? 'New workflow' : 'Edit workflow';

  return (
    <div className="mx-auto max-w-6xl space-y-3">
      <div className="flex flex-wrap items-center gap-2.5">
        {back}
        <h1 className="page-title !text-xl">{title}</h1>
      </div>

      <div className="grid items-start gap-4 min-[900px]:grid-cols-[minmax(0,1fr)_340px]">
        <form className="card flex flex-col gap-5 p-5" noValidate onSubmit={onSubmit} aria-label={title}>
          {serverError && <Banner message={serverError} />}
          {errorCount > 0 && (
            <div className="alert alert-warning flex items-start gap-2" role="alert">
              <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>Please fix {plural(errorCount, 'thing')} below.</span>
            </div>
          )}

          <div>
            <label className="label !text-[13px] !text-ink" htmlFor={fieldId(titleKey)}>Workflow title <Required /></label>
            <input
              id={fieldId(titleKey)}
              className={`input ${errors[titleKey] ? 'input-error' : ''}`}
              placeholder="e.g. Expense Approval"
              value={draft.title}
              autoFocus={isNew}
              onChange={(e) => setTitle(e.target.value)}
              {...invalid(errors, titleKey)}
            />
            <FieldError errors={errors} name={titleKey} />
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="label !mb-0 !text-[13px] !text-ink" htmlFor={fieldId(descriptionKey)}>
                Description <span className="font-normal text-ink-subtle">(optional)</span>
              </label>
              <span className="flex gap-1.5">
                {original !== null && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={restore}>
                    <Undo2 size={14} aria-hidden="true" /> Restore original
                  </button>
                )}
                <button type="button" className="btn btn-ghost btn-sm !text-accent" onClick={formalize} disabled={formalizing || !draft.description.trim()}>
                  {formalizing ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Sparkles size={14} aria-hidden="true" />}
                  {formalizing ? 'Formalizing...' : 'Formalize with AI'}
                </button>
              </span>
            </div>
            <textarea
              id={fieldId(descriptionKey)}
              className={`input mt-1.5 resize-y ${errors[descriptionKey] ? 'input-error' : ''}`}
              rows={3}
              placeholder="What is this workflow for?"
              value={draft.description}
              onChange={(e) => setDescription(e.target.value)}
              {...invalid(errors, descriptionKey)}
            />
            <FieldError errors={errors} name={descriptionKey} />
          </div>

          <section aria-labelledby="wf-steps-heading">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 id="wf-steps-heading" className="section-title">Approval steps</h2>
              <span className="caption">The assignee's own work is step 0 and is added automatically.</span>
            </div>
            <FieldError errors={errors} name={stepsKey} />
            <div className="flex flex-col gap-3">
              {draft.steps.map((s, i) => {
                const last = i === draft.steps.length - 1;
                return (
                  <fieldset key={s.key} aria-label={`Step ${i + 1}`} className="m-0 flex min-w-0 flex-col gap-3 rounded-card border border-hairline-strong bg-surface-1 p-3.5">
                    <div className="flex items-center gap-2">
                      <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-on-accent" aria-hidden="true">{i + 1}</span>
                      <b className="min-w-0 flex-1 truncate">{s.name || 'New step'}</b>
                      <button type="button" className="btn btn-ghost btn-sm !px-2" aria-label={`Move step ${i + 1} up`} disabled={i === 0} onClick={() => moveStep(i, -1)}>
                        <ChevronUp size={16} aria-hidden="true" />
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm !px-2" aria-label={`Move step ${i + 1} down`} disabled={last} onClick={() => moveStep(i, 1)}>
                        <ChevronDown size={16} aria-hidden="true" />
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm !px-2 !text-error" aria-label={`Remove step ${i + 1}`} disabled={draft.steps.length === 1} onClick={() => removeStep(i)}>
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="label !text-[13px] !text-ink" htmlFor={fieldId(nameKey(i))}>Step name <Required /></label>
                        <input
                          id={fieldId(nameKey(i))}
                          className={`input ${errors[nameKey(i)] ? 'input-error' : ''}`}
                          placeholder="e.g. Manager review"
                          value={s.name}
                          onChange={(e) => patchStep(i, { name: e.target.value }, nameKey(i))}
                          {...invalid(errors, nameKey(i))}
                        />
                        <FieldError errors={errors} name={nameKey(i)} />
                      </div>
                      <div>
                        <label className="label !text-[13px] !text-ink" htmlFor={fieldId(roleKey(i))}>Who approves</label>
                        <select
                          id={fieldId(roleKey(i))}
                          className={`input ${errors[roleKey(i)] ? 'input-error' : ''}`}
                          value={s.roleId ?? ''}
                          onChange={(e) => patchStep(i, { roleId: Number(e.target.value) }, roleKey(i))}
                          {...invalid(errors, roleKey(i))}
                        >
                          {roles.map((r) => <option key={r.roleId} value={r.roleId}>{r.roleName}</option>)}
                        </select>
                        <p className="caption mt-1">Anyone with this role can act; the first to act takes it.</p>
                        <FieldError errors={errors} name={roleKey(i)} />
                      </div>
                    </div>

                    <div>
                      <label className="label !text-[13px] !text-ink" htmlFor={fieldId(instructionsKey(i))}>
                        Instructions for the approver <span className="font-normal text-ink-subtle">(optional)</span>
                      </label>
                      <input
                        id={fieldId(instructionsKey(i))}
                        className={`input ${errors[instructionsKey(i)] ? 'input-error' : ''}`}
                        placeholder="What should they check?"
                        value={s.instructions}
                        onChange={(e) => patchStep(i, { instructions: e.target.value }, instructionsKey(i))}
                        {...invalid(errors, instructionsKey(i))}
                      />
                      <FieldError errors={errors} name={instructionsKey(i)} />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <span className="label !text-[13px] !text-ink" id={`wf-reject-${s.key}`}>If this step is rejected</span>
                        <RejectChoices labelId={`wf-reject-${s.key}`} value={s.onReject} stepIndex={i} onChange={(v) => patchStep(i, { onReject: v })} />
                      </div>
                      <div>
                        <label className="label !text-[13px] !text-ink" htmlFor={fieldId(escalationKey(i))}>
                          Escalate after <span className="font-normal text-ink-subtle">(optional)</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            id={fieldId(escalationKey(i))}
                            type="number"
                            min={MIN_ESCALATION}
                            max={MAX_ESCALATION}
                            className={`input max-w-28 ${errors[escalationKey(i)] ? 'input-error' : ''}`}
                            value={s.escalation}
                            onChange={(e) => patchStep(i, { escalation: e.target.value }, escalationKey(i))}
                            {...invalid(errors, escalationKey(i))}
                          />
                          <span className="text-sm text-ink-muted">hours</span>
                        </div>
                        <p className="caption mt-1">Flags the step as late when nobody acts in time.</p>
                        <FieldError errors={errors} name={escalationKey(i)} />
                      </div>
                    </div>
                  </fieldset>
                );
              })}
              <button
                type="button"
                id={ADD_STEP_ID}
                className="btn btn-secondary self-start"
                onClick={addStep}
                disabled={draft.steps.length >= MAX_STEPS}
                title={draft.steps.length >= MAX_STEPS ? `A workflow can have at most ${MAX_STEPS} steps.` : undefined}
              >
                <Plus size={16} aria-hidden="true" /> Add step
              </button>
            </div>
          </section>

          <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-hairline pt-4">
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => navigate('/workflows')}>Cancel</button>
            <span className="flex flex-wrap gap-2">
              {isNew && (
                <button type="button" className="btn btn-secondary" disabled={busy} onClick={onSaveDraft}>
                  {saving === 'draft' && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                  {saving === 'draft' ? 'Saving...' : 'Save as draft'}
                </button>
              )}
              <button type="submit" className="btn btn-primary" disabled={busy}>
                <Check size={16} aria-hidden="true" /> {isNew ? 'Save and activate' : 'Save changes'}
              </button>
            </span>
          </div>
        </form>

        <aside className="card flex flex-col gap-3 p-4 min-[900px]:sticky min-[900px]:top-3" aria-label="How tasks will flow">
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-subtle">How tasks will flow</p>
          <p className="break-words text-base font-bold">{draft.title.trim() || <span className="font-medium text-ink-subtle">Your workflow title</span>}</p>
          <Journey steps={draft.steps.map((s) => ({
            name: s.name.trim(), roleName: roleName(s.roleId), onReject: s.onReject,
            escalationHours: Number.isInteger(Number(s.escalation)) && Number(s.escalation) > 0 ? Number(s.escalation) : null,
          }))} />
        </aside>
      </div>

      {confirming && (
        <ConfirmDialog
          tone="accent"
          icon={<Check size={20} />}
          title={isNew ? 'Save and activate?' : 'Save these changes?'}
          subject={draft.title.trim()}
          bullets={[
            isNew ? 'The workflow is saved and becomes available in Assign Task straight away.' : 'The new steps apply to every task assigned from now on.',
            `${plural(draft.steps.length, 'approval step')}: ${draft.steps.map((s) => s.name.trim()).join(' → ')}.`,
            ...(!isNew && currentStatus !== 'Active' ? [`Its status stays ${currentStatus}.`] : []),
          ]}
          confirmLabel={isNew ? 'Yes, save and activate' : 'Yes, save'}
          busyLabel="Saving..."
          busy={busy}
          onConfirm={() => save('Active')}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
};

export default WorkflowBuilder;
