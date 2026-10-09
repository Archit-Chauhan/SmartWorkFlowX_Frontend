import React from 'react';
import { Check } from 'lucide-react';
import type { OnRejectAction } from '../../models';

export interface JourneyStep {
  name: string;
  roleName: string;
  instructions?: string;
  onReject: OnRejectAction;
  escalationHours?: number | null;
}

/** One-line overview: Start → step (role) → step (role) → Done. */
export const StepChain: React.FC<{ steps: { name: string; roleName: string }[] }> = ({ steps }) => (
  <ol className="flex flex-wrap items-center gap-1 text-xs" aria-label="Approval journey">
    <li className="text-ink-subtle">Start</li>
    {steps.map((s, i) => (
      <li key={i} className="inline-flex items-center gap-1">
        <span aria-hidden="true" className="text-ink-subtle">→</span>
        <span className="rounded-card border border-hairline bg-surface-1 px-2 py-0.5 text-ink">
          {s.name || 'Untitled step'}
          <i className="ml-1 not-italic text-ink-subtle">{s.roleName}</i>
        </span>
      </li>
    ))}
    <li className="inline-flex items-center gap-1 text-ink-subtle"><span aria-hidden="true">→</span> Done</li>
  </ol>
);

/** The full journey, step by step. `detailed` adds the approver instructions (list details), the preview omits them. */
export const Journey: React.FC<{ steps: JourneyStep[]; detailed?: boolean }> = ({ steps, detailed = false }) => (
  <ol className="mt-2 list-none p-0 m-0">
    <JourneyItem marker="0" tone="muted" last={false}>
      <b className="block text-ink">The assignee does the work</b>
      <span className="text-sm text-ink-muted">Chosen in Assign Task. Marks it complete when finished.</span>
    </JourneyItem>
    {steps.map((s, i) => (
      <JourneyItem key={i} marker={String(i + 1)} tone="accent" last={false}>
        <b className="block text-ink break-words">{s.name || 'Untitled step'}</b>
        <span className="text-sm text-ink-muted">Any {s.roleName} can approve · first to act wins</span>
        {detailed && s.instructions && <span className="block text-sm italic text-ink-muted break-words">“{s.instructions}”</span>}
        <span className="mt-1 flex flex-wrap gap-1.5">
          <span className={`chip ${s.onReject === 'GoBack' ? 'chip-warning' : 'chip-neutral'}`}>
            {s.onReject === 'GoBack' ? 'If rejected: sent back one step' : 'If rejected: task cancelled'}
          </span>
          {!!s.escalationHours && <span className="chip chip-progress">Escalates after {s.escalationHours}h</span>}
        </span>
      </JourneyItem>
    ))}
    <JourneyItem marker={<Check size={14} aria-hidden="true" />} tone="ok" last>
      <b className="block text-ink">Task completed</b>
    </JourneyItem>
  </ol>
);

const MARKER_TONE = {
  muted: 'bg-surface-2 text-ink-muted',
  accent: 'bg-accent-soft text-accent',
  ok: 'chip-completed',
} as const;

const JourneyItem: React.FC<{ marker: React.ReactNode; tone: keyof typeof MARKER_TONE; last: boolean; children: React.ReactNode }> = ({ marker, tone, last, children }) => (
  <li className={`relative grid grid-cols-[28px_1fr] gap-2.5 ${last ? '' : 'pb-3'}`}>
    {!last && <span aria-hidden="true" className="absolute left-[13px] top-7 bottom-0 w-0.5 bg-hairline-strong" />}
    <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${MARKER_TONE[tone]}`}>{marker}</span>
    <span className="min-w-0 block">{children}</span>
  </li>
);
