import React, { useEffect, useState } from 'react';
import axiosInstance from '../api/axiosInstance';
import { Bell } from 'lucide-react';

const Notifications: React.FC = () => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const fetchNotifications = async () => {
      // Assuming a GET /Notification endpoint exists or can be added
      const res = await axiosInstance.get('/Notification/unread-count');
      setCount(res.data.count);
    };
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative cursor-pointer hover:bg-surface-1 p-2 rounded-control transition-colors">
      <Bell size={20} className="text-ink-muted" />
      {count > 0 && (
        <span className="absolute top-0 right-0 bg-error text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-pill border-2 border-canvas">
          {count}
        </span>
      )}
    </div>
  );
};

export default Notifications;