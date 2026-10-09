import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Search, UserPlus } from 'lucide-react';
import { toast } from 'react-toastify';
import axiosInstance from '../../api/axiosInstance';
import { useAuth } from '../../context/AuthContext';
import type { AdminUser, RoleOption } from '../../models';
import Pagination from '../../components/Pagination';
import EmptyState from '../../components/EmptyState';
import UserAvatar from '../../components/UserAvatar';
import { RoleChip, StatusChip } from '../users/Chips';
import UserPanel from '../users/UserPanel';
import InviteDrawer from '../users/InviteDrawer';
import { useUsers } from '../users/useUsers';
import {
  CLEARED_FILTERS, MAX_QUERY_LENGTH, PAGE_SIZE, STATUS_TABS,
  applyChange, hasFilters, nextSort, parseState, toExportParams, toSearchParams,
} from '../users/usersState';
import type { SortDir, SortKey, UsersState } from '../users/usersState';
import { formatAdded, plural } from '../users/userUtils';

const SEARCH_DEBOUNCE_MS = 300;

interface Column {
  label: string;
  sort: SortKey;
  /** Direction of the first click. */
  firstDir?: SortDir;
  className?: string;
}

const COLUMNS: Column[] = [
  { label: 'User', sort: 'name' },
  { label: 'Role', sort: 'role' },
  { label: 'Status', sort: 'status' },
  { label: 'Open tasks', sort: 'open', firstDir: 'desc' },
  { label: 'Added', sort: 'added', firstDir: 'desc' },
];

const MOBILE_SORTS: { value: string; label: string }[] = [
  { value: 'name:asc', label: 'Name A-Z' },
  { value: 'name:desc', label: 'Name Z-A' },
  { value: 'role:asc', label: 'Role' },
  { value: 'status:asc', label: 'Status' },
  { value: 'open:desc', label: 'Most open tasks' },
  { value: 'added:desc', label: 'Newest' },
  { value: 'added:asc', label: 'Oldest' },
];

const SkeletonRows: React.FC = () => (
  <div aria-hidden="true" className="animate-pulse divide-y divide-hairline">
    {Array.from({ length: 6 }, (_, i) => (
      <div key={i} className="flex items-center gap-4 px-4 py-4">
        <div className="h-8 w-8 rounded-full bg-surface-2" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 w-1/3 rounded bg-surface-2" />
          <div className="h-3 w-1/2 rounded bg-surface-2" />
        </div>
        <div className="hidden h-5 w-20 rounded-pill bg-surface-2 md:block" />
        <div className="h-5 w-20 rounded-pill bg-surface-2" />
      </div>
    ))}
  </div>
);

const UserManagement: React.FC = () => {
  const { user: me } = useAuth();
  const myEmail = me?.email?.toLowerCase();

  const [searchParams, setSearchParams] = useSearchParams();
  const state = useMemo(() => parseState(searchParams), [searchParams]);

  const update = useCallback(
    (patch: Partial<UsersState>, replace = false) =>
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

  const { data, loading, failed, reload } = useUsers(state);

  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [rolesFailed, setRolesFailed] = useState(false);
  const loadRoles = useCallback(() => {
    setRolesFailed(false);
    axiosInstance.get<RoleOption[]>('/Admin/roles').then((r) => setRoles(r.data)).catch(() => setRolesFailed(true));
  }, []);
  useEffect(() => { loadRoles(); }, [loadRoles]);

  // Asking for a page past the end (e.g. from an old link, or after the last row of a page went away) lands on the last real page.
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  useEffect(() => {
    if (!loading && data && data.data.length === 0 && data.total > 0 && state.page > totalPages) {
      update({ page: totalPages }, true);
    }
  }, [loading, data, state.page, totalPages, update]);

  // Panels. The open user follows the list when it reloads, and keeps its own state if it left the page.
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [inviting, setInviting] = useState(false);
  const [seenData, setSeenData] = useState(data);
  if (data !== seenData) {
    setSeenData(data);
    const live = selected && data?.data.find((u) => u.userId === selected.userId);
    if (live) setSelected(live);
  }

  const onChanged = (patch: Partial<AdminUser>, message: string) => {
    setSelected((prev) => (prev ? { ...prev, ...patch } : prev));
    toast.success(message);
    reload();
  };

  const onInvited = (email: string) => {
    setInviting(false);
    toast.success(`Invitation created for ${email}.`);
    reload();
  };

  const [exporting, setExporting] = useState(false);
  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await axiosInstance.get('/Admin/users/export', { params: toExportParams(state), responseType: 'blob' });
      const href = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = href;
      a.download = 'users.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(href);
    } catch {
      toast.error('Failed to export users.');
    } finally {
      setExporting(false);
    }
  };

  const rows = data?.data ?? [];
  const filtered = hasFilters(state);
  const showFailure = failed;
  const firstLoad = !data && !failed;
  const showEmpty = !showFailure && !firstLoad && !loading && rows.length === 0;

  const resultText = !data
    ? 'Loading users...'
    : data.total === 0
      ? '0 users'
      : `Showing ${(state.page - 1) * PAGE_SIZE + 1}-${Math.min(state.page * PAGE_SIZE, data.total)} of ${plural(data.total, 'user')}`;

  const ariaSort = (c: Column): 'ascending' | 'descending' | 'none' =>
    state.sort !== c.sort ? 'none' : state.dir === 'asc' ? 'ascending' : 'descending';

  const openRow = (u: AdminUser) => setSelected(u);
  const rowKey = (e: React.KeyboardEvent, u: AdminUser) => {
    if (e.key === 'Enter' && e.target === e.currentTarget) openRow(u);
  };

  const selectClass = 'input w-full min-w-0 sm:w-auto sm:min-w-[150px]';

  return (
    <div className="space-y-4">
      <div>
        <h1 className="sr-only">Manage Users</h1>
        <p className="caption" role="status" aria-live="polite">{resultText}</p>
      </div>

      <div className="card overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-3">
          <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1.5">
            {STATUS_TABS.map((t) => {
              const active = state.status === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => update({ status: t.value })}
                  className={`inline-flex min-h-9 items-center gap-1.5 rounded-pill border px-3 text-sm transition-colors ${
                    active ? 'border-accent bg-accent-soft font-semibold text-accent' : 'border-hairline-strong bg-canvas text-ink-muted hover:bg-surface-1 hover:text-ink'
                  }`}
                >
                  {t.label}
                  <b className="font-semibold tabular-nums">{data ? data.counts[t.value] : ''}</b>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-secondary" onClick={handleExport} disabled={exporting}>
              <Download size={16} aria-hidden="true" /> {exporting ? 'Exporting...' : 'Export CSV'}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setInviting(true)}>
              <UserPlus size={16} aria-hidden="true" /> Invite user
            </button>
          </div>
        </div>

        <div role="search" className="grid grid-cols-2 items-center gap-2 border-t border-hairline p-3 sm:flex sm:flex-wrap">
          <div className="relative col-span-2 sm:min-w-[200px] sm:flex-[1_1_240px]">
            <label htmlFor="um-search" className="sr-only">Search users</label>
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
            <input
              id="um-search"
              type="search"
              className="input pl-9"
              placeholder="Search by name or email"
              maxLength={MAX_QUERY_LENGTH}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>

          <label htmlFor="um-role" className="sr-only">Filter by role</label>
          <select
            id="um-role"
            className={selectClass}
            value={state.roleId ?? ''}
            onChange={(e) => update({ roleId: e.target.value ? Number(e.target.value) : undefined })}
          >
            <option value="">Role: any</option>
            {roles.map((r) => <option key={r.roleId} value={r.roleId}>{r.roleName}</option>)}
          </select>

          <label htmlFor="um-sort" className="sr-only">Sort by</label>
          <select
            id="um-sort"
            className={`${selectClass} md:hidden`}
            value={`${state.sort}:${state.dir}`}
            onChange={(e) => { const [sort, dir] = e.target.value.split(':'); update({ sort: sort as SortKey, dir: dir as SortDir }); }}
          >
            {!MOBILE_SORTS.some((s) => s.value === `${state.sort}:${state.dir}`) && <option value={`${state.sort}:${state.dir}`}>Custom order</option>}
            {MOBILE_SORTS.map((s) => <option key={s.value} value={s.value}>Sort: {s.label}</option>)}
          </select>
        </div>

        {/* Body */}
        <div aria-busy={loading} className="border-t border-hairline">
          {showFailure ? (
            <div className="flex flex-col items-center gap-3 py-12 text-sm text-ink-muted" role="alert">
              <p>We couldn't load the users.</p>
              <button type="button" className="btn btn-secondary btn-sm" onClick={reload}>Try again</button>
            </div>
          ) : firstLoad ? (
            <SkeletonRows />
          ) : showEmpty ? (
            <EmptyState
              illustration="empty"
              title={filtered ? 'No users match these filters' : 'No users yet'}
              hint={filtered ? 'Try another search, status or role.' : 'Invite the first person to get started.'}
            >
              {filtered
                ? <button type="button" className="btn btn-secondary btn-sm mt-2" onClick={() => update(CLEARED_FILTERS)}>Clear filters</button>
                : <button type="button" className="btn btn-primary btn-sm mt-2" onClick={() => setInviting(true)}>Invite user</button>}
            </EmptyState>
          ) : (
            <div className={`overflow-x-auto max-md:overflow-visible transition-opacity ${loading ? 'opacity-60' : ''}`}>
              <table className="w-full min-w-[760px] border-collapse text-sm max-md:block max-md:min-w-0">
                <caption className="sr-only">Users</caption>
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
                    <th scope="col" className="border-b border-hairline bg-surface-1 px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wider text-ink-subtle">Actions</th>
                  </tr>
                </thead>
                <tbody className="max-md:block">
                  {rows.map((u) => (
                    <tr
                      key={u.userId}
                      tabIndex={0}
                      onClick={() => openRow(u)}
                      onKeyDown={(e) => rowKey(e, u)}
                      className={`cursor-pointer border-b border-hairline last:border-b-0 hover:bg-surface-1 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent max-md:flex max-md:flex-wrap max-md:items-center max-md:gap-x-2 max-md:gap-y-1.5 max-md:p-3 ${selected?.userId === u.userId ? 'bg-accent-soft' : ''}`}
                    >
                      <td className="px-3 py-2.5 max-md:order-1 max-md:basis-[calc(100%-6rem)] max-md:p-0">
                        <div className={`flex min-w-0 items-center gap-3 ${u.isDeleted ? 'opacity-70' : ''}`}>
                          <UserAvatar seed={u.name} size={32} />
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-ink">{u.name}</p>
                            <p className="truncate text-[13px] text-ink-muted">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 max-md:order-3 max-md:p-0"><RoleChip roleName={u.roleName} /></td>
                      <td className="px-3 py-2.5 max-md:order-3 max-md:p-0"><StatusChip deactivated={u.isDeleted} /></td>
                      <td className="px-3 py-2.5 tabular-nums max-md:order-3 max-md:p-0 max-md:text-xs max-md:text-ink-muted">
                        {u.openTaskCount}<span className="md:hidden"> open</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-ink-muted max-md:order-3 max-md:p-0 max-md:text-xs">
                        <span className="md:hidden">Added </span>{formatAdded(u.createdAt)}
                      </td>
                      <td className="px-3 py-2.5 text-right max-md:order-2 max-md:ml-auto max-md:p-0">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          aria-haspopup="dialog"
                          aria-label={`Manage ${u.name}`}
                          onClick={(e) => { e.stopPropagation(); openRow(u); }}
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))}
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
        <UserPanel
          key={selected.userId}
          user={selected}
          roles={roles}
          isMe={!!myEmail && selected.email.toLowerCase() === myEmail}
          version={data}
          onClose={() => setSelected(null)}
          onChanged={onChanged}
        />
      )}

      {inviting && (
        <InviteDrawer
          roles={roles}
          rolesFailed={rolesFailed}
          onRetryRoles={loadRoles}
          onClose={() => setInviting(false)}
          onCreated={onInvited}
        />
      )}
    </div>
  );
};

export default UserManagement;
