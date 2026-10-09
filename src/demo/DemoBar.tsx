import React from 'react';

const ROLES = ['Admin', 'Manager', 'Employee', 'Auditor'] as const;
const EMAILS: Record<string, string> = {
  Admin: 'admin@swfx.demo', Manager: 'manager@swfx.demo', Employee: 'employee@swfx.demo', Auditor: 'auditor@swfx.demo',
};

const read = (k: string, fallback: string) => { try { return localStorage.getItem(k) || fallback; } catch { return fallback; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

/** Floating preview-only control: switch role and toggle empty data to review every screen and state. */
const DemoBar: React.FC = () => {
  const role = read('role', 'Admin');
  const data = read('swfx-demo-data', 'full');
  const signedIn = !!read('token', '');

  const switchRole = (next: string) => {
    write('token', 'demo-token'); write('role', next); write('email', EMAILS[next]);
    window.location.assign('/');
  };
  const switchData = (next: string) => { write('swfx-demo-data', next); window.location.reload(); };

  return (
    <div
      role="region"
      aria-label="Demo controls"
      className="fixed bottom-3 right-3 z-[35] flex flex-wrap items-center gap-2 rounded-card border border-hairline-strong bg-canvas px-3 py-2 text-xs text-ink shadow-xl"
    >
      <span className="rounded-control bg-accent px-1.5 py-0.5 font-semibold text-on-accent">DEMO</span>
      <label className="flex items-center gap-1">
        <span className="text-ink-muted">Role</span>
        <select
          className="rounded-control border border-hairline bg-surface-1 px-1.5 py-1 text-ink"
          value={signedIn ? role : ''}
          onChange={e => switchRole(e.target.value)}
        >
          {!signedIn && <option value="" disabled>Signed out</option>}
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </label>
      <label className="flex items-center gap-1">
        <span className="text-ink-muted">Data</span>
        <select
          className="rounded-control border border-hairline bg-surface-1 px-1.5 py-1 text-ink"
          value={data}
          onChange={e => switchData(e.target.value)}
        >
          <option value="full">Sample data</option>
          <option value="empty">Empty</option>
        </select>
      </label>
    </div>
  );
};

export default DemoBar;
