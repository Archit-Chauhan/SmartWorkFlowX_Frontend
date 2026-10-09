import type { UserStatusFilter } from '../../models';

// State of the Manage Users screen. It lives in the URL; the server filters, sorts and pages.

export const PAGE_SIZE = 10;
export const MAX_QUERY_LENGTH = 100;

export type SortKey = 'name' | 'role' | 'status' | 'open' | 'added';
export type SortDir = 'asc' | 'desc';

export interface UsersState {
  q: string;
  status: UserStatusFilter;
  roleId?: number;
  sort: SortKey;
  dir: SortDir;
  page: number;
}

export const DEFAULT_STATE: UsersState = { q: '', status: 'all', sort: 'name', dir: 'asc', page: 1 };

export const STATUS_TABS: { value: UserStatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'deactivated', label: 'Deactivated' },
];

const SORT_KEYS: SortKey[] = ['name', 'role', 'status', 'open', 'added'];

const positiveInt = (v: string | null): number | undefined => {
  if (!v || !/^\d+$/.test(v)) return undefined;
  const n = Number(v);
  return n >= 1 ? n : undefined;
};

/** Reads the screen state from the URL. Unknown or malformed values fall back to the defaults. */
export function parseState(sp: URLSearchParams): UsersState {
  const status = sp.get('status');
  const sort = sp.get('sort') as SortKey | null;
  return {
    q: (sp.get('q') ?? '').trim().slice(0, MAX_QUERY_LENGTH),
    status: status === 'active' || status === 'deactivated' ? status : 'all',
    roleId: positiveInt(sp.get('roleId')),
    sort: sort && SORT_KEYS.includes(sort) ? sort : 'name',
    dir: sp.get('dir') === 'desc' ? 'desc' : 'asc',
    page: positiveInt(sp.get('page')) ?? 1,
  };
}

/** The URL for a state: defaults are left out so a pristine screen has a clean address. */
export function toSearchParams(state: UsersState): URLSearchParams {
  const sp = new URLSearchParams();
  if (state.q) sp.set('q', state.q);
  if (state.status !== 'all') sp.set('status', state.status);
  if (state.roleId) sp.set('roleId', String(state.roleId));
  if (state.sort !== 'name') sp.set('sort', state.sort);
  if (state.dir !== 'asc') sp.set('dir', state.dir);
  if (state.page > 1) sp.set('page', String(state.page));
  return sp;
}

/** Query sent to GET /Admin/users. */
export function toApiParams(state: UsersState, limit = PAGE_SIZE): Record<string, string | number> {
  const params: Record<string, string | number> = { page: state.page, limit, status: state.status, sort: state.sort, dir: state.dir };
  if (state.q) params.search = state.q;
  if (state.roleId) params.roleId = state.roleId;
  return params;
}

/** Query sent to GET /Admin/users/export: the filters on screen, no paging or sorting. */
export function toExportParams(state: UsersState): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  if (state.q) params.search = state.q;
  if (state.status !== 'all') params.status = state.status;
  if (state.roleId) params.roleId = state.roleId;
  return params;
}

/** Applies a change. Anything except moving between pages sends you back to page 1. */
export function applyChange(state: UsersState, patch: Partial<UsersState>): UsersState {
  return { ...state, ...patch, page: patch.page ?? 1 };
}

/** Sorting by a column: a new column starts in its natural direction, the same column flips. */
export function nextSort(state: UsersState, key: SortKey, firstDir: SortDir = 'asc'): Pick<UsersState, 'sort' | 'dir'> {
  if (state.sort !== key) return { sort: key, dir: firstDir };
  return { sort: key, dir: state.dir === 'asc' ? 'desc' : 'asc' };
}

export const hasFilters = (s: UsersState) => !!s.q || s.status !== 'all' || !!s.roleId;

/** Everything except sort back to "no filter". */
export const CLEARED_FILTERS: Partial<UsersState> = { q: '', status: 'all', roleId: undefined };
