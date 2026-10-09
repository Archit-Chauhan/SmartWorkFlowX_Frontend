import { useCallback, useEffect, useRef, useState } from 'react';
import axiosInstance from '../../api/axiosInstance';
import type { AllTasksResponse } from '../../models';
import { toApiParams } from './allTasksState';
import type { AllTasksState } from './allTasksState';

interface Settled {
  key: string | null;
  nonce: number;
  data: AllTasksResponse | null;
  failed: boolean;
}

export interface AllTasksData {
  /** Last successful answer. Stays available while the next one loads, so the table does not flash. */
  data: AllTasksResponse | null;
  loading: boolean;
  failed: boolean;
  reload: () => void;
}

/**
 * Asks the server for the current view (filters, sort, page). Out-of-order answers are dropped.
 * `loading` is derived (what was asked vs what has settled), so no state is set inside the effect.
 */
export function useAllTasks(state: AllTasksState): AllTasksData {
  const key = JSON.stringify(toApiParams(state));
  const [nonce, setNonce] = useState(0);
  const [settled, setSettled] = useState<Settled>({ key: null, nonce: -1, data: null, failed: false });
  const requestId = useRef(0);

  useEffect(() => {
    const id = ++requestId.current;
    axiosInstance
      .get<AllTasksResponse>('/Task/all', { params: JSON.parse(key) })
      .then((res) => {
        if (id === requestId.current) setSettled({ key, nonce, data: res.data, failed: false });
      })
      .catch(() => {
        if (id === requestId.current) setSettled((prev) => ({ key, nonce, data: prev.data, failed: true }));
      });
  }, [key, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const loading = settled.key !== key || settled.nonce !== nonce;
  return { data: settled.data, loading, failed: !loading && settled.failed, reload };
}
