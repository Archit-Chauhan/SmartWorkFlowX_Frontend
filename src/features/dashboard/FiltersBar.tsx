import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { DashboardOptions } from '../../models/Dashboard';
import {
  PRIORITY_OPTIONS, STATUS_OPTIONS, hasActiveFilters, validateCustomRange,
  type DashboardUrlState, type RangeKind,
} from './utils';

const PRESET_LABELS: { value: RangeKind; label: string }[] = [
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
  { value: 'month', label: 'This month' },
  { value: 'custom', label: 'Custom' },
];

interface FiltersBarProps {
  state: DashboardUrlState;
  /** Resolved dates for the current range, used to seed the custom inputs. */
  resolved: { from: string; to: string };
  options: DashboardOptions | null;
  hideAssignee: boolean;
  onChange: (next: DashboardUrlState) => void;
}

const CustomRange: React.FC<{ from: string; to: string; onApply: (from: string, to: string) => void }> = ({ from, to, onApply }) => {
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const error = validateCustomRange(draftFrom, draftTo);
  const dirty = draftFrom !== from || draftTo !== to;
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <label className="label" htmlFor="dash-from">From</label>
        <input id="dash-from" type="date" className="input w-auto" value={draftFrom} max={draftTo || undefined}
          onChange={e => setDraftFrom(e.target.value)} aria-invalid={error ? true : undefined} />
      </div>
      <div>
        <label className="label" htmlFor="dash-to">To</label>
        <input id="dash-to" type="date" className="input w-auto" value={draftTo} min={draftFrom || undefined}
          onChange={e => setDraftTo(e.target.value)} aria-invalid={error ? true : undefined} />
      </div>
      <button type="button" className="btn btn-secondary" disabled={Boolean(error) || !dirty} onClick={() => onApply(draftFrom, draftTo)}>
        Apply
      </button>
      {error && <p className="field-error w-full" role="alert">{error}</p>}
    </div>
  );
};

interface SelectProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}

const FilterSelect: React.FC<SelectProps> = ({ label, value, onChange, children }) => (
  <div>
    <label className="label" htmlFor={`dash-${label}`}>{label}</label>
    <select id={`dash-${label}`} className="input w-full" value={value} onChange={e => onChange(e.target.value)}>
      <option value="">All</option>
      {children}
    </select>
  </div>
);

const FiltersBar: React.FC<FiltersBarProps> = ({ state, resolved, options, hideAssignee, onChange }) => {
  const set = (patch: Partial<DashboardUrlState>) => onChange({ ...state, ...patch });
  const num = (v: string): number | undefined => (v ? Number(v) : undefined);

  const chips: { key: string; label: string; clear: Partial<DashboardUrlState> }[] = [];
  if (state.status) chips.push({ key: 'status', label: `Status: ${state.status}`, clear: { status: undefined } });
  if (state.priority) chips.push({ key: 'priority', label: `Priority: ${state.priority}`, clear: { priority: undefined } });
  if (state.categoryId) {
    const name = options?.categories.find(c => c.id === state.categoryId)?.name ?? state.categoryId;
    chips.push({ key: 'category', label: `Category: ${name}`, clear: { categoryId: undefined } });
  }
  if (state.workflowId) {
    const title = options?.workflows.find(w => w.id === state.workflowId)?.title ?? state.workflowId;
    chips.push({ key: 'workflow', label: `Workflow: ${title}`, clear: { workflowId: undefined } });
  }
  if (state.assigneeId && !hideAssignee) {
    const name = options?.assignees.find(a => a.id === state.assigneeId)?.name ?? state.assigneeId;
    chips.push({ key: 'assignee', label: `Assignee: ${name}`, clear: { assigneeId: undefined } });
  }

  const selectPreset = (range: RangeKind) => {
    if (range === 'custom') onChange({ ...state, range: 'custom', from: resolved.from, to: resolved.to });
    else onChange({ ...state, range, from: undefined, to: undefined });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <span className="label" id="dash-range-label">Date range</span>
          <div className="inline-flex rounded-control border border-hairline-strong overflow-hidden" role="group" aria-labelledby="dash-range-label">
            {PRESET_LABELS.map((p, i) => {
              const active = state.range === p.value;
              return (
                <button key={p.value} type="button" aria-pressed={active} onClick={() => selectPreset(p.value)}
                  className={`h-control px-3 text-sm font-medium transition-colors duration-150 ${i > 0 ? 'border-l border-hairline-strong' : ''} ${
                    active ? 'bg-accent text-on-accent' : 'bg-canvas text-ink-muted hover:bg-surface-1'}`}>
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
        {state.range === 'custom' && (
          <CustomRange key={`${resolved.from}_${resolved.to}`} from={resolved.from} to={resolved.to}
            onApply={(from, to) => onChange({ ...state, range: 'custom', from, to })} />
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <FilterSelect label="Status" value={state.status ?? ''} onChange={v => set({ status: v || undefined })}>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </FilterSelect>
        <FilterSelect label="Priority" value={state.priority ?? ''} onChange={v => set({ priority: v || undefined })}>
          {PRIORITY_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </FilterSelect>
        <FilterSelect label="Category" value={String(state.categoryId ?? '')} onChange={v => set({ categoryId: num(v) })}>
          {options?.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </FilterSelect>
        <FilterSelect label="Workflow" value={String(state.workflowId ?? '')} onChange={v => set({ workflowId: num(v) })}>
          {options?.workflows.map(w => <option key={w.id} value={w.id}>{w.title}</option>)}
        </FilterSelect>
        {!hideAssignee && (
          <FilterSelect label="Assignee" value={String(state.assigneeId ?? '')} onChange={v => set({ assigneeId: num(v) })}>
            {options?.assignees.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </FilterSelect>
        )}
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" aria-label="Active filters" role="group">
          {chips.map(c => (
            <span key={c.key} className="chip chip-neutral gap-1 pl-2.5 pr-1">
              {c.label}
              <button type="button" onClick={() => set(c.clear)} aria-label={`Remove filter ${c.label}`}
                className="inline-flex items-center justify-center w-6 h-6 rounded-pill hover:bg-hairline-strong">
                <X size={12} aria-hidden="true" />
              </button>
            </span>
          ))}
          {hasActiveFilters(state) && (
            <button type="button" className="btn btn-ghost btn-sm"
              onClick={() => onChange({ range: state.range, from: state.from, to: state.to })}>
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default FiltersBar;
