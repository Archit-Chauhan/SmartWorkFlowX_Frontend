import React from 'react';
import type { RoleOption } from '../../models';
import { roleDescription } from './userUtils';

interface Props {
  roles: RoleOption[];
  value: number | null;
  onChange: (roleId: number) => void;
  /** Every card is read-only (own account, last Admin). */
  disabled?: boolean;
  label?: string;
  describedBy?: string;
  invalid?: boolean;
  idPrefix: string;
}

/** Radio-style cards: one per role, with a plain-words description of what the role can do. */
const RoleCards: React.FC<Props> = ({ roles, value, onChange, disabled = false, label = 'Role', describedBy, invalid, idPrefix }) => {
  const move = (e: React.KeyboardEvent, index: number) => {
    const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
    if (!step || disabled) return;
    e.preventDefault();
    const next = roles[(index + step + roles.length) % roles.length];
    onChange(next.roleId);
    document.getElementById(`${idPrefix}-${next.roleId}`)?.focus();
  };
  // With nothing selected the first card is the tab stop.
  const tabStop = roles.some((r) => r.roleId === value) ? value : roles[0]?.roleId;

  return (
    <div role="radiogroup" aria-label={label} aria-describedby={describedBy} aria-invalid={invalid || undefined} className="grid gap-2 sm:grid-cols-2">
      {roles.map((r, i) => {
        const checked = r.roleId === value;
        return (
          <button
            key={r.roleId}
            id={`${idPrefix}-${r.roleId}`}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-disabled={disabled || undefined}
            tabIndex={disabled ? -1 : r.roleId === tabStop ? 0 : -1}
            onClick={() => { if (!disabled) onChange(r.roleId); }}
            onKeyDown={(e) => move(e, i)}
            className={`flex items-start gap-2.5 rounded-control border p-3 text-left transition-colors ${
              checked ? 'border-accent bg-accent-soft' : 'border-hairline-strong bg-canvas'
            } ${disabled ? 'cursor-not-allowed opacity-60' : checked ? '' : 'hover:bg-surface-1'}`}
          >
            <span
              aria-hidden="true"
              className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 ${checked ? 'border-accent' : 'border-hairline-strong'}`}
            >
              {checked && <span className="h-2 w-2 rounded-full bg-accent" />}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-ink">{r.roleName}</span>
              <span className="block text-xs text-ink-muted">{roleDescription(r.roleName)}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default RoleCards;
