import React, { useEffect, useState } from 'react';
import axiosInstance from '../../api/axiosInstance';
import { History, ShieldCheck, User, Calendar, Activity, Download, Search } from 'lucide-react';
import Pagination from '../../components/Pagination';
import type { PaginatedResponse } from '../../models';
import { toast } from 'react-toastify';

interface AuditEntry {
  userName: string;
  action: string;
  entityName: string;
  timestamp: string;
}

const AuditLog: React.FC = () => {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(limit) });
      if (search) params.set('search', search);
      const response = await axiosInstance.get<PaginatedResponse<AuditEntry>>(`/Report/audit-logs?${params}`);
      setLogs(response.data.data);
      setTotal(response.data.total);
    } catch (err) {
      console.error("Failed to fetch audit logs");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const response = await axiosInstance.get(`/Report/audit-logs/export?${params}`, { responseType: 'blob' });
      const href = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = href;
      a.download = 'audit-logs.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(href);
    } catch {
      toast.error('Failed to export audit logs.');
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => { fetchLogs(); }, [page, search]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="page-title flex items-center gap-2">
            <History className="text-ink-subtle" /> System Audit Trail
          </h2>
          <p className="caption text-left">Immutable record of all system modifications and access</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="input pl-9 pr-3 w-52"
            />
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="btn btn-secondary"
          >
            <Download size={16} />
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
          <div className="chip chip-neutral px-3 py-1.5">
            <ShieldCheck size={18} />
            Compliance Active
          </div>
        </div>
      </div>

      <div className="card overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th className="whitespace-nowrap">Timestamp</th>
                <th className="whitespace-nowrap">Operator</th>
                <th className="whitespace-nowrap">Action</th>
                <th className="whitespace-nowrap">Target Entity</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="empty-state">
                    <div className="flex flex-col items-center gap-2">
                      <Activity className="animate-pulse text-ink-subtle" />
                      <span>Analyzing audit trail...</span>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={4} className="empty-state italic">No activity logs recorded yet.</td></tr>
              ) : (
                logs.map((log, index) => (
                  <tr key={index}>
                    <td className="text-ink-muted font-mono whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-ink-subtle" />
                        {new Date(log.timestamp).toLocaleString()}
                      </div>
                    </td>
                    <td className="whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="bg-surface-2 p-1.5 rounded-pill text-ink-muted">
                          <User size={14} />
                        </div>
                        <span className="font-medium text-ink text-sm">{log.userName}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap">
                      <span className={`chip ${
                        log.action.includes('Delete') ? 'chip-rejected' : 
                        log.action.includes('Create') ? 'chip-completed' : 
                        'chip-progress'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="whitespace-nowrap">
                      <span className="chip chip-neutral font-mono">
                        {log.entityName}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {!loading && totalPages > 1 && (
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={total}
            pageSize={limit}
            onPageChange={setPage}
          />
        )}
      </div>
    </div>
  );
};

export default AuditLog;