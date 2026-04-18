import React, { useEffect, useState } from 'react';
import axiosInstance from '../api/axiosInstance';
import { BellRing, Check } from 'lucide-react';

const NotificationList: React.FC = () => {
  const [notifications, setNotifications] = useState<any[]>([]);

  const fetchNotes = async () => {
    const res = await axiosInstance.get('/Notification'); // You'll need this GET on C#
    setNotifications(res.data);
  };

  const markRead = async (id: number) => {
    await axiosInstance.post(`/Notification/${id}/read`);
    fetchNotes();
  };

  useEffect(() => { fetchNotes(); }, []);

  return (
    <div className="w-80 bg-white border border-gray-200 rounded-xl shadow-xl absolute right-0 mt-2 z-50">
      <div className="p-4 border-b font-bold flex justify-between items-center">
        <span>Recent Alerts</span>
        <BellRing size={16} className="text-blue-600" />
      </div>
      <div className="max-h-64 overflow-y-auto">
        {notifications.map(n => (
          <div key={n.notificationId} className={`p-4 border-b last:border-0 flex gap-3 ${n.isRead ? 'opacity-50' : 'bg-blue-50'}`}>
            <div className="flex-1 text-sm">{n.message}</div>
            {!n.isRead && (
              <button onClick={() => markRead(n.notificationId)} className="text-blue-600 hover:bg-blue-100 p-1 rounded">
                <Check size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default NotificationList;