import React, { useEffect, useState } from 'react';
import axiosInstance from '../../api/axiosInstance';
import { Send, AlertCircle, Users } from 'lucide-react';

interface Role {
  roleId: number;
  roleName: string;
}

const BroadcastNotification: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [targetRoleId, setTargetRoleId] = useState<number | ''>('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const res = await axiosInstance.get<Role[]>('/Admin/roles');
        setRoles(res.data);
      } catch (err) {
        console.error('Failed to load roles', err);
      }
    };
    fetchRoles();
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setLoading(true);
    setStatus(null);

    try {
      await axiosInstance.post('/Notification/broadcast', {
        roleId: targetRoleId === '' ? null : targetRoleId,
        message: message.trim()
      });
      
      setStatus({ type: 'success', text: 'Broadcast notification queued successfully. Users will receive it shortly via Azure Service Bus.' });
      setMessage('');
    } catch (err: any) {
      setStatus({ 
        type: 'error', 
        text: err.response?.data?.message || 'Failed to send broadcast notification.' 
      });
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Send className="text-blue-600" />
          Broadcast Notification
        </h2>
        <p className="text-gray-500 mt-1">
          Send a bulk notification to specific user roles asynchronously via Azure Service Bus.
        </p>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <form onSubmit={handleSend} className="space-y-6">
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Users size={16} /> Target Audience
            </label>
            <select
              className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-200 outline-none bg-white"
              value={targetRoleId}
              onChange={(e) => setTargetRoleId(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <option value="">All Users (System-wide)</option>
              {roles.map((r) => (
                <option key={r.roleId} value={r.roleId}>
                  Only {r.roleName}s
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <AlertCircle size={16} /> Message Content
            </label>
            <textarea
              className="w-full p-3 border border-gray-200 rounded-lg resize-none h-32 focus:ring-2 focus:ring-blue-200 outline-none"
              placeholder="Enter your message here..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
            />
          </div>

          {status && (
            <div className={`p-4 rounded-lg text-sm font-medium ${
              status.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {status.text}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !message.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading ? 'Sending to Queue...' : 'Broadcast Notification'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default BroadcastNotification;
