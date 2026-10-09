import React, { useId, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle, Loader2, XCircle } from 'lucide-react';
import type { TaskItem } from '../../models';
import { useDialogA11y } from '../../hooks/useDialogA11y';
import { actionVerb, nextStepText, REJECT_REASONS, stepLabel } from './taskUtils';

interface ShellProps {
  tone: 'accent' | 'danger';
  title: string;
  description: string;
  busy: boolean;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
}

/** Centered confirmation dialog: scrim, focus trap, Escape to cancel. */
const DialogShell: React.FC<ShellProps> = ({ tone, title, description, busy, onClose, children, footer }) => {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  useDialogA11y(ref, onClose, busy);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-overlay p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
    >
      <div
        ref={ref}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="bg-canvas border border-hairline rounded-card shadow-2xl w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto"
      >
        <div className="flex items-start gap-3 px-5 pt-5">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tone === 'danger' ? 'chip-rejected' : 'bg-accent-soft text-accent'}`}>
            {tone === 'danger' ? <AlertTriangle size={20} /> : <CheckCircle size={20} />}
          </span>
          <div>
            <h2 id={titleId} className="section-title">{title}</h2>
            <p id={descId} className="text-sm text-ink-muted mt-0.5">{description}</p>
          </div>
        </div>
        <div className="px-5 py-4 space-y-4">{children}</div>
        <div className="flex flex-wrap justify-end gap-2 px-5 pb-5">{footer}</div>
      </div>
    </div>
  );
};

const TaskReference: React.FC<{ task: TaskItem }> = ({ task }) => (
  <div className="rounded-control border border-hairline bg-surface-1 px-3 py-2">
    <p className="text-[11px] font-bold uppercase tracking-wider text-ink-subtle">Task</p>
    <p className="font-semibold text-ink break-words">{task.title}</p>
    <p className="caption">{task.workflowTitle || 'Workflow'} · {stepLabel(task)}</p>
  </div>
);

interface ApproveProps {
  task: TaskItem;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ApproveDialog: React.FC<ApproveProps> = ({ task, busy, onConfirm, onCancel }) => {
  const verb = actionVerb(task);
  return (
    <DialogShell
      tone="accent"
      title={`${verb} this task?`}
      description={task.currentStepOrder === 0 ? 'You are confirming that your part is finished.' : 'You are confirming that this request can go ahead.'}
      busy={busy}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={onConfirm} disabled={busy} data-autofocus>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
            {busy ? 'Saving...' : `Yes, ${verb.toLowerCase()}`}
          </button>
        </>
      }
    >
      <TaskReference task={task} />
      <ul className="list-disc pl-5 text-sm text-ink-muted space-y-1">
        <li>{nextStepText(task)}</li>
        <li>It is saved in the approval history with your name and the time.</li>
        <li>You cannot undo this yourself.</li>
      </ul>
    </DialogShell>
  );
};

interface RejectProps {
  task: TaskItem;
  busy: boolean;
  onConfirm: (reason: string, comment: string) => void;
  onCancel: () => void;
}

export const RejectDialog: React.FC<RejectProps> = ({ task, busy, onConfirm, onCancel }) => {
  const [reason, setReason] = useState('');
  const [comment, setComment] = useState('');
  const [showError, setShowError] = useState(false);
  const reasonRef = useRef<HTMLInputElement>(null);
  const reasonId = useId();
  const errorId = useId();
  const commentId = useId();

  const submit = () => {
    if (!reason.trim()) {
      setShowError(true);
      reasonRef.current?.focus();
      return;
    }
    onConfirm(reason.trim(), comment.trim());
  };

  return (
    <DialogShell
      tone="danger"
      title="Reject this task?"
      description="The task goes back to the previous step and the person who sent it will see your reason."
      busy={busy}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn-danger" onClick={submit} disabled={busy}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
            {busy ? 'Rejecting...' : 'Reject task'}
          </button>
        </>
      }
    >
      <TaskReference task={task} />
      <div>
        <label htmlFor={reasonId} className="label">Reason <span className="text-error">*</span></label>
        <input
          id={reasonId}
          ref={reasonRef}
          data-autofocus
          className="input"
          autoComplete="off"
          placeholder="e.g. Missing documentation"
          value={reason}
          aria-invalid={showError && !reason.trim()}
          aria-describedby={showError && !reason.trim() ? errorId : undefined}
          onChange={(e) => { setReason(e.target.value); setShowError(false); }}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
        />
        {showError && !reason.trim() && (
          <p id={errorId} role="alert" className="mt-1 text-xs text-error">Please give a reason so the requester knows what to fix.</p>
        )}
        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Quick reasons">
          {REJECT_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              className="chip chip-neutral cursor-pointer hover:text-ink"
              onClick={() => { setReason(r); setShowError(false); reasonRef.current?.focus(); }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label htmlFor={commentId} className="label">Additional comment <span className="text-ink-subtle">(optional)</span></label>
        <textarea
          id={commentId}
          className="input resize-none"
          rows={3}
          placeholder="Any notes for the requester"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </div>
    </DialogShell>
  );
};
