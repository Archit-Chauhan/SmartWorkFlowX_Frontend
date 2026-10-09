import React from 'react';
import { GitBranch, Users } from 'lucide-react';
import type { OrgTotals as OrgTotalsData } from '../../models/Dashboard';

/** Organisation-wide totals. Shown only when the server grants the 'org-totals' permission (Admin, Manager). */
const OrgTotals: React.FC<{ totals: OrgTotalsData }> = ({ totals }) => (
  <section className="card px-5 py-3" aria-label="Organisation totals">
    <dl className="flex flex-wrap items-center gap-x-8 gap-y-2">
      <div className="flex items-center gap-2">
        <Users size={16} className="text-ink-subtle" aria-hidden="true" />
        <dt className="caption">Users</dt>
        <dd className="text-sm font-semibold text-ink tabular-nums">{totals.users}</dd>
      </div>
      <div className="flex items-center gap-2">
        <GitBranch size={16} className="text-ink-subtle" aria-hidden="true" />
        <dt className="caption">Workflows</dt>
        <dd className="text-sm font-semibold text-ink tabular-nums">{totals.workflows}</dd>
        <dd className="caption">({totals.activeWorkflows} active)</dd>
      </div>
    </dl>
  </section>
);

export default OrgTotals;
