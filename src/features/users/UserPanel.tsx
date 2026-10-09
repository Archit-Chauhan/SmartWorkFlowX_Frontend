import React, { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, Loader2, RotateCcw, ShieldCheck, ShieldOff, X } from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';
import type { AdminUser, AdminUsersResponse, RoleOption } from '../../models';
import UserAvatar from '../../components/UserAvatar';
import { useDialogA11y } from '../../hooks/useDialogA11y';
import { DialogShell } from '../tasks/TaskDialogs';
import { RoleChip, StatusChip } from './Chips';
import RoleCards from './RoleCards';
import { apiMessage, formatAdded, plural } from './userUtils';

type Dialog = { kind: 'role'; roleId: number } | { kind: 'deactivate' } | { kind: 'restore' };

interface Props {
  user: AdminUser;
  roles: RoleOption[];
  /** The panel is about the signed-in Admin's own account. */
  isMe: boolean;
  /** Changes whenever the list is reloaded; the active-Admin count is asked again then. */
  version: unknown;
  onClose: () => void;
  /** A change went through: patch what the panel shows, say so in a toast and refetch the list. */
  onChanged: (patch: Partial<AdminUser>, message: string) => void;
}

const SELF_ROLE = 'You cannot change your own role.';
const LAST_ADMIN_ROLE = 'The last active Admin cannot be demoted.';
const SELF_DEACTIVATE = 'You cannot deactivate your own account.';
const LAST_ADMIN_DEACTIVATE = 'The last active Admin cannot be deactivated. Make someone else an Admin first.';

/** Right-hand drawer with everything about one user and the three things an Admin can do to them. */
const UserPanel: React.FC<Props> = ({ user, roles, isMe, version, onClose, onChanged }) => {
  const ref = useRef<HTMLElement>(null);
  const titleId = useId();
  const [draft, setDraft] = useState<number | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState('');
  // Escape belongs to the confirmation dialog while one is open on top of the panel.
  useDialogA11y(ref, onClose, busy || dialog !== null);

  // Is this the only active Admin? Asked with a tiny request; if it fails the server still enforces the rule.
  const adminRole = roles.find((r) => r.roleName === 'Admin');
  const adminRoleId = adminRole?.roleId;
  const checkAdmins = user.roleName === 'Admin' && !user.isDeleted && adminRoleId !== undefined;
  const [activeAdmins, setActiveAdmins] = useState<number | null>(null);
  useEffect(() => {
    if (!checkAdmins) return;
    let cancelled = false;
    axiosInstance
      .get<AdminUsersResponse>('/Admin/users', { params: { page: 1, limit: 1, status: 'active', roleId: adminRoleId } })
      .then((res) => { if (!cancelled) setActiveAdmins(res.data.total); })
      .catch(() => { if (!cancelled) setActiveAdmins(null); });
    return () => { cancelled = true; };
  }, [checkAdmins, adminRoleId, version]);
  const lastAdmin = checkAdmins && activeAdmins === 1;

  const roleLocked = isMe || lastAdmin;
  const selectedRole = draft ?? user.roleId;
  const selectedRoleName = roles.find((r) => r.roleId === selectedRole)?.roleName ?? '';
  const changed = !user.isDeleted && !roleLocked && draft !== null && draft !== user.roleId;
  const deactivateLocked = isMe || lastAdmin;
  const roleNote = isMe ? SELF_ROLE : lastAdmin ? LAST_ADMIN_ROLE : '';
  const deactivateNote = isMe ? SELF_DEACTIVATE : LAST_ADMIN_DEACTIVATE;
  const noteId = `${titleId}-note`;

  const run = async (request: () => Promise<unknown>, patch: Partial<AdminUser>, message: string) => {
    setBusy(true);
    setBanner('');
    try {
      await request();
      setDialog(null);
      setDraft(null);
      onChanged(patch, message);
    } catch (err) {
      setDialog(null);
      setBanner(apiMessage(err, 'Something went wrong. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const confirm = () => {
    if (!dialog) return;
    if (dialog.kind === 'role') {
      const role = roles.find((r) => r.roleId === dialog.roleId);
      return run(
        () => axiosInstance.put(`/Admin/users/${user.userId}/role`, { roleId: dialog.roleId }),
        { roleId: dialog.roleId, roleName: role?.roleName ?? user.roleName },
        `${user.name} is now ${role?.roleName ?? 'updated'}.`,
      );
    }
    if (dialog.kind === 'deactivate') {
      return run(() => axiosInstance.delete(`/Admin/users/${user.userId}`), { isDeleted: true }, `${user.name} deactivated.`);
    }
    return run(() => axiosInstance.put(`/Admin/users/${user.userId}/restore`), { isDeleted: false }, `${user.name} restored.`);
  };

  const cancelDialog = () => { if (!busy) setDialog(null); };

  const onDeactivateClick = () => {
    if (deactivateLocked) { setBanner(deactivateNote); return; }
    setBanner('');
    setDialog({ kind: 'deactivate' });
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-overlay" onMouseDown={() => { if (!busy && !dialog) onClose(); }} aria-hidden="true" />
      <aside
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[480px] flex-col border-l border-hairline bg-canvas shadow-2xl"
      >
        <div className="flex items-center justify-between gap-2 border-b border-hairline px-4 py-2.5">
          <span className="caption">User #{user.userId}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} data-autofocus>
            <X size={16} aria-hidden="true" /> Close
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {banner && (
            <div role="alert" className="alert alert-error flex items-start gap-2">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{banner}</span>
            </div>
          )}

          <section className="flex items-center gap-3">
            <UserAvatar seed={user.name} size={56} />
            <div className="min-w-0">
              <h2 id={titleId} className="section-title break-words">
                {user.name}
                {isMe && <span className="caption ml-1.5 font-normal">(you)</span>}
              </h2>
              <p className="break-all text-sm text-ink-muted">{user.email}</p>
            </div>
          </section>

          <section aria-label="Details">
            <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-subtle">Details</h3>
            <dl className="grid grid-cols-[110px_1fr] items-center gap-y-2 text-sm">
              <dt className="text-ink-muted">Status</dt>
              <dd><StatusChip deactivated={user.isDeleted} /></dd>
              <dt className="text-ink-muted">Role</dt>
              <dd><RoleChip roleName={user.roleName} /></dd>
              <dt className="text-ink-muted">Open tasks</dt>
              <dd className="tabular-nums">{user.openTaskCount}</dd>
              <dt className="text-ink-muted">Added</dt>
              <dd>{formatAdded(user.createdAt)}</dd>
            </dl>
          </section>

          {user.isDeleted ? (
            <p className="alert alert-info flex items-start gap-2 !text-ink">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
              <span>This person cannot sign in. Their {plural(user.openTaskCount, 'open task')} {user.openTaskCount === 1 ? 'stays' : 'stay'} assigned to them until someone restores them.</span>
            </p>
          ) : (
            <section aria-label="Change role">
              <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-subtle">Change role</h3>
              {roleNote && <p id={noteId} className="caption mb-2">{roleNote}</p>}
              <RoleCards
                idPrefix={`${titleId}-role`.replace(/:/g, '')}
                roles={roles}
                value={selectedRole}
                onChange={setDraft}
                disabled={roleLocked}
                describedBy={roleNote ? noteId : undefined}
              />
              {changed && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => { setBanner(''); setDialog({ kind: 'role', roleId: selectedRole }); }}>
                    Change role to {selectedRoleName}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDraft(null)}>Cancel</button>
                </div>
              )}
            </section>
          )}
        </div>

        <div className="border-t border-hairline bg-canvas px-4 py-3">
          {user.isDeleted ? (
            <button type="button" className="btn btn-primary" onClick={() => { setBanner(''); setDialog({ kind: 'restore' }); }}>
              <RotateCcw size={16} aria-hidden="true" /> Restore user
            </button>
          ) : (
            <>
              <button
                type="button"
                className={`btn btn-secondary text-error ${deactivateLocked ? 'cursor-not-allowed opacity-60' : ''}`}
                aria-disabled={deactivateLocked || undefined}
                aria-describedby={deactivateLocked ? `${noteId}-d` : undefined}
                onClick={onDeactivateClick}
              >
                <ShieldOff size={16} aria-hidden="true" /> Deactivate user
              </button>
              {deactivateLocked && <p id={`${noteId}-d`} className="caption mt-2">{deactivateNote}</p>}
            </>
          )}
        </div>
      </aside>

      {dialog?.kind === 'role' && (
        <DialogShell
          tone="accent"
          icon={<ShieldCheck size={20} />}
          title={`Change ${user.name}’s role?`}
          description={user.email}
          busy={busy}
          onClose={cancelDialog}
          footer={
            <>
              <button type="button" className="btn btn-secondary" onClick={cancelDialog} disabled={busy}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={confirm} disabled={busy} data-autofocus>
                {busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                {busy ? 'Saving...' : 'Yes, change role'}
              </button>
            </>
          }
        >
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
            <li>{user.roleName} {'→'} <strong className="text-ink">{roles.find((r) => r.roleId === dialog.roleId)?.roleName}</strong>.</li>
            <li>Anyone already signed in keeps the old role until their session ends or they sign in again.</li>
            <li>This is recorded in the audit log.</li>
          </ul>
        </DialogShell>
      )}

      {dialog?.kind === 'deactivate' && (
        <DialogShell
          tone="danger"
          icon={<ShieldOff size={20} />}
          title={`Deactivate ${user.name}?`}
          description={user.email}
          busy={busy}
          onClose={cancelDialog}
          footer={
            <>
              <button type="button" className="btn btn-secondary" onClick={cancelDialog} disabled={busy}>Cancel</button>
              <button type="button" className="btn btn-danger" onClick={confirm} disabled={busy} data-autofocus>
                {busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                {busy ? 'Deactivating...' : 'Yes, deactivate'}
              </button>
            </>
          }
        >
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
            <li>They can no longer sign in.</li>
            <li>
              {user.openTaskCount > 0
                ? <><strong className="text-ink">{plural(user.openTaskCount, 'open task')}</strong> {user.openTaskCount === 1 ? 'stays' : 'stay'} assigned to them. Reassign or finish them first if work is waiting.</>
                : 'They have no open tasks.'}
            </li>
            <li>You can restore them at any time.</li>
          </ul>
        </DialogShell>
      )}

      {dialog?.kind === 'restore' && (
        <DialogShell
          tone="accent"
          icon={<RotateCcw size={20} />}
          title={`Restore ${user.name}?`}
          description={user.email}
          busy={busy}
          onClose={cancelDialog}
          footer={
            <>
              <button type="button" className="btn btn-secondary" onClick={cancelDialog} disabled={busy}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={confirm} disabled={busy} data-autofocus>
                {busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                {busy ? 'Restoring...' : 'Yes, restore'}
              </button>
            </>
          }
        >
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
            <li>They can sign in again straight away.</li>
            <li>Their role stays {user.roleName}.</li>
            {user.openTaskCount > 0 && <li>Their {plural(user.openTaskCount, 'open task')} are still assigned to them.</li>}
          </ul>
        </DialogShell>
      )}
    </>
  );
};

export default UserPanel;
