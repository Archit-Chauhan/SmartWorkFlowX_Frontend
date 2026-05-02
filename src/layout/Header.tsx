import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, Bell, CheckCheck, Menu } from 'lucide-react';
import { useNotificationHub } from '../hooks/useNotificationHub';
import axiosInstance from '../api/axiosInstance';
import type { Notification, NotificationPaginatedResponse } from '../models';

interface HeaderProps {
  onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { user, role, logout } = useAuth();
  const { unreadCount, clearUnread } = useNotificationHub();

  const [showBell, setShowBell] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const bellRef = useRef<HTMLDivElement>(null);

  // Load notifications when bell opens
  const openBell = async () => {
    if (!showBell) {
      try {
        const res = await axiosInstance.get<NotificationPaginatedResponse>('/Notification?page=1&pageSize=10');
        setNotifications(res.data.data);
      } catch { /* silent */ }
    }
    setShowBell(prev => !prev);
    clearUnread();
  };

  const markAllRead = async () => {
    await axiosInstance.put('/Notification/read-all');
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node))
        setShowBell(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4 sm:px-6 shrink-0">
      <div className="flex items-center gap-3">
        <button 
          onClick={onMenuClick}
          className="md:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Menu size={24} />
        </button>
        <h1 className="text-xl font-semibold text-gray-800 hidden sm:block">SmartWorkFlowX</h1>
        <h1 className="text-xl font-semibold text-gray-800 sm:hidden">SWFX</h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {/* ── Notification Bell ── */}
        <div ref={bellRef} className="relative">
          <button
            onClick={openBell}
            className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            title="Notifications"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showBell && (
            <div className="absolute right-0 top-12 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <span className="font-semibold text-gray-800 text-sm">Notifications</span>
                {notifications.some(n => !n.isRead) && (
                  <button
                    onClick={markAllRead}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    <CheckCheck size={13} /> Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
                {notifications.length === 0 ? (
                  <p className="text-center text-gray-400 text-sm py-8">No notifications yet.</p>
                ) : notifications.map(n => (
                  <div
                    key={n.notificationId}
                    className={`px-4 py-3 text-sm ${n.isRead ? 'bg-white' : 'bg-blue-50'}`}
                  >
                    <p className={`text-gray-700 leading-snug ${!n.isRead ? 'font-medium' : ''}`}>
                      {n.message}
                    </p>
                    <p className="text-gray-400 text-xs mt-1">
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="h-6 w-px bg-gray-200" />

        {/* User Info */}
        <div className="flex flex-col text-right hidden sm:flex">
          <span className="text-sm font-medium text-gray-900">{user?.email}</span>
          <span className="text-xs text-blue-600 font-bold uppercase tracking-wider">{role}</span>
        </div>

        <div className="h-6 w-px bg-gray-200 hidden sm:block" />

        <button
          onClick={logout}
          className="flex items-center gap-2 text-gray-500 hover:text-red-600 transition-colors"
          title="Logout"
        >
          <LogOut size={20} />
          <span className="text-sm font-medium hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
};

export default Header;