import React, { useId, useRef } from 'react';
import { CheckCircle, Lock, X, XCircle } from 'lucide-react';
import type { TaskItem, TaskStepHistory } from '../../models';
import { useDialogA11y } from '../../hooks/useDialogA11y';
import TaskDetails from './TaskDetails';
import { actionVerb } from './taskUtils';

interface Props {
  task: TaskItem;
  history?: TaskStepHistory[];
  historyLoading: boolean;
  /** Show Approve/Reject. False in My Activity, which is read-only. */
  canAct: boolean;
  disabled: boolean;
  onApprove: (task: TaskItem) => void;
  onReject: (task: TaskItem) => void;
  onClose: () => void;
  /** All Tasks only: who holds the task ("Currently with" row). */
  currentlyWith?: React.ReactNode;
  /** All Tasks only: footer explaining that decisions are made elsewhere. */
  readOnlyNote?: string;
}

/** Slide-in panel with the full labelled task and the decision buttons pinned at the bottom. */
const ReviewPanel: React.FC<Props> = ({ task, history, historyLoading, canAct, disabled, onApprove, onReject, onClose, currentlyWith, readOnlyNote }) => {
  const ref = useRef<HTMLElement>(null);
  const titleId = useId();
  // Escape belongs to the confirmation dialog while one is open on top of the panel.
  useDialogA11y(ref, onClose, disabled);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-overlay" onMouseDown={onClose} aria-hidden="true" />
      <aside
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[520px] flex-col border-l border-hairline bg-canvas shadow-2xl"
      >
        <div className="flex items-center justify-between gap-2 border-b border-hairline px-4 py-2.5">
          <span className="caption">Task #{task.taskId}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} data-autofocus>
            <X size={16} aria-hidden="true" /> Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <TaskDetails task={task} history={history} historyLoading={historyLoading} waitingForYou={canAct} titleId={titleId} currentlyWith={currentlyWith} />
        </div>

        {canAct && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-hairline bg-canvas px-4 py-3">
            <button type="button" className="btn btn-secondary text-error" onClick={() => onReject(task)} disabled={disabled}>
              <XCircle size={16} aria-hidden="true" /> Reject
            </button>
            <button type="button" className="btn btn-primary" onClick={() => onApprove(task)} disabled={disabled}>
              <CheckCircle size={16} aria-hidden="true" /> {actionVerb(task)}
            </button>
          </div>
        )}

        {!canAct && readOnlyNote && (
          <p className="flex items-center gap-2 border-t border-hairline bg-canvas px-4 py-3 text-xs text-ink-subtle">
            <Lock size={14} className="shrink-0" aria-hidden="true" />
            <span><strong className="font-semibold text-ink-muted">Read-only here.</strong> {readOnlyNote}</span>
          </p>
        )}
      </aside>
    </>
  );
};

export default ReviewPanel;
