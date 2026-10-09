import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, Search } from 'lucide-react';
import type { AssignableUser, TaskCategory, TaskPriority, Workflow, WorkflowStep } from '../../models';
import UserAvatar from '../../components/UserAvatar';
import { PrioritySignal } from './TaskDetails';
import { formatDue, sortSteps } from './assignUtils';
import type { AssignForm } from './assignUtils';

/* ---------- Radio group (roving tabindex, arrow keys) ---------- */

interface RadioOption<T> {
  value: T;
  key: string | number;
  node: React.ReactNode;
  /** Extra classes for this option (e.g. card layout). */
  className?: string;
  style?: React.CSSProperties;
  checkedStyle?: React.CSSProperties;
}

interface RadioGroupProps<T> {
  labelledBy: string;
  options: RadioOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  optionClass: string;
  checkedClass: string;
  uncheckedClass: string;
  describedBy?: string;
  /** DOM id for the first option, so validation can focus it. */
  firstId?: string;
}

export function RadioGroup<T>({
  labelledBy, options, value, onChange, className = '', optionClass, checkedClass, uncheckedClass, describedBy, firstId,
}: RadioGroupProps<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const checkedIndex = options.findIndex((o) => o.value === value);
  const tabbable = checkedIndex >= 0 ? checkedIndex : 0;

  const onKeyDown = (e: React.KeyboardEvent) => {
    const forward = e.key === 'ArrowRight' || e.key === 'ArrowDown';
    const back = e.key === 'ArrowLeft' || e.key === 'ArrowUp';
    if (!forward && !back) return;
    e.preventDefault();
    const radios = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="radio"]') ?? []);
    const current = radios.indexOf(document.activeElement as HTMLElement);
    const next = radios[(Math.max(current, 0) + (forward ? 1 : -1) + radios.length) % radios.length];
    next?.focus();
    next?.click();
  };

  return (
    <div ref={ref} role="radiogroup" aria-labelledby={labelledBy} aria-describedby={describedBy} className={className} onKeyDown={onKeyDown}>
      {options.map((o, i) => {
        const checked = i === checkedIndex;
        return (
          <button
            key={o.key}
            id={i === 0 ? firstId : undefined}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={i === tabbable ? 0 : -1}
            className={`${optionClass} ${checked ? checkedClass : uncheckedClass} ${o.className ?? ''}`}
            style={checked ? { ...o.style, ...o.checkedStyle } : o.style}
            onClick={() => onChange(o.value)}
          >
            {o.node}
          </button>
        );
      })}
    </div>
  );
}

export const CHIP_BASE = 'inline-flex items-center gap-2 h-9 px-3 rounded-pill border text-sm font-medium cursor-pointer transition-colors';
export const CHIP_ON = 'border-accent bg-accent-soft text-accent';
export const CHIP_OFF = 'border-hairline-strong bg-surface-1 text-ink hover:bg-surface-2';

/* ---------- Choosers ---------- */

export const PriorityChips: React.FC<{ labelledBy: string; value: TaskPriority; onChange: (p: TaskPriority) => void }> = ({ labelledBy, value, onChange }) => (
  <RadioGroup<TaskPriority>
    labelledBy={labelledBy}
    className="flex flex-wrap gap-2"
    optionClass={CHIP_BASE}
    checkedClass={CHIP_ON}
    uncheckedClass={CHIP_OFF}
    value={value}
    onChange={onChange}
    options={(['Low', 'Medium', 'High'] as TaskPriority[]).map((p) => ({
      value: p,
      key: p,
      node: <><span aria-hidden="true"><PrioritySignal priority={p} /></span>{p}</>,
    }))}
  />
);

export const CategoryChips: React.FC<{ labelledBy: string; categories: TaskCategory[]; value: number | null; onChange: (id: number | null) => void }> = ({
  labelledBy, categories, value, onChange,
}) => (
  <RadioGroup<number | null>
    labelledBy={labelledBy}
    className="flex flex-wrap gap-2"
    optionClass={CHIP_BASE}
    checkedClass={CHIP_ON}
    uncheckedClass={CHIP_OFF}
    value={value}
    onChange={onChange}
    options={[
      { value: null, key: 'none', node: 'None' },
      ...categories.map((c) => ({
        value: c.categoryId as number | null,
        key: c.categoryId,
        node: <><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.colorHex }} aria-hidden="true" />{c.name}</>,
      })),
    ]}
  />
);

export const WorkflowCards: React.FC<{
  labelledBy: string; workflows: Workflow[]; value: number | null; onChange: (id: number) => void; describedBy?: string; firstId?: string;
}> = ({ labelledBy, workflows, value, onChange, describedBy, firstId }) => (
  <RadioGroup<number | null>
    labelledBy={labelledBy}
    describedBy={describedBy}
    firstId={firstId}
    className="grid gap-2 sm:grid-cols-2"
    optionClass="flex items-start gap-3 rounded-card border p-3 text-left cursor-pointer transition-colors"
    checkedClass="border-accent bg-accent-soft"
    uncheckedClass="border-hairline-strong bg-surface-1 hover:bg-surface-2"
    value={value}
    onChange={(id) => id !== null && onChange(id)}
    options={workflows.map((w) => ({
      value: w.workflowId as number | null,
      key: w.workflowId,
      node: (
        <>
          <span
            aria-hidden="true"
            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${value === w.workflowId ? 'border-accent bg-accent text-on-accent' : 'border-hairline-strong bg-canvas'}`}
          >
            {value === w.workflowId && <Check size={11} strokeWidth={3} />}
          </span>
          <span className="min-w-0">
            <span className="block font-semibold text-ink break-words">{w.title}</span>
            <span className="block caption">{w.stepCount} approval step{w.stepCount === 1 ? '' : 's'}</span>
          </span>
        </>
      ),
    }))}
  />
);

/* ---------- Searchable person picker ---------- */

interface PickerProps {
  users: AssignableUser[];
  value: number | null;
  onChange: (id: number) => void;
  invalid?: boolean;
  errorId?: string;
  inputId: string;
  labelId: string;
}

export const PersonPicker: React.FC<PickerProps> = ({ users, value, onChange, invalid, errorId, inputId, labelId }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [editing, setEditing] = useState(false);
  const listId = useId();
  const changeRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const focusChange = useRef(false);

  const selected = users.find((u) => u.userId === value) ?? null;
  const showCard = selected !== null && !editing;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => !q || `${u.name} ${u.roleName} ${u.email}`.toLowerCase().includes(q));
  }, [users, query]);

  useEffect(() => {
    if (showCard && focusChange.current) { focusChange.current = false; changeRef.current?.focus(); }
  }, [showCard]);

  const pick = (u: AssignableUser) => {
    focusChange.current = true;
    onChange(u.userId);
    setEditing(false);
    setOpen(false);
    setQuery('');
  };

  const startEditing = () => {
    setEditing(true);
    setOpen(true);
    setActive(Math.max(0, users.findIndex((u) => u.userId === value)));
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      setActive((a) => Math.min(a + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      if (open) {
        e.preventDefault();
        if (matches[active]) pick(matches[active]);
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      } else if (selected) {
        focusChange.current = true;
        setEditing(false);
      }
    }
  };

  if (showCard && selected) {
    return (
      <div className="flex items-center gap-3 rounded-card border border-hairline-strong bg-surface-1 p-3">
        <UserAvatar seed={selected.email || selected.name} size={36} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink truncate">{selected.name}</p>
          <p className="caption truncate">
            {selected.roleName}
            {selected.openTaskCount !== undefined && <> · {selected.openTaskCount} open</>}
          </p>
        </div>
        <button ref={changeRef} type="button" className="btn btn-ghost btn-sm" onClick={startEditing} aria-label={`Change person, currently ${selected.name}`}>
          Change
        </button>
      </div>
    );
  }

  const activeId = open && matches[active] ? `${listId}-o${matches[active].userId}` : undefined;
  return (
    <div
      className="relative"
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false); }}
    >
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
        <input
          ref={inputRef}
          id={inputId}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          aria-labelledby={labelId}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : undefined}
          autoComplete="off"
          placeholder="Search by name or role"
          className={`input pl-9 ${invalid ? 'input-error' : ''}`}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActive(0); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
      </div>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="People"
          className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-card border border-hairline-strong bg-canvas shadow-xl"
        >
          {matches.length === 0 && <li className="px-3 py-2 text-sm text-ink-subtle">No one matches “{query.trim()}”.</li>}
          {matches.map((u, i) => (
            <li
              key={u.userId}
              id={`${listId}-o${u.userId}`}
              role="option"
              aria-selected={i === active}
              className={`flex cursor-pointer items-center gap-3 px-3 py-2 ${i === active ? 'bg-accent-soft' : 'hover:bg-surface-1'}`}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(u)}
            >
              <UserAvatar seed={u.email || u.name} size={28} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink truncate">{u.name}</span>
                <span className="block caption truncate">{u.roleName}</span>
              </span>
              {u.openTaskCount !== undefined && <span className="caption shrink-0 tabular-nums">{u.openTaskCount} open</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/* ---------- Live preview ---------- */

export type StepsState = WorkflowStep[] | 'loading' | 'error' | undefined;

export const Journey: React.FC<{ workflowChosen: boolean; assignee?: string; steps: StepsState }> = ({ workflowChosen, assignee, steps }) => {
  if (!workflowChosen) return <p className="caption">Choose a workflow to see every step it will go through.</p>;
  const list = Array.isArray(steps) ? sortSteps(steps) : [];
  return (
    <div>
      {steps === 'loading' && <div role="status" aria-label="Loading workflow steps" className="mb-2 h-4 w-2/3 animate-pulse rounded-control bg-surface-2" />}
      {steps === 'error' && <p className="caption mb-2">We could not load this workflow&apos;s steps. It will still run through all of them after you assign.</p>}
      <ol className="space-y-0">
        <JourneyItem marker="0" title={`${assignee || 'The assignee'} does the work`} sub="Marks it complete when finished" last={false} />
        {list.map((s, i) => (
          <JourneyItem key={s.stepId} marker={String(i + 1)} title={s.stepName} sub={`Any ${s.approverRoleName} can approve, first to act wins`} last={false} />
        ))}
        <JourneyItem marker={<Check size={12} strokeWidth={3} />} title="Task completed" last done />
      </ol>
    </div>
  );
};

const JourneyItem: React.FC<{ marker: React.ReactNode; title: string; sub?: string; last: boolean; done?: boolean }> = ({ marker, title, sub, last, done }) => (
  <li className="relative grid grid-cols-[22px_1fr] gap-2.5 pb-3 last:pb-0">
    {!last && <span aria-hidden="true" className="absolute left-[10px] top-[22px] bottom-0 w-0.5 bg-hairline" />}
    <span aria-hidden="true" className={`flex h-[22px] w-[22px] items-center justify-center rounded-full text-[11px] font-bold ${done ? 'bg-success text-on-accent' : 'bg-accent-soft text-accent'}`}>{marker}</span>
    <div className="min-w-0 text-sm">
      <p className="font-semibold text-ink break-words">{title}</p>
      {sub && <p className="caption">{sub}</p>}
    </div>
  </li>
);

interface PreviewProps {
  form: AssignForm;
  workflowTitle?: string;
  assignee?: AssignableUser;
  category?: TaskCategory;
  steps: StepsState;
}

export const PreviewCard: React.FC<PreviewProps> = ({ form, workflowTitle, assignee, category, steps }) => {
  const title = form.title.trim();
  const none = <span className="font-normal text-ink-subtle">Not chosen</span>;
  return (
    <aside aria-label="What will happen" className="card card-pad space-y-4 min-[900px]:sticky min-[900px]:top-0 self-start">
      <h2 className="text-[11px] font-bold uppercase tracking-wider text-ink-subtle">What will happen</h2>
      <p className={`text-lg font-bold break-words ${title ? 'text-ink' : 'text-ink-subtle font-normal'}`}>{title || 'Your task title appears here'}</p>
      <dl className="grid grid-cols-[84px_1fr] gap-x-3 gap-y-2 text-sm">
        <dt className="text-ink-subtle">Workflow</dt>
        <dd className="font-semibold text-ink break-words">{workflowTitle ?? none}</dd>
        <dt className="text-ink-subtle">Assignee</dt>
        <dd className="flex items-center gap-2 font-semibold text-ink min-w-0">
          {assignee ? <><UserAvatar seed={assignee.email || assignee.name} size={20} /><span className="truncate">{assignee.name}</span></> : none}
        </dd>
        <dt className="text-ink-subtle">Priority</dt>
        <dd className="flex items-center gap-2 font-semibold text-ink"><PrioritySignal priority={form.priority} />{form.priority}</dd>
        <dt className="text-ink-subtle">Due</dt>
        <dd className={form.dueDate ? 'font-semibold text-ink' : 'text-ink-subtle'}>{formatDue(form.dueDate)}</dd>
        <dt className="text-ink-subtle">Category</dt>
        <dd className="font-semibold text-ink">
          {category ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: category.colorHex }} aria-hidden="true" />{category.name}
            </span>
          ) : <span className="font-normal text-ink-subtle">None</span>}
        </dd>
      </dl>
      <div>
        <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-subtle">Journey</h3>
        <Journey workflowChosen={workflowTitle !== undefined} assignee={assignee?.name} steps={steps} />
      </div>
      {assignee && <p className="caption">{assignee.name} gets a notification as soon as you assign.</p>}
    </aside>
  );
};
