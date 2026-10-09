// Pure helpers for the Manage Users screen: role copy, password generator, form validation.

export const ROLE_DESCRIPTIONS: Record<string, string> = {
  Admin: 'Everything, including users and audit logs.',
  Manager: 'Assigns tasks, approves steps, sees the dashboard.',
  Employee: 'Works on tasks assigned to them.',
  Auditor: 'Read-only: dashboard, tasks and audit logs.',
};

export const GENERIC_ROLE_DESCRIPTION = 'Access is set by this role’s permissions.';

export const roleDescription = (roleName: string): string => ROLE_DESCRIPTIONS[roleName] ?? GENERIC_ROLE_DESCRIPTION;

const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%&*?';
export const GENERATED_PASSWORD_LENGTH = 12;

/** Uniform random integer in [0, max) from crypto.getRandomValues (rejection sampling, no modulo bias). */
function randomInt(max: number): number {
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  do { crypto.getRandomValues(buf); } while (buf[0] >= limit);
  return buf[0] % max;
}

/** A 12-character password with at least one lower-case letter, upper-case letter, digit and symbol. */
export function generatePassword(length = GENERATED_PASSWORD_LENGTH): string {
  const all = LOWER + UPPER + DIGITS + SYMBOLS;
  const chars = [LOWER, UPPER, DIGITS, SYMBOLS].map((set) => set[randomInt(set.length)]);
  while (chars.length < length) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export interface InviteValues {
  name: string;
  email: string;
  password: string;
  roleId: number | null;
}

export type InviteErrors = Partial<Record<keyof InviteValues, string>>;

/** Field order, which is also the order focus moves to on a failed submit. */
export const INVITE_FIELD_ORDER: (keyof InviteValues)[] = ['name', 'email', 'password', 'roleId'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Same rules and messages as POST /Admin/users. */
export function validateInvite(v: InviteValues): InviteErrors {
  const e: InviteErrors = {};
  const name = v.name.trim();
  const email = v.email.trim();
  if (!name) e.name = 'Name is required.';
  else if (name.length > 100) e.name = 'Name must be 100 characters or fewer.';
  if (!email || !EMAIL_RE.test(email)) e.email = 'Enter a valid email address.';
  else if (email.length > 200) e.email = 'Email must be 200 characters or fewer.';
  if (v.password.length < 8) e.password = 'Password must be at least 8 characters.';
  if (v.roleId == null) e.roleId = 'Select a role.';
  return e;
}

/** The message an API error carries, or a fallback. */
export function apiMessage(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  return typeof message === 'string' && message ? message : fallback;
}

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export const formatAdded = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};
