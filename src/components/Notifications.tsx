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
    <div className="relative cursor-pointer hover:bg-gray-100 p-2 rounded-full transition-colors">
      <Bell size={20} className="text-gray-600" />
      {count > 0 && (
        <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full border-2 border-white">
          {count}
        </span>
      )}
    </div>
  );
};

export default Notifications;