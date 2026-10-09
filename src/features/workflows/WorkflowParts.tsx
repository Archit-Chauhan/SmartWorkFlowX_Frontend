import React, { useEffect, useRef } from 'react';
import { AlertCircle, Loader2, X } from 'lucide-react';
import { DialogShell } from '../tasks/TaskDialogs';

/** Error banner that takes focus when it appears, so screen reader and keyboard users land on it. */
export const Banner: React.FC<{ message: string; onDismiss?: () => void }> = ({ message, onDismiss }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.scrollIntoView?.({ block: 'nearest' });
  }, [message]);
  return (
    <div ref={ref} role="alert" tabIndex={-1} className="alert alert-error flex items-start gap-2 focus-visible:outline-2">
      <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 break-words text-ink">{message}</span>
      {onDismiss && (
        <button type="button" className="shrink-0 rounded-control p-0.5 text-ink-muted hover:text-ink" aria-label="Dismiss message" onClick={onDismiss}>
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
};

interface ConfirmProps {
  tone: 'accent' | 'danger';
  icon: React.ReactNode;
  title: string;
  /** Usually the workflow title. */
  subject: string;
  bullets: React.ReactNode[];
  confirmLabel: string;
  busyLabel: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Confirmation for every workflow change: focus trap, Escape, spinner, buttons locked while saving. */
export const ConfirmDialog: React.FC<ConfirmProps> = ({ tone, icon, title, subject, bullets, confirmLabel, busyLabel, busy, onConfirm, onCancel }) => (
  <DialogShell
    tone={tone}
    icon={icon}
    title={title}
    description={subject}
    busy={busy}
    onClose={onCancel}
    footer={
      <>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>Cancel</button>
        <button type="button" className={`btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} disabled={busy} data-autofocus>
          {busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
          {busy ? busyLabel : confirmLabel}
        </button>
      </>
    }
  >
    <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
      {bullets.map((b, i) => <li key={i}>{b}</li>)}
    </ul>
  </DialogShell>
);
