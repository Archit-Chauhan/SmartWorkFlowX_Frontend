import React, { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, Copy, Eye, EyeOff, KeyRound, Loader2, UserPlus, X } from 'lucide-react';
import { toast } from 'react-toastify';
import axiosInstance from '../../api/axiosInstance';
import type { RoleOption } from '../../models';
import { useDialogA11y } from '../../hooks/useDialogA11y';
import RoleCards from './RoleCards';
import { INVITE_FIELD_ORDER, apiMessage, generatePassword, validateInvite } from './userUtils';
import type { InviteErrors, InviteValues } from './userUtils';

interface Props {
  roles: RoleOption[];
  /** The list of roles could not be loaded: offer a retry instead of an empty picker. */
  rolesFailed: boolean;
  onRetryRoles: () => void;
  onClose: () => void;
  /** The user was created. */
  onCreated: (email: string) => void;
}

const FieldError: React.FC<{ id: string; message?: string }> = ({ id, message }) =>
  message ? (
    <p id={id} role="alert" className="mt-1 flex items-center gap-1 text-xs text-error">
      <AlertTriangle size={12} aria-hidden="true" /> {message}
    </p>
  ) : null;

/** Right-hand drawer to create a user with a temporary password. */
const InviteDrawer: React.FC<Props> = ({ roles, rolesFailed, onRetryRoles, onClose, onCreated }) => {
  const ref = useRef<HTMLElement>(null);
  const titleId = useId();
  const [busy, setBusy] = useState(false);
  useDialogA11y(ref, onClose, busy);

  const [values, setValues] = useState<InviteValues>({ name: '', email: '', password: '', roleId: null });
  const [errors, setErrors] = useState<InviteErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [banner, setBanner] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  const roleGroupRef = useRef<HTMLDivElement>(null);

  // Employee is the sensible default until the Admin picks something else.
  const defaultRoleId = (roles.find((r) => r.roleName === 'Employee') ?? roles[0])?.roleId ?? null;
  const roleId = values.roleId ?? defaultRoleId;

  useEffect(() => { if (banner) bannerRef.current?.focus(); }, [banner]);

  const ids = { name: `${titleId}-name`, email: `${titleId}-email`, password: `${titleId}-password`, roleId: `${titleId}-role` };
  const set = <K extends keyof InviteValues>(key: K, value: InviteValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const focusField = (key: keyof InviteValues) => {
    if (key === 'name') nameRef.current?.focus();
    else if (key === 'email') emailRef.current?.focus();
    else if (key === 'password') passwordRef.current?.focus();
    else roleGroupRef.current?.querySelector<HTMLElement>('[role="radio"]')?.focus();
  };

  const generate = () => {
    set('password', generatePassword());
    setShowPassword(true);
  };

  const copy = async () => {
    if (!values.password) return;
    try {
      await navigator.clipboard.writeText(values.password);
      toast.success('Password copied.');
      return;
    } catch {
      /* fall through to the old way */
    }
    try {
      const input = passwordRef.current;
      if (input) {
        const was = input.type;
        input.type = 'text';
        input.select();
        const ok = document.execCommand('copy');
        input.type = was;
        input.setSelectionRange(0, 0);
        if (ok) { toast.success('Password copied.'); return; }
      }
    } catch {
      /* ignore */
    }
    toast.error('Could not copy. Select the password and copy it by hand.');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBanner('');
    const found = validateInvite({ ...values, roleId });
    setErrors(found);
    const first = INVITE_FIELD_ORDER.find((k) => found[k]);
    if (first) { focusField(first); return; }

    setBusy(true);
    const email = values.email.trim().toLowerCase();
    try {
      await axiosInstance.post('/Admin/users', {
        name: values.name.trim(),
        email,
        password: values.password,
        roleId,
      });
      onCreated(email);
    } catch (err) {
      setBanner(apiMessage(err, 'We could not create the user. Please try again.'));
      setBusy(false);
    }
  };

  const invalid = (k: keyof InviteValues) => (errors[k] ? true : undefined);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-overlay" onMouseDown={() => { if (!busy) onClose(); }} aria-hidden="true" />
      <aside
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[520px] flex-col border-l border-hairline bg-canvas shadow-2xl"
      >
        <div className="flex items-center justify-between gap-2 border-b border-hairline px-4 py-2.5">
          <h2 id={titleId} className="section-title">Invite a user</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy}>
            <X size={16} aria-hidden="true" /> Close
          </button>
        </div>

        <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
            {banner && (
              <div ref={bannerRef} tabIndex={-1} role="alert" className="alert alert-error flex items-start gap-2">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>{banner}</span>
              </div>
            )}

            <div>
              <label htmlFor={ids.name} className="label">Full name <span className="text-error" aria-hidden="true">*</span></label>
              <input
                id={ids.name}
                ref={nameRef}
                data-autofocus
                className={`input ${errors.name ? 'input-error' : ''}`}
                autoComplete="off"
                value={values.name}
                aria-invalid={invalid('name')}
                aria-describedby={errors.name ? `${ids.name}-err` : undefined}
                onChange={(e) => set('name', e.target.value)}
              />
              <FieldError id={`${ids.name}-err`} message={errors.name} />
            </div>

            <div>
              <label htmlFor={ids.email} className="label">Email <span className="text-error" aria-hidden="true">*</span></label>
              <input
                id={ids.email}
                ref={emailRef}
                type="email"
                className={`input ${errors.email ? 'input-error' : ''}`}
                autoComplete="off"
                value={values.email}
                aria-invalid={invalid('email')}
                aria-describedby={errors.email ? `${ids.email}-err` : undefined}
                onChange={(e) => set('email', e.target.value)}
              />
              <FieldError id={`${ids.email}-err`} message={errors.email} />
            </div>

            <div>
              <span className="label" id={`${ids.roleId}-label`}>Role <span className="text-error" aria-hidden="true">*</span></span>
              {roles.length > 0 ? (
                <div ref={roleGroupRef}>
                  <RoleCards
                    idPrefix={ids.roleId.replace(/:/g, '')}
                    roles={roles}
                    value={roleId}
                    onChange={(id) => set('roleId', id)}
                    invalid={!!errors.roleId}
                    describedBy={errors.roleId ? `${ids.roleId}-err` : undefined}
                  />
                </div>
              ) : (
                <div className="alert alert-error flex flex-wrap items-center gap-2" role={rolesFailed ? 'alert' : undefined}>
                  <span>{rolesFailed ? 'The roles could not be loaded.' : 'Loading roles...'}</span>
                  {rolesFailed && <button type="button" className="btn btn-secondary btn-sm" onClick={onRetryRoles}>Try again</button>}
                </div>
              )}
              <FieldError id={`${ids.roleId}-err`} message={errors.roleId} />
            </div>

            <div>
              <label htmlFor={ids.password} className="label">Temporary password <span className="text-error" aria-hidden="true">*</span></label>
              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <input
                    id={ids.password}
                    ref={passwordRef}
                    type={showPassword ? 'text' : 'password'}
                    className={`input pr-10 font-mono ${errors.password ? 'input-error' : ''}`}
                    autoComplete="new-password"
                    spellCheck={false}
                    value={values.password}
                    aria-invalid={invalid('password')}
                    aria-describedby={`${ids.password}-hint${errors.password ? ` ${ids.password}-err` : ''}`}
                    onChange={(e) => set('password', e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-control text-ink-muted hover:text-ink"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((s) => !s)}
                  >
                    {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                  </button>
                </div>
                <button type="button" className="btn btn-secondary" onClick={generate}>
                  <KeyRound size={16} aria-hidden="true" /> Generate
                </button>
                <button type="button" className="btn btn-secondary" onClick={copy} disabled={!values.password}>
                  <Copy size={16} aria-hidden="true" /> Copy
                </button>
              </div>
              <FieldError id={`${ids.password}-err`} message={errors.password} />
              <p id={`${ids.password}-hint`} className="caption mt-1">At least 8 characters. Share it with the person yourself; they can change it after signing in.</p>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-hairline bg-canvas px-4 py-3">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <UserPlus size={16} aria-hidden="true" />}
              {busy ? 'Creating...' : 'Create user'}
            </button>
          </div>
        </form>
      </aside>
    </>
  );
};

export default InviteDrawer;
