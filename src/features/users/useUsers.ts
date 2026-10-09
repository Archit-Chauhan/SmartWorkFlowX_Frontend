import { useCallback, useEffect, useRef, useState } from 'react';
import axiosInstance from '../../api/axiosInstance';
import type { AdminUsersResponse } from '../../models';
import { toApiParams } from './usersState';
import type { UsersState } from './usersState';

interface Settled {
  key: string | null;
  data: AdminUsersResponse | null;
  failed: boolean;
}

export interface UsersData {
  /** Last successful answer. Stays available while the next one loads, so the table does not flash. */
  data: AdminUsersResponse | null;
  /** True while a different view (filters, sort, page) is loading. A quiet reload does not count. */
  loading: boolean;
  failed: boolean;
  /** Fetch the same view again without blanking or dimming the table. */
  reload: () => void;
}

/** Asks the server for the current view. Out-of-order answers are dropped (request id guard). */
export function useUsers(state: UsersState): UsersData {
  const key = JSON.stringify(toApiParams(state));
  const [nonce, setNonce] = useState(0);
  const [settled, setSettled] = useState<Settled>({ key: null, data: null, failed: false });
  const requestId = useRef(0);

  useEffect(() => {
    const id = ++requestId.current;
    axiosInstance
      .get<AdminUsersResponse>('/Admin/users', { params: JSON.parse(key) })
      .then((res) => {
        if (id === requestId.current) setSettled({ key, data: res.data, failed: false });
      })
      .catch(() => {
        if (id === requestId.current) setSettled((prev) => ({ key, data: prev.data, failed: true }));
      });
  }, [key, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const loading = settled.key !== key;
  return { data: settled.data, loading, failed: !loading && settled.failed, reload };
}
