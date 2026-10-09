import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';
import EmptyState from '../../components/EmptyState';
import type { DashboardPermission, PaginatedResponse } from '../../models';
import KpiCards from '../dashboard/KpiCards';
import FiltersBar from '../dashboard/FiltersBar';
import OrgTotals from '../dashboard/OrgTotals';
import ExportMenu from '../dashboard/ExportMenu';
import DashboardSkeleton from '../dashboard/DashboardSkeleton';
import { AgingChart, CategoryChart, PriorityChart, StatusDonut, TrendChart, WorkloadChart } from '../dashboard/Charts';
import { RecentActivity, TopOverdueList, WorkflowPerformance, type ActivityEntry } from '../dashboard/Lists';
import { useDashboardData } from '../dashboard/useDashboardData';
import {
  formatClock, isEmptyDashboard, parseUrlState, resolveRange, serializeUrlState, toFilters,
  type DashboardUrlState,
} from '../dashboard/utils';

const Dashboard: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [today] = useState(() => new Date());
  const [exportError, setExportError] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[] | null>(null);

  const paramString = searchParams.toString();
  const state = useMemo(() => parseUrlState(new URLSearchParams(paramString)), [paramString]);
  const filters = useMemo(() => toFilters(state, today), [state, today]);
  const resolved = useMemo(() => resolveRange(state, today), [state, today]);

  const { data, loading, error, reload } = useDashboardData(filters);

  // What is shown comes from the server's permission list, never from the role name
  const can = (p: DashboardPermission) => Boolean(data?.permissions.includes(p));
  const canSeeActivity = can('activity');
  useEffect(() => {
    if (!canSeeActivity) return;
    let cancelled = false;
    axiosInstance
      .get<PaginatedResponse<ActivityEntry>>('/Report/audit-logs', { params: { page: 1, pageSize: 6 } })
      .then(res => { if (!cancelled) setActivity(res.data.data); })
      .catch(() => { /* optional panel: a failure must not break the dashboard */ });
    return () => { cancelled = true; };
  }, [canSeeActivity]);

  const onChange = useCallback((next: DashboardUrlState) => {
    setSearchParams(serializeUrlState(next), { replace: true });
  }, [setSearchParams]);

  const showWorkload = can('workload');

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <h1 className="sr-only">Dashboard</h1>

      <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
        <FiltersBar state={state} resolved={resolved} options={data?.options ?? null} hideAssignee={!can('assignee-filter')} onChange={onChange} />
        <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
          {data && <span className="caption tabular-nums">Updated {formatClock(data.generatedAt)}</span>}
          <button type="button" className="btn btn-secondary" onClick={reload} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
            Refresh
          </button>
          <ExportMenu filters={filters} data={data} canExportTasks={can('export-tasks')} onError={setExportError} />
        </div>
      </div>

      {exportError && <div className="alert alert-error" role="alert">{exportError}</div>}

      {error && (
        <div className="alert alert-error flex flex-wrap items-center justify-between gap-3" role="alert">
          <span>{error}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={reload}>Retry</button>
        </div>
      )}

      {!data ? (
        error ? null : <DashboardSkeleton />
      ) : (
        <div
          className={`space-y-4 transition-opacity duration-150 ${loading ? 'opacity-60' : ''}`}
          aria-busy={loading}
        >
          <KpiCards kpis={data.kpis} range={data.range} />

          {isEmptyDashboard(data) ? (
            <div className="card">
              <EmptyState
                illustration="empty"
                title="No tasks in this period"
                hint="Try a wider date range or clear the filters."
              />
            </div>
          ) : (
            <>
              {data.totals && <OrgTotals totals={data.totals} />}

              <TrendChart data={data} />

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <StatusDonut data={data} />
                <PriorityChart data={data} />
                <CategoryChart data={data} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className={showWorkload ? 'min-w-0' : 'lg:col-span-2 min-w-0'}>
                  <WorkflowPerformance rows={data.byWorkflow} />
                </div>
                {showWorkload && <WorkloadChart data={data} />}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                <AgingChart data={data} />
                <TopOverdueList rows={data.topOverdue} />
              </div>
            </>
          )}

          {canSeeActivity && activity && <RecentActivity rows={activity} />}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
