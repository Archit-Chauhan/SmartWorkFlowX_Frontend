import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download } from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';
import type { DashboardFilters, DashboardResponse } from '../../models/Dashboard';
import { buildSummaryCsv, tasksExportFileName, toQueryParams } from './utils';

interface ExportMenuProps {
  filters: DashboardFilters;
  data: DashboardResponse | null;
  /** From the server's permission list. Without it only the on-screen summary can be exported. */
  canExportTasks: boolean;
  onError: (message: string | null) => void;
}

function saveBlob(blob: Blob, fileName: string): void {
  const href = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(href);
}

const ExportMenu: React.FC<ExportMenuProps> = ({ filters, data, canExportTasks, onError }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const exportTasks = async () => {
    setOpen(false);
    setBusy(true);
    onError(null);
    try {
      const res = await axiosInstance.get('/Report/dashboard/export', {
        params: toQueryParams(filters),
        responseType: 'blob',
      });
      saveBlob(new Blob([res.data], { type: 'text/csv;charset=utf-8' }), tasksExportFileName(filters.from, filters.to));
    } catch {
      onError('Could not export the task list. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const exportSummary = () => {
    setOpen(false);
    if (!data) return;
    onError(null);
    try {
      saveBlob(new Blob([buildSummaryCsv(data)], { type: 'text/csv;charset=utf-8' }), `summary-${data.range.from}_${data.range.to}.csv`);
    } catch {
      onError('Could not build the summary file.');
    }
  };

  const itemClass = 'flex w-full items-center h-control px-3 text-sm text-ink text-left hover:bg-surface-1 disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className="relative" ref={rootRef}>
      <button ref={buttonRef} type="button" className="btn btn-secondary" aria-haspopup="menu" aria-expanded={open}
        disabled={busy} onClick={() => setOpen(o => !o)}>
        <Download size={16} aria-hidden="true" />
        {busy ? 'Exporting...' : 'Export'}
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" aria-label="Export" className="absolute right-0 z-20 mt-1 min-w-44 bg-canvas border border-hairline rounded-card shadow-lg py-1">
          {canExportTasks && (
            <button type="button" role="menuitem" className={itemClass} onClick={exportTasks}>Tasks (CSV)</button>
          )}
          <button type="button" role="menuitem" className={itemClass} disabled={!data} onClick={exportSummary}>Summary (CSV)</button>
        </div>
      )}
    </div>
  );
};

export default ExportMenu;
