import React, { useEffect, useRef } from 'react';
import { CheckCircle, ChevronLeft, ChevronRight, X, XCircle } from 'lucide-react';
import type { TaskItem, TaskStepHistory } from '../../models';
import TaskDetails from './TaskDetails';
import { actionVerb } from './taskUtils';

interface Props {
  task: TaskItem;
  /** 1-based position across all of the person's pending tasks. */
  position: number;
  total: number;
  history?: TaskStepHistory[];
  historyLoading: boolean;
  disabled: boolean;
  onPrev: () => void;
  onNext: () => void;
  onApprove: (task: TaskItem) => void;
  onReject: (task: TaskItem) => void;
  onExit: () => void;
}

const Kbd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd className="rounded border border-b-2 border-hairline bg-surface-1 px-1.5 font-mono text-[11px] font-semibold text-ink-muted">{children}</kbd>
);

/** One task at a time. The list is sorted most urgent first by the server. */
const ReviewMode: React.FC<Props> = ({
  task, position, total, history, historyLoading, disabled, onPrev, onNext, onApprove, onReject, onExit,
}) => {
  const headingRef = useRef<HTMLDivElement>(null);

  // Move focus to the new task so keyboard and screen-reader users land on it after every step.
  useEffect(() => { headingRef.current?.focus(); }, [task.taskId]);

  const verb = actionVerb(task);

  return (
    <section className="card" aria-label="Review mode">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-4 py-2.5">
        <p className="caption" aria-live="polite">
          Reviewing <b className="text-ink">{position}</b> of <b className="text-ink">{total}</b> · most urgent first
        </p>
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-secondary btn-sm px-2" onClick={onPrev} disabled={disabled || position <= 1} aria-label="Previous task">
            <ChevronLeft size={16} />
          </button>
          <button type="button" className="btn btn-secondary btn-sm px-2" onClick={onNext} disabled={disabled || position >= total} aria-label="Next task">
            <ChevronRight size={16} />
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onExit}>
            <X size={16} aria-hidden="true" /> Exit review
          </button>
        </div>
      </div>

      <div ref={headingRef} tabIndex={-1} className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-10 sm:py-8 outline-none">
        <TaskDetails task={task} history={history} historyLoading={historyLoading} waitingForYou titleSize="focus" />
      </div>

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-hairline bg-canvas px-4 py-3">
        <p className="caption hidden md:block">
          <Kbd>J</Kbd> <Kbd>K</Kbd> browse · <Kbd>A</Kbd> {verb.toLowerCase()} · <Kbd>R</Kbd> reject · <Kbd>Esc</Kbd> exit
        </p>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" className="btn btn-secondary text-error" onClick={() => onReject(task)} disabled={disabled}>
            <XCircle size={16} aria-hidden="true" /> Reject
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onApprove(task)} disabled={disabled}>
            <CheckCircle size={16} aria-hidden="true" /> {verb}
          </button>
        </div>
      </div>
    </section>
  );
};

export default ReviewMode;
