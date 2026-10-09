import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, RotateCcw, Search, X } from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';
import type { TaskCategory, TaskItem, TaskStepHistory, User } from '../../models';
import Pagination from '../../components/Pagination';
import EmptyState from '../../components/EmptyState';
import UserAvatar from '../../components/UserAvatar';
import ReviewPanel from './ReviewPanel';
import { PrioritySignal } from './TaskDetails';
import { STATUS_CHIP, stepLabel, stepSegments } from './taskUtils';
import {
  CLEARED_FILTERS, GROUPS, MAX_QUERY_LENGTH, PAGE_SIZE, PRIORITY_CHOICES,
  activePills, ageDays, applyChange, assigneeLabel, clearPatch, dueCell, nextSort, parseState, toSearchParams,
} from './allTasksState';
import type { AllTasksState, SortDir, SortKey } from './allTasksState';
import { useAllTasks } from './useAllTasks';

const SEARCH_DEBOUNCE_MS = 300;

const SEGMENT = { done: 'bg-success', current: 'bg-accent', todo: 'bg-surface-2' } as const;
const DUE_TONE = { overdue: 'text-error', soon: 'text-ink', normal: 'text-ink-muted', none: 'text-ink-subtle' } as const;

interface Column {
  label: string;
  sort: SortKey;
  /** Direction of the first click. */
  firstDir?: SortDir;
  /** Age is the mirror image of "created": youngest first = newest created first. */
  inverted?: boolean;
  className?: string;
}

const COLUMNS: Column[] = [
  { label: 'Priority', sort: 'priority', className: 'w-[64px]' },
  { label: 'Task', sort: 'title' },
  { label: 'Workflow · step', sort: 'workflow' },
  { label: 'Assigned to', sort: 'assignee' },
  { label: 'Status', sort: 'status' },
  { label: 'Due', sort: 'due' },
  { label: 'Age', sort: 'created', firstDir: 'desc', inverted: true },
];

const MOBILE_SORTS: { value: string; label: string }[] = [
  { value: 'due:asc', label: 'Due soonest' },
  { value: 'created:desc', label: 'Newest' },
  { value: 'created:asc', label: 'Oldest' },
  { value: 'priority:asc', label: 'Priority' },
  { value: 'title:asc', label: 'Title A-Z' },
  { value: 'workflow:asc', label: 'Workflow' },
  { value: 'assignee:asc', label: 'Assignee' },
  { value: 'status:asc', label: 'Status' },
];

const AssigneeCell: React.FC<{ task: TaskItem }> = ({ task }) => {
  const who = assigneeLabel(task);
  if (who.kind === 'person') {
    return (
      <span className="inline-flex min-w-0 items-center gap-2">
        <UserAvatar seed={who.text} size={24} />
        <span className="truncate">{who.text}</span>
      </span>
    );
  }
  return <span className={who.kind === 'role' ? 'text-ink-muted' : 'text-ink-subtle'}>{who.text}</span>;
};

const CategoryDot: React.FC<{ task: TaskItem }> = ({ task }) =>
  task.categoryName ? (
    <span className="inline-flex items-center gap-1">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: task.categoryColor || 'var(--accent)' }} aria-hidden="true" />
      {task.categoryName}
    </span>
  ) : null;

const SkeletonRows: React.FC = () => (
  <div aria-hidden="true" className="animate-pulse divide-y divide-hairline">
    {Array.from({ length: 6 }, (_, i) => (
      <div key={i} className="flex items-center gap-4 px-4 py-4">
        <div className="h-3.5 w-4 rounded bg-surface-2" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 w-2/5 rounded bg-surface-2" />
          <div className="h-3 w-3/5 rounded bg-surface-2" />
        </div>
        <div className="hidden h-3.5 w-24 rounded bg-surface-2 md:block" />
        <div className="hidden h-3.5 w-28 rounded bg-surface-2 md:block" />
        <div className="h-5 w-20 rounded-pill bg-surface-2" />
      </div>
    ))}
  </div>
);

const AllTasks: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const state = useMemo(() => parseState(searchParams), [searchParams]);

  const update = useCallback(
    (patch: Partial<AllTasksState>, replace = false) =>
      setSearchParams((prev) => toSearchParams(applyChange(parseState(prev), patch)), { replace }),
    [setSearchParams],
  );

  // Search: the box follows what is typed, the URL (and so the request) follows 300 ms later.
  const [searchText, setSearchText] = useState(state.q);
  const [seenQ, setSeenQ] = useState(state.q);
  if (state.q !== seenQ) {
    setSeenQ(state.q);
    if (state.q !== searchText.trim()) setSearchText(state.q);
  }
  useEffect(() => {
    const wanted = searchText.trim().slice(0, MAX_QUERY_LENGTH);
    if (wanted === state.q) return;
    const timer = setTimeout(() => update({ q: wanted }, true), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchText, state.q, update]);

  const { data, loading, failed, reload } = useAllTasks(state);

  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [users, setUsers] = useState<Pick<User, 'userId' | 'name'>[]>([]);
  useEffect(() => {
    axiosInstance.get<TaskCategory[]>('/Task/categories').then((r) => setCategories(r.data)).catch(() => undefined);
    axiosInstance.get<User[]>('/Task/assignable-users').then((r) => setUsers(r.data)).catch(() => undefined);
  }, []);

  // Asking for a page past the end (e.g. from an old link) lands on the last real page.
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  useEffect(() => {
    if (!loading && data && data.data.length === 0 && data.total > 0 && state.page > totalPages) {
      update({ page: totalPages }, true);
    }
  }, [loading, data, state.page, totalPages, update]);

  // Read-only detail panel.
  const [selected, setSelected] = useState<TaskItem | null>(null);
  const [history, setHistory] = useState<Record<number, TaskStepHistory[]>>({});
  useEffect(() => {
    if (!selected || history[selected.taskId]) return;
    const id = selected.taskId;
    axiosInstance
      .get<TaskStepHistory[]>(`/Task/${id}/history`)
      .then((res) => setHistory((prev) => ({ ...prev, [id]: res.data })))
      .catch(() => setHistory((prev) => ({ ...prev, [id]: [] })));
  }, [selected, history]);

  const pills = activePills(state, categories, users);
  const hasFilters = pills.length > 0;
  const rows = data?.data ?? [];
  const firstLoad = !data && !failed;
  const showFailure = failed;
  const showEmpty = !showFailure && !firstLoad && !loading && rows.length === 0;

  const resultText = !data
    ? 'Loading tasks...'
    : data.total === 0
      ? '0 tasks'
      : `Showing ${(state.page - 1) * PAGE_SIZE + 1}-${Math.min(state.page * PAGE_SIZE, data.total)} of ${data.total} task${data.total === 1 ? '' : 's'}`;

  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const onTabKey = (e: React.KeyboardEvent, index: number) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = GROUPS[(index + step + GROUPS.length) % GROUPS.length];
    update({ group: next.value });
    tabRefs.current[next.value]?.focus();
  };

  const ariaSort = (c: Column): 'ascending' | 'descending' | 'none' => {
    if (state.sort !== c.sort) return 'none';
    const asc = c.inverted ? state.dir === 'desc' : state.dir === 'asc';
    return asc ? 'ascending' : 'descending';
  };

  const selectClass = 'input w-full min-w-0 sm:w-auto sm:min-w-[150px]';

  return (
    <div className="space-y-4">
      <div>
        <h1 className="sr-only">All Tasks</h1>
        <p className="caption" role="status" aria-live="polite">{resultText}</p>
      </div>

      <div className="card overflow-hidden">
        {/* Toolbar */}
        <div role="search" className="grid grid-cols-2 items-center gap-2 p-3 sm:flex sm:flex-wrap">
          <div className="relative col-span-2 sm:min-w-[200px] sm:flex-[1_1_240px]">
            <label htmlFor="at-search" className="sr-only">Search tasks</label>
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
            <input
              id="at-search"
              type="search"
              className="input pl-9"
              placeholder="Search tasks"
              maxLength={MAX_QUERY_LENGTH}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>

          <label htmlFor="at-priority" className="sr-only">Priority</label>
          <select id="at-priority" className={selectClass} value={state.priority ?? ''} onChange={(e) => update({ priority: (e.target.value || undefined) as AllTasksState['priority'] })}>
            <option value="">Priority: any</option>
            {PRIORITY_CHOICES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>

          <label htmlFor="at-assignee" className="sr-only">Assignee</label>
          <select id="at-assignee" className={selectClass} value={state.assignedTo ?? ''} onChange={(e) => update({ assignedTo: e.target.value ? Number(e.target.value) : undefined })}>
            <option value="">Assignee: anyone</option>
            {users.map((u) => <option key={u.userId} value={u.userId}>{u.name}</option>)}
          </select>

          <label htmlFor="at-category" className="sr-only">Category</label>
          <select id="at-category" className={selectClass} value={state.categoryId ?? ''} onChange={(e) => update({ categoryId: e.target.value ? Number(e.target.value) : undefined })}>
            <option value="">Category: any</option>
            {categories.map((c) => <option key={c.categoryId} value={c.categoryId}>{c.name}</option>)}
          </select>

          <label htmlFor="at-sort" className="sr-only">Sort by</label>
          <select
            id="at-sort"
            className={`${selectClass} md:hidden`}
            value={`${state.sort}:${state.dir}`}
            onChange={(e) => { const [sort, dir] = e.target.value.split(':'); update({ sort: sort as SortKey, dir: dir as SortDir }); }}
          >
            {!MOBILE_SORTS.some((s) => s.value === `${state.sort}:${state.dir}`) && <option value={`${state.sort}:${state.dir}`}>Custom order</option>}
            {MOBILE_SORTS.map((s) => <option key={s.value} value={s.value}>Sort: {s.label}</option>)}
          </select>

          <button
            type="button"
            aria-pressed={state.overdue}
            onClick={() => update({ overdue: !state.overdue })}
            className={`btn col-span-2 border sm:col-span-1 ${state.overdue ? 'border-error bg-error/10 font-semibold text-error' : 'border-hairline-strong bg-canvas text-ink hover:bg-surface-1'}`}
          >
            <AlertTriangle size={15} aria-hidden="true" /> Overdue only
          </button>
        </div>

        {hasFilters && (
          <div className="flex flex-wrap items-center gap-1.5 px-3 pb-3">
            <span className="caption">Filters:</span>
            {pills.map((p) => (
              <span key={p.key} className="inline-flex items-center gap-1 rounded-pill bg-accent-soft py-0.5 pl-2.5 pr-1 text-xs font-semibold text-accent">
                {p.label}
                <button
                  type="button"
                  aria-label={`Remove filter ${p.label}`}
                  onClick={() => update(clearPatch(p.key))}
                  className="grid h-[22px] w-[22px] place-items-center rounded-full hover:bg-accent/15"
                >
                  <X size={13} aria-hidden="true" />
                </button>
              </span>
            ))}
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => update(CLEARED_FILTERS)}>Clear all</button>
          </div>
        )}

        {/* Tabs */}
        <div role="tablist" aria-label="Status group" className="flex gap-0.5 overflow-x-auto overflow-y-hidden [scrollbar-width:none] border-b border-hairline px-3">
          {GROUPS.map((g, i) => {
            const active = state.group === g.value;
            return (
              <button
                key={g.value}
                ref={(el) => { tabRefs.current[g.value] = el; }}
                id={`at-tab-${g.value}`}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls="at-panel"
                tabIndex={active ? 0 : -1}
                onClick={() => update({ group: g.value })}
                onKeyDown={(e) => onTabKey(e, i)}
                className={`-mb-px min-h-11 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors ${
                  active ? 'border-accent font-semibold text-accent' : 'border-transparent text-ink-muted hover:text-ink'
                }`}
              >
                {g.label}
                <span className="ml-1.5 font-normal text-ink-subtle">{data ? data.counts[g.value] : ''}</span>
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div id="at-panel" role="tabpanel" aria-labelledby={`at-tab-${state.group}`} aria-busy={loading}>
          {showFailure ? (
            <div className="flex flex-col items-center gap-3 py-12 text-sm text-ink-muted" role="alert">
              <p>We couldn't load the tasks.</p>
              <button type="button" className="btn btn-secondary btn-sm" onClick={reload}>Try again</button>
            </div>
          ) : firstLoad ? (
            <SkeletonRows />
          ) : showEmpty ? (
            <EmptyState
              illustration="empty"
              title={hasFilters || state.group !== 'all' ? 'No tasks match these filters' : 'No tasks yet'}
              hint={hasFilters || state.group !== 'all' ? 'Try removing a filter or switching tab.' : 'Tasks show up here as soon as they are assigned.'}
            >
              {(hasFilters || state.group !== 'all') && (
                <button type="button" className="btn btn-secondary btn-sm mt-2" onClick={() => update({ ...CLEARED_FILTERS, group: 'all' })}>Clear filters</button>
              )}
            </EmptyState>
          ) : (
            <div className={`overflow-x-auto max-md:overflow-visible transition-opacity ${loading ? 'opacity-60' : ''}`}>
              <table className="w-full min-w-[820px] border-collapse text-sm max-md:block max-md:min-w-0">
                <caption className="sr-only">All tasks</caption>
                <thead className="max-md:hidden">
                  <tr>
                    {COLUMNS.map((c) => {
                      const sort = ariaSort(c);
                      const Icon = sort === 'ascending' ? ArrowUp : sort === 'descending' ? ArrowDown : ArrowUpDown;
                      return (
                        <th key={c.sort} scope="col" aria-sort={sort} className={`border-b border-hairline bg-surface-1 p-0 text-left text-[11px] font-bold uppercase tracking-wider ${sort === 'none' ? 'text-ink-subtle' : 'text-ink'} ${c.className ?? ''}`}>
                          <button
                            type="button"
                            onClick={() => update(nextSort(state, c.sort, c.firstDir))}
                            className="flex min-h-10 w-full items-center gap-1 px-3 py-2 text-left uppercase tracking-wider hover:text-ink"
                          >
                            {c.label}
                            <Icon size={13} aria-hidden="true" className={sort === 'none' ? 'opacity-50' : ''} />
                          </button>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="max-md:block">
                  {rows.map((t) => {
                    const due = dueCell(t);
                    const segments = stepSegments(t);
                    const isSelected = selected?.taskId === t.taskId;
                    return (
                      <tr
                        key={t.taskId}
                        onClick={() => setSelected(t)}
                        className={`cursor-pointer border-b border-hairline last:border-b-0 hover:bg-surface-1 max-md:relative max-md:flex max-md:flex-wrap max-md:items-center max-md:gap-x-3 max-md:gap-y-1 max-md:py-3 max-md:pl-10 max-md:pr-3 ${isSelected ? 'bg-accent-soft' : ''}`}
                      >
                        <td className="px-3 py-2.5 align-top max-md:absolute max-md:left-3.5 max-md:top-4 max-md:p-0">
                          <PrioritySignal priority={t.priority} />
                        </td>
                        <td className="max-w-[340px] px-3 py-2.5 align-top max-md:block max-md:min-w-0 max-md:max-w-none max-md:basis-full max-md:p-0">
                          <div className="min-w-0">
                            <div className="flex min-w-0 items-center gap-2">
                              {t.rejectedReason && (
                                <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-error">
                                  <RotateCcw size={12} aria-hidden="true" />Sent back
                                </span>
                              )}
                              <button
                                type="button"
                                aria-haspopup="dialog"
                                onClick={(e) => { e.stopPropagation(); setSelected(t); }}
                                className="min-w-0 truncate rounded-sm text-left font-semibold text-ink hover:underline"
                              >
                                {t.title}
                              </button>
                            </div>
                            <p className={`truncate text-[13px] ${t.description ? 'text-ink-muted' : 'italic text-ink-subtle'}`}>{t.description || 'No description'}</p>
                            {t.categoryName && <p className="caption mt-0.5 max-md:hidden"><CategoryDot task={t} /></p>}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 align-top max-md:block max-md:p-0 max-md:text-xs max-md:text-ink-muted">
                          <div className="text-[13px] max-md:inline max-md:text-xs">{t.workflowTitle || 'Workflow'}</div>
                          <div className="caption max-md:ml-1 max-md:inline"><span className="md:hidden" aria-hidden="true">· </span>{stepLabel(t)}</div>
                          {segments.length > 0 && (
                            <div className="mt-1 flex w-[72px] gap-0.5 max-md:hidden" role="img" aria-label={stepLabel(t)}>
                              {segments.map((s, i) => <i key={i} className={`h-1 flex-1 rounded-sm ${SEGMENT[s]}`} />)}
                            </div>
                          )}
                        </td>
                        <td className="max-w-[200px] px-3 py-2.5 align-top max-md:block max-md:max-w-none max-md:p-0 max-md:text-[13px]">
                          <AssigneeCell task={t} />
                        </td>
                        <td className="px-3 py-2.5 align-top max-md:block max-md:p-0">
                          <span className={`chip ${STATUS_CHIP[t.status] || STATUS_CHIP.Pending}`}>{t.status}</span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 align-top tabular-nums max-md:block max-md:p-0 max-md:text-[13px]">
                          <span className={`font-semibold ${DUE_TONE[due.tone]}`}>
                            {due.tone === 'overdue' && <AlertTriangle size={13} className="mr-1 inline -translate-y-px" aria-hidden="true" />}
                            {due.label}
                          </span>
                          {due.sub && <div className="caption max-md:hidden">{due.sub}</div>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 align-top text-ink-subtle max-md:hidden">{ageDays(t.createdAt)}d</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {!showFailure && totalPages > 1 && (
        <Pagination
          currentPage={Math.min(state.page, totalPages)}
          totalPages={totalPages}
          totalItems={total}
          pageSize={PAGE_SIZE}
          onPageChange={(p) => update({ page: p })}
        />
      )}

      {selected && (
        <ReviewPanel
          task={selected}
          history={history[selected.taskId]}
          historyLoading={!history[selected.taskId]}
          canAct={false}
          disabled={false}
          onApprove={() => undefined}
          onReject={() => undefined}
          onClose={() => setSelected(null)}
          currentlyWith={<AssigneeCell task={selected} />}
          readOnlyNote="Approvals are done by the person the task is with, from their My Tasks."
        />
      )}
    </div>
  );
};

export default AllTasks;
