import React, { useEffect, useState } from 'react';
import axiosInstance from '../../api/axiosInstance';
import { History, ShieldCheck, User, Calendar, Activity } from 'lucide-react';

interface AuditEntry {
  userName: string;
  action: string;
  entityName: string;
  timestamp: string;
}

const AuditLog: React.FC = () => {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      const response = await axiosInstance.get<{ total: number; page: number; pageSize: number; data: AuditEntry[] }>('/Report/audit-logs');
      setLogs(response.data.data);
    } catch (err) {
      console.error("Failed to fetch audit logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <History className="text-blue-600" /> System Audit Trail
          </h2>
          <p className="text-sm text-gray-500 text-left">Immutable record of all system modifications and access</p>
        </div>
        <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg border border-blue-100 flex items-center gap-2 text-sm font-medium">
          <ShieldCheck size={18} />
          Compliance Active
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Timestamp</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Operator</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Action</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Target Entity</th>
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
                  <td className="px-6 py-4 text-sm text-gray-600 font-mono flex items-center gap-2">
                    <Calendar size={14} className="text-gray-400" />
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="bg-gray-100 p-1.5 rounded-full text-gray-600">
                        <User size={14} />
                      </div>
                      <span className="font-medium text-gray-900 text-sm">{log.userName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      log.action.includes('Delete') ? 'bg-red-50 text-red-700' : 
                      log.action.includes('Create') ? 'bg-green-50 text-green-700' : 
                      'bg-blue-50 text-blue-700'
                    }`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4">
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
    </div>
  );
};

export default AuditLog;