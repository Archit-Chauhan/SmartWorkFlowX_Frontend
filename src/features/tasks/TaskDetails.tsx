import React from 'react';
import { AlertTriangle, CalendarClock, CheckCircle, Clock, RotateCcw, XCircle } from 'lucide-react';
import type { TaskItem, TaskPriority, TaskStepHistory } from '../../models';
import { dueInfo, stepLabel, stepSegments } from './taskUtils';
import type { DueTone } from './taskUtils';

const PRIORITY_LEVEL: Record<TaskPriority, number> = { High: 3, Medium: 2, Low: 1 };
const PRIORITY_COLOR: Record<TaskPriority, string> = { High: 'bg-error', Medium: 'bg-warning', Low: 'bg-ink-subtle' };
const BAR_HEIGHT = ['h-1.5', 'h-2.5', 'h-3.5'];

/** Three-bar signal: more filled bars means more urgent. Replaces the flag icon plus priority chip. */
export const PrioritySignal: React.FC<{ priority: TaskPriority }> = ({ priority }) => (
  <span role="img" aria-label={`${priority} priority`} title={`${priority} priority`} className="inline-flex h-3.5 shrink-0 items-end gap-0.5">
    {BAR_HEIGHT.map((h, i) => (
      <i key={h} className={`w-1 rounded-[1px] ${h} ${i < PRIORITY_LEVEL[priority] ? PRIORITY_COLOR[priority] : 'bg-surface-2'}`} />
    ))}
  </span>
);

const TONE_CLASS: Record<DueTone, string> = {
  overdue: 'text-error',
  soon: 'text-ink',
  normal: 'text-ink-muted',
  none: 'text-ink-subtle',
};

/** Due label with an icon, so urgency is never carried by colour alone. */
export const DueLabel: React.FC<{ task: TaskItem; showDate?: boolean }> = ({ task, showDate = true }) => {
  const info = dueInfo(task);
  const Icon = info.tone === 'overdue' ? AlertTriangle : info.tone === 'soon' ? Clock : CalendarClock;
  return (
    <span className={`inline-flex items-center gap-1.5 font-semibold tabular-nums ${TONE_CLASS[info.tone]}`}>
      <Icon size={14} className={info.tone === 'soon' ? 'text-warning' : ''} aria-hidden="true" />
      {info.label}
      {showDate && info.dateText && <span className="caption font-normal">{info.dateText}</span>}
    </span>
  );
};

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink-subtle">{children}</h3>
);

const SEGMENT_CLASS = { done: 'bg-success', current: 'bg-accent', todo: 'bg-surface-2' } as const;

export const HistoryTimeline: React.FC<{ history?: TaskStepHistory[]; loading: boolean; waitingForYou: boolean; stepText: string }> = ({
  history, loading, waitingForYou, stepText,
}) => (
  <div>
    {loading && !history ? (
      <p className="caption mt-2">Loading history...</p>
    ) : (
      <ol className="mt-2">
        {(history ?? []).map((h, i) => {
          const rejected = h.action === 'Rejected';
          const Icon = rejected ? XCircle : CheckCircle;
          return (
            <li key={i} className="relative grid grid-cols-[22px_1fr] gap-2.5 pb-3.5 last:pb-0">
              {(i < (history?.length ?? 0) - 1 || waitingForYou) && <span aria-hidden="true" className="absolute left-[10px] top-[22px] bottom-0 w-0.5 bg-hairline" />}
              <span className={`flex h-[22px] w-[22px] items-center justify-center rounded-full bg-surface-1 ${rejected ? 'text-error' : 'text-success'}`}>
                <Icon size={14} aria-hidden="true" />
              </span>
              <div className="min-w-0 text-sm">
                <p><span className="font-semibold text-ink">{h.action}</span> at step {h.stepOrder} by {h.actedByName}</p>
                <p className="caption">{new Date(h.actedAt).toLocaleString()}</p>
                {h.comment && <p className="text-ink-muted break-words">“{h.comment}”</p>}
              </div>
            </li>
          );
        })}
        {waitingForYou && (
          <li className="grid grid-cols-[22px_1fr] gap-2.5">
            <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-accent-soft text-accent">
              <Clock size={14} aria-hidden="true" />
            </span>
            <div className="text-sm">
              <p className="font-semibold text-ink">Waiting for you</p>
              <p className="caption">{stepText}</p>
            </div>
          </li>
        )}
        {!waitingForYou && (history ?? []).length === 0 && <li className="caption">No actions taken yet.</li>}
      </ol>
    )}
  </div>
);

interface Props {
  task: TaskItem;
  history?: TaskStepHistory[];
  historyLoading: boolean;
  /** True when the person can still act on this task (Action Center). */
  waitingForYou: boolean;
  titleId?: string;
  titleSize?: 'panel' | 'focus';
}

/**
 * The labelled view of one task, shared by the review panel and review mode:
 * TASK (title + progress), DESCRIPTION, SENT BACK, DETAILS, HISTORY.
 */
const TaskDetails: React.FC<Props> = ({ task, history, historyLoading, waitingForYou, titleId, titleSize = 'panel' }) => {
  const segments = stepSegments(task);
  const stepText = stepLabel(task);

  return (
    <div className="space-y-6">
      <section aria-label="Task">
        <SectionLabel>Task</SectionLabel>
        <h2 id={titleId} className={`mt-1 font-bold text-ink text-balance break-words ${titleSize === 'focus' ? 'text-2xl' : 'text-xl'}`}>
          {task.title}
        </h2>
        {segments.length > 0 && (
          <div className="mt-2 flex gap-1" role="img" aria-label={stepText}>
            {segments.map((s, i) => <i key={i} className={`h-1.5 flex-1 rounded-sm ${SEGMENT_CLASS[s]}`} />)}
          </div>
        )}
        <p className="caption mt-1.5">{task.workflowTitle || 'Workflow'} · {stepText}</p>
      </section>

      <section aria-label="Description">
        <SectionLabel>Description</SectionLabel>
        {task.description ? (
          <p className={`mt-1 whitespace-pre-line break-words text-ink max-w-prose ${titleSize === 'focus' ? 'text-base' : 'text-[15px]'} leading-relaxed`}>{task.description}</p>
        ) : (
          <p className="mt-1 text-sm italic text-ink-subtle">No description was added to this task.</p>
        )}
      </section>

      {task.rejectedReason && (
        <section aria-label="Sent back" className="flex gap-2.5 rounded-card chip-rejected px-3.5 py-3">
          <RotateCcw size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wider">Sent back</h3>
            <p className="text-sm text-ink break-words">{task.rejectedReason}</p>
          </div>
        </section>
      )}

      <section aria-label="Details">
        <SectionLabel>Details</SectionLabel>
        <dl className="mt-2 grid grid-cols-[96px_1fr] gap-x-3 gap-y-2.5 text-sm">
          <dt className="text-ink-subtle">Due</dt>
          <dd><DueLabel task={task} /></dd>
          <dt className="text-ink-subtle">Priority</dt>
          <dd className="flex items-center gap-2 font-semibold text-ink"><PrioritySignal priority={task.priority} />{task.priority}</dd>
          <dt className="text-ink-subtle">Category</dt>
          <dd className="font-semibold text-ink">
            {task.categoryName ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: task.categoryColor || 'var(--accent)' }} aria-hidden="true" />
                {task.categoryName}
              </span>
            ) : <span className="font-normal text-ink-subtle">None</span>}
          </dd>
          <dt className="text-ink-subtle">Status</dt>
          <dd className="font-semibold text-ink">{task.status}</dd>
        </dl>
      </section>

      <section aria-label="History">
        <SectionLabel>History</SectionLabel>
        <HistoryTimeline history={history} loading={historyLoading} waitingForYou={waitingForYou} stepText={stepText} />
      </section>
    </div>
  );
};

export default TaskDetails;
