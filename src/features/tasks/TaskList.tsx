import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { Activity, CheckCircle, Clock, PlayCircle } from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';
import type { TaskItem, TaskStepHistory, TaskRejectRequest, PaginatedResponse } from '../../models';
import Pagination from '../../components/Pagination';
import EmptyState from '../../components/EmptyState';
import TaskRow from './TaskRow';
import ReviewPanel from './ReviewPanel';
import ReviewMode from './ReviewMode';
import { ApproveDialog, RejectDialog } from './TaskDialogs';
import { DUE_GROUP_LABEL, actionVerb, groupByUrgency } from './taskUtils';

type Tab = 'action' | 'activity';
type DialogState = { kind: 'approve' | 'reject'; task: TaskItem } | null;

const LIMIT = 10;

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

const errorMessage = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

const TaskList: React.FC = () => {
  const [tab, setTab] = useState<Tab>('action');
  const [actionPage, setActionPage] = useState(1);
  const [activityPage, setActivityPage] = useState(1);

  const [reviewMode, setReviewMode] = useState(false);
  const [cursor, setCursor] = useState(0); // 0-based position across all pending tasks, used in review mode

  const [items, setItems] = useState<TaskItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loadedPage, setLoadedPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [history, setHistory] = useState<Record<number, TaskStepHistory[]>>({});
  const [dialog, setDialog] = useState<DialogState>(null);
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);

  // The page being shown: in review mode it follows the cursor so the queue crosses page boundaries.
  const page = tab === 'action'
    ? (reviewMode ? Math.floor(cursor / LIMIT) + 1 : actionPage)
    : activityPage;
  const endpoint = tab === 'action' ? '/Task/my-tasks' : '/Task/my-activity';

  useEffect(() => {
    const id = ++requestId.current;
    setLoading(true);
    setLoadFailed(false);
    axiosInstance
      .get<PaginatedResponse<TaskItem>>(`${endpoint}?page=${page}&limit=${LIMIT}`)
      .then((res) => {
        if (id !== requestId.current) return; // a newer request replaced this one
        setItems(res.data.data);
        setTotal(res.data.total);
        setLoadedPage(page);
      })
      .catch(() => { if (id === requestId.current) setLoadFailed(true); })
      .finally(() => { if (id === requestId.current) setLoading(false); });
  }, [endpoint, page, refreshKey]);

  const pageReady = !loading && loadedPage === page;
  const selected = useMemo(() => items.find((t) => t.taskId === selectedId) ?? null, [items, selectedId]);
  const current = reviewMode && pageReady ? items[cursor % LIMIT] ?? null : null;
  const shown = reviewMode ? current : selected;

  // Close the panel if its task is no longer in the list (somebody else handled it).
  useEffect(() => {
    if (selectedId !== null && pageReady && !selected) setSelectedId(null);
  }, [selectedId, selected, pageReady]);

  // Load the approval history of whichever task is on screen.
  useEffect(() => {
    if (!shown || history[shown.taskId]) return;
    const id = shown.taskId;
    axiosInstance
      .get<TaskStepHistory[]>(`/Task/${id}/history`)
      .then((res) => setHistory((prev) => ({ ...prev, [id]: res.data })))
      .catch(() => setHistory((prev) => ({ ...prev, [id]: [] })));
  }, [shown, history]);

  const switchTab = (next: Tab) => {
    setTab(next);
    setSelectedId(null);
    setReviewMode(false);
  };

  const startReview = () => {
    setSelectedId(null);
    setCursor(0);
    setReviewMode(true);
  };

  /** Runs after Approve/Reject succeeded: leave the task behind and show the next one. */
  const afterAction = useCallback((task: TaskItem) => {
    const remaining = total - 1;
    setDialog(null);
    setSelectedId(null);
    setHistory((prev) => { const next = { ...prev }; delete next[task.taskId]; return next; });
    if (reviewMode) {
      if (remaining <= 0) setReviewMode(false);
      else setCursor((c) => Math.min(c, remaining - 1));
    } else if (actionPage > 1 && items.length === 1) {
      setActionPage((p) => p - 1);
    }
    setRefreshKey((k) => k + 1);
    requestAnimationFrame(() => listRef.current?.focus());
  }, [total, reviewMode, actionPage, items.length]);

  const confirmApprove = async (task: TaskItem) => {
    setBusy(true);
    try {
      await axiosInstance.post(`/Task/${task.taskId}/approve`, null);
      toast.success(`"${task.title}" ${task.currentStepOrder === 0 ? 'completed' : 'approved'}.`);
      afterAction(task);
    } catch (err) {
      toast.error(errorMessage(err, `Could not ${actionVerb(task).toLowerCase()} this task. Please try again.`));
    } finally {
      setBusy(false);
    }
  };

  const confirmReject = async (task: TaskItem, reason: string, comment: string) => {
    setBusy(true);
    try {
      const body: TaskRejectRequest = { reason, comment };
      await axiosInstance.post(`/Task/${task.taskId}/reject`, body);
      toast.success(`"${task.title}" rejected and sent back.`);
      afterAction(task);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not reject this task. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  // Keyboard shortcuts for review mode. Nothing fires while typing or while a dialog is open.
  useEffect(() => {
    if (!reviewMode || dialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      const key = e.key.toLowerCase();
      if (key === 'escape') setReviewMode(false);
      else if (key === 'j') setCursor((c) => Math.min(c + 1, total - 1));
      else if (key === 'k') setCursor((c) => Math.max(c - 1, 0));
      else if (key === 'a' && current) setDialog({ kind: 'approve', task: current });
      else if (key === 'r' && current) { e.preventDefault(); setDialog({ kind: 'reject', task: current }); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [reviewMode, dialog, total, current]);

  const totalPages = Math.ceil(total / LIMIT);
  const groups = useMemo(() => (tab === 'action' ? groupByUrgency(items) : []), [tab, items]);

  const tabButton = (value: Tab, label: string, icon: React.ReactNode, badge?: number) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === value}
      onClick={() => switchTab(value)}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-control text-sm font-medium transition-colors ${
        tab === value ? 'bg-accent-soft text-accent' : 'text-ink-muted hover:text-ink'
      }`}
    >
      {icon}
      {label}
      {!!badge && badge > 0 && (
        <span className={`chip ml-1 ${tab === value ? 'bg-accent text-on-accent' : 'chip-neutral'}`}>{badge}</span>
      )}
    </button>
  );

  const renderBody = () => {
    if (loadFailed) {
      return (
        <div className="empty-state flex flex-col items-center gap-3 py-10" role="alert">
          <p>We couldn't load your tasks.</p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRefreshKey((k) => k + 1)}>Try again</button>
        </div>
      );
    }
    if (loading && !(reviewMode && current)) {
      return <div className="empty-state flex justify-center items-center h-48"><Clock size={20} className="animate-spin mr-2" /> Loading tasks...</div>;
    }
    if (total === 0 || items.length === 0) {
      return tab === 'action'
        ? <EmptyState illustration="task-list" title="All clear! No tasks assigned to you." hint="New work shows up here as soon as it is assigned." />
        : <EmptyState illustration="empty" title="No activity yet." hint="Tasks you complete or approve will appear here." />;
    }
    if (reviewMode && current) {
      return (
        <ReviewMode
          task={current}
          position={cursor + 1}
          total={total}
          history={history[current.taskId]}
          historyLoading={!history[current.taskId]}
          disabled={busy || loading}
          onPrev={() => setCursor((c) => Math.max(c - 1, 0))}
          onNext={() => setCursor((c) => Math.min(c + 1, total - 1))}
          onApprove={(t) => setDialog({ kind: 'approve', task: t })}
          onReject={(t) => setDialog({ kind: 'reject', task: t })}
          onExit={() => setReviewMode(false)}
        />
      );
    }
    return (
      <div className="space-y-5">
        {tab === 'action' ? (
          groups.map((g) => (
            <section key={g.group} aria-labelledby={`grp-${g.group}`}>
              <h2 id={`grp-${g.group}`} className={`px-1 pb-1.5 text-[11px] font-bold uppercase tracking-wider ${g.group === 'overdue' ? 'text-error' : 'text-ink-subtle'}`}>
                {DUE_GROUP_LABEL[g.group]}
              </h2>
              <div className="card overflow-hidden">
                {g.tasks.map((t) => (
                  <TaskRow key={t.taskId} task={t} trailing="due" selected={t.taskId === selectedId} onOpen={(x) => setSelectedId(x.taskId)} />
                ))}
              </div>
            </section>
          ))
        ) : (
          <div className="card overflow-hidden">
            {items.map((t) => (
              <TaskRow key={t.taskId} task={t} trailing="status" selected={t.taskId === selectedId} onOpen={(x) => setSelectedId(x.taskId)} />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={total}
            pageSize={LIMIT}
            onPageChange={(p) => (tab === 'action' ? setActionPage(p) : setActivityPage(p))}
          />
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="sr-only">My Tasks</h1>
          <p className="caption">
            {tab === 'action'
              ? `${total} task${total !== 1 ? 's' : ''} assigned to you`
              : `${total} task${total !== 1 ? 's' : ''} you've acted on`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {tab === 'action' && !reviewMode && total > 0 && (
            <button type="button" className="btn btn-primary btn-sm" onClick={startReview}>
              <PlayCircle size={16} aria-hidden="true" /> Start review
            </button>
          )}
          <div role="tablist" aria-label="My tasks" className="flex bg-surface-1 border border-hairline rounded-control p-1 self-start">
            {tabButton('action', 'Action Center', <CheckCircle size={15} />, tab === 'action' ? total : undefined)}
            {tabButton('activity', 'My Activity', <Activity size={15} />)}
          </div>
        </div>
      </div>

      <div ref={listRef} tabIndex={-1} className="outline-none">
        {renderBody()}
      </div>

      {shown && !reviewMode && (
        <ReviewPanel
          task={shown}
          history={history[shown.taskId]}
          historyLoading={!history[shown.taskId]}
          canAct={tab === 'action'}
          disabled={busy || dialog !== null}
          onApprove={(t) => setDialog({ kind: 'approve', task: t })}
          onReject={(t) => setDialog({ kind: 'reject', task: t })}
          onClose={() => setSelectedId(null)}
        />
      )}

      {dialog?.kind === 'approve' && (
        <ApproveDialog task={dialog.task} busy={busy} onConfirm={() => confirmApprove(dialog.task)} onCancel={() => setDialog(null)} />
      )}
      {dialog?.kind === 'reject' && (
        <RejectDialog task={dialog.task} busy={busy} onConfirm={(reason, comment) => confirmReject(dialog.task, reason, comment)} onCancel={() => setDialog(null)} />
      )}
    </div>
  );
};

export default TaskList;
