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
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <History className="text-blue-600" /> System Audit Trail
          </h2>
          <p className="text-sm text-gray-500 text-left">Immutable record of all system modifications and access</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none w-52"
            />
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-all text-sm font-medium disabled:opacity-50"
          >
            <Download size={16} />
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
          <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg border border-blue-100 flex items-center gap-2 text-sm font-medium">
            <ShieldCheck size={18} />
            Compliance Active
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase whitespace-nowrap">Timestamp</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase whitespace-nowrap">Operator</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase whitespace-nowrap">Action</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase whitespace-nowrap">Target Entity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <Activity className="animate-pulse text-blue-400" />
                      <span>Analyzing audit trail...</span>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={4} className="p-10 text-center text-gray-400 italic">No activity logs recorded yet.</td></tr>
              ) : (
                logs.map((log, index) => (
                  <tr key={index} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-600 font-mono flex items-center gap-2 whitespace-nowrap">
                      <Calendar size={14} className="text-gray-400" />
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="bg-gray-100 p-1.5 rounded-full text-gray-600">
                          <User size={14} />
                        </div>
                        <span className="font-medium text-gray-900 text-sm">{log.userName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        log.action.includes('Delete') ? 'bg-red-50 text-red-700' : 
                        log.action.includes('Create') ? 'bg-green-50 text-green-700' : 
                        'bg-blue-50 text-blue-700'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-xs text-gray-500 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded">
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