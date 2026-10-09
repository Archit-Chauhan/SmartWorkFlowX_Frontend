// Demo-only: the Admin users endpoints, following docs/USERS_SPEC.md (same rules, same messages as the real API).
import type { DemoStore } from './data';
import { ROLES } from './data';
import type { AdminUser } from '../models/User';

/** An error the real API would answer with a 400 or 404 and a `message`. */
export class UsersApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const bad = (message: string) => new UsersApiError(400, message);
const notFound = (message: string) => new UsersApiError(404, message);

const STATUSES = ['all', 'active', 'deactivated'];
const SORTS = ['name', 'role', 'status', 'open', 'added'];
const ADMIN = 'Admin';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const roleName = (roleId: number) => ROLES.find((r) => r.roleId === roleId)?.roleName ?? '';

function toRow(openByUser: Map<number, number>, u: DemoStore['users'][number]): AdminUser {
  return {
    userId: u.userId, name: u.name, email: u.email, roleName: roleName(u.roleId), roleId: u.roleId,
    createdAt: u.createdAt ?? new Date(0).toISOString(), isDeleted: u.isDeleted,
    deletedAt: u.isDeleted ? (u.deletedAt ?? null) : null, openTaskCount: openByUser.get(u.userId) ?? 0,
  };
}

function openTaskCounts(s: DemoStore): Map<number, number> {
  const map = new Map<number, number>();
  for (const t of s.tasks) {
    if (t.assignedTo != null && (t.status === 'Pending' || t.status === 'In Progress')) map.set(t.assignedTo, (map.get(t.assignedTo) ?? 0) + 1);
  }
  return map;
}

/** Validates status/sort/dir exactly like the real API. Shared by the list and the export. */
function readFilters(q: URLSearchParams) {
  const status = q.get('status') || 'all';
  if (!STATUSES.includes(status)) throw bad('Status must be all, active or deactivated.');
  const roleId = q.get('roleId') ? Number(q.get('roleId')) : undefined;
  const search = (q.get('search') || '').trim().toLowerCase();
  return { status, roleId, search };
}

function matching(s: DemoStore, q: URLSearchParams) {
  const { status, roleId, search } = readFilters(q);
  const base = s.users.filter((u) =>
    (!search || u.name.toLowerCase().includes(search) || u.email.toLowerCase().includes(search)) && (roleId === undefined || u.roleId === roleId));
  const counts = { all: base.length, active: base.filter((u) => !u.isDeleted).length, deactivated: base.filter((u) => u.isDeleted).length };
  const shown = base.filter((u) => status === 'all' || (status === 'active' ? !u.isDeleted : u.isDeleted));
  return { shown, counts };
}

export function queryUsers(s: DemoStore, q: URLSearchParams) {
  const sort = q.get('sort') || 'name';
  const dir = q.get('dir') || 'asc';
  if (!SORTS.includes(sort)) throw bad('Sort must be one of: name, role, status, open, added.');
  if (dir !== 'asc' && dir !== 'desc') throw bad('Direction must be asc or desc.');

  const { shown, counts } = matching(s, q);
  const open = openTaskCounts(s);
  const rows = shown.map((u) => toRow(open, u));
  const key = (r: AdminUser): string | number => {
    switch (sort) {
      case 'role': return r.roleName.toLowerCase();
      case 'status': return r.isDeleted ? 1 : 0; // active first when ascending
      case 'open': return r.openTaskCount;
      case 'added': return Date.parse(r.createdAt);
      default: return r.name.toLowerCase();
    }
  };
  const sign = dir === 'desc' ? -1 : 1;
  rows.sort((a, b) => {
    const ka = key(a), kb = key(b);
    if (ka !== kb) return (ka < kb ? -1 : 1) * sign;
    return a.userId - b.userId; // ties: stable across pages
  });

  const size = Number(q.get('limit') || q.get('pageSize') || 10);
  const page = Number(q.get('page') || 1);
  return { data: rows.slice((page - 1) * size, page * size), total: rows.length, page, pageSize: size, counts };
}

/** CSV of the users that match the same filters as the screen. */
export function usersCsv(s: DemoStore, q: URLSearchParams): string {
  const { shown } = matching(s, q);
  const cell = (v: unknown) => JSON.stringify(v ?? '');
  const lines = shown.map((u) => [u.userId, u.name, u.email, roleName(u.roleId), u.isDeleted ? 'Deactivated' : 'Active', u.createdAt].map(cell).join(','));
  return ['userId,name,email,role,status,createdAt', ...lines].join('\n');
}

const activeAdmins = (s: DemoStore) => s.users.filter((u) => u.roleId === ROLES.find((r) => r.roleName === ADMIN)!.roleId && !u.isDeleted);
const isOnlyActiveAdmin = (s: DemoStore, userId: number) => {
  const admins = activeAdmins(s);
  return admins.length === 1 && admins[0].userId === userId;
};

export function createUser(s: DemoStore, body: Record<string, unknown>) {
  const name = String(body.name ?? '').trim();
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  if (!name) throw bad('Name is required.');
  if (name.length > 100) throw bad('Name must be 100 characters or fewer.');
  if (!email || !EMAIL_RE.test(email)) throw bad('Enter a valid email address.');
  if (email.length > 200) throw bad('Email must be 200 characters or fewer.');
  const existing = s.users.find((u) => u.email.toLowerCase() === email);
  if (existing?.isDeleted) throw bad('A deactivated user with this email already exists. Restore them instead.');
  if (existing) throw bad('A user with this email already exists.');
  if (password.length < 8) throw bad('Password must be at least 8 characters.');
  const role = ROLES.find((r) => r.roleId === Number(body.roleId));
  if (!role) throw bad('The selected role was not found.');
  const userId = ++s.nextId;
  s.users.unshift({ userId, name, email, roleId: role.roleId, role, isDeleted: false, createdAt: new Date().toISOString() });
  return { message: 'User created successfully', userId };
}

export function changeRole(s: DemoStore, id: number, body: Record<string, unknown>, meId: number) {
  const user = s.users.find((u) => u.userId === id);
  if (!user) throw notFound('User not found.');
  const role = ROLES.find((r) => r.roleId === Number(body.roleId));
  if (!role) throw bad('The selected role was not found.');
  if (id === meId) throw bad('You cannot change your own role.');
  if (user.isDeleted) throw bad('Restore the user before changing their role.');
  if (user.roleId === role.roleId) return { message: 'Role unchanged.' };
  if (roleName(user.roleId) === ADMIN && role.roleName !== ADMIN && isOnlyActiveAdmin(s, id)) {
    throw bad('The last active Admin cannot be demoted. Make someone else an Admin first.');
  }
  user.roleId = role.roleId;
  user.role = role;
  return { message: 'Role updated successfully.' };
}

export function deactivateUser(s: DemoStore, id: number, meId: number) {
  const user = s.users.find((u) => u.userId === id);
  if (id === meId) throw bad('You cannot delete your own account.');
  if (!user) throw notFound('User not found.');
  if (!user.isDeleted && isOnlyActiveAdmin(s, id)) throw bad('The last active Admin cannot be deactivated. Make someone else an Admin first.');
  user.isDeleted = true;
  user.deletedAt = new Date().toISOString();
  return { message: 'User deactivated successfully.' };
}

export function restoreUser(s: DemoStore, id: number) {
  const user = s.users.find((u) => u.userId === id);
  if (!user) throw notFound('User not found.');
  user.isDeleted = false;
  user.deletedAt = undefined;
  return { message: 'User restored successfully.' };
}
