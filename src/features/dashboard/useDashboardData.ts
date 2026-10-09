import { useCallback, useEffect, useRef, useState } from 'react';
import axiosInstance from '../../api/axiosInstance';
import type { DashboardFilters, DashboardResponse } from '../../models/Dashboard';
import { toQueryParams } from './utils';

interface Settled {
  /** The request this result belongs to. */
  filters: DashboardFilters | null;
  nonce: number;
  data: DashboardResponse | null;
  error: string | null;
}

export interface DashboardData {
  data: DashboardResponse | null;
  /** True while a request for the current filters is in flight (previous data stays available). */
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Fetches the dashboard whenever the filters change. `loading` is derived (settled request vs wanted
 * request), so no state is set synchronously in the effect, and stale responses are discarded.
 */
export function useDashboardData(filters: DashboardFilters): DashboardData {
  const [nonce, setNonce] = useState(0);
  const [settled, setSettled] = useState<Settled>({ filters: null, nonce: -1, data: null, error: null });
  const requestId = useRef(0);

  useEffect(() => {
    const id = ++requestId.current;
    axiosInstance
      .get<DashboardResponse>('/Report/dashboard', { params: toQueryParams(filters) })
      .then(res => {
        if (id === requestId.current) setSettled({ filters, nonce, data: res.data, error: null });
      })
      .catch(() => {
        if (id === requestId.current) {
          setSettled(prev => ({ filters, nonce, data: prev.data, error: 'Could not load the dashboard.' }));
        }
      });
  }, [filters, nonce]);

  const reload = useCallback(() => setNonce(n => n + 1), []);
  const loading = settled.filters !== filters || settled.nonce !== nonce;
  return { data: settled.data, loading, error: loading ? null : settled.error, reload };
}
