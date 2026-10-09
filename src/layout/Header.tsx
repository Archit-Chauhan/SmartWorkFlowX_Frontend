import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, Bell, CheckCheck, Menu, KeyRound } from 'lucide-react';
import { useNotificationHub } from '../hooks/useNotificationHub';
import axiosInstance from '../api/axiosInstance';
import type { Notification, NotificationPaginatedResponse } from '../models';
import ChangePasswordModal from '../components/ChangePasswordModal';
import ThemeToggle from '../components/ThemeToggle';

interface HeaderProps {
  onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { user, role, logout } = useAuth();
  const { unreadCount, clearUnread } = useNotificationHub();

  const [showBell, setShowBell] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showChangePassword, setShowChangePassword] = useState(false);
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
    <header className="bg-canvas border-b border-hairline h-14 flex items-center justify-between px-4 sm:px-6 shrink-0">
      <div className="flex items-center gap-3">
        <button 
          onClick={onMenuClick}
          className="btn btn-ghost !px-2 md:hidden"
        >
          <Menu size={20} />
        </button>
        <h1 className="section-title hidden sm:block">SmartWorkFlowX</h1>
        <h1 className="section-title sm:hidden">SWFX</h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <ThemeToggle />

        {/* ── Notification Bell ── */}
        <div ref={bellRef} className="relative">
          <button
            onClick={openBell}
            className="btn btn-ghost !px-2 relative"
            title="Notifications"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-error text-white text-[10px] font-bold rounded-pill flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showBell && (
            <div className="fixed left-4 right-4 top-14 sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-80 bg-canvas rounded-card shadow-xl border border-hairline z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-hairline">
                <span className="font-semibold text-ink text-sm">Notifications</span>
                {notifications.some(n => !n.isRead) && (
                  <button
                    onClick={markAllRead}
                    className="flex items-center gap-1 text-xs text-accent hover:text-accent-hover font-medium"
                  >
                    <CheckCheck size={13} /> Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-hairline">
                {notifications.length === 0 ? (
                  <p className="empty-state">No notifications yet.</p>
                ) : notifications.map(n => (
                  <div
                    key={n.notificationId}
                    className={`px-4 py-3 text-sm ${n.isRead ? 'bg-canvas' : 'bg-accent-soft'}`}
                  >
                    <p className={`text-ink leading-snug ${!n.isRead ? 'font-medium' : ''}`}>
                      {n.message}
                    </p>
                    <p className="caption mt-1">
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="h-6 w-px bg-hairline" />

        {/* User Info */}
        <div className="flex flex-col text-right hidden sm:flex">
          <span className="text-sm font-medium text-ink">{user?.email}</span>
          <span className="text-xs text-accent font-semibold">{role}</span>
        </div>

        <div className="h-6 w-px bg-hairline hidden sm:block" />

        <button
          onClick={() => setShowChangePassword(true)}
          className="btn btn-ghost"
          title="Change Password"
        >
          <KeyRound size={18} />
          <span className="text-sm font-medium hidden sm:inline">Change Password</span>
        </button>

        <div className="h-6 w-px bg-hairline hidden sm:block" />

        <button
          onClick={logout}
          className="btn btn-ghost hover:!text-error"
          title="Logout"
        >
          <LogOut size={18} />
          <span className="text-sm font-medium hidden sm:inline">Logout</span>
        </button>
      </div>

      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
      )}
    </header>
  );
};

export default Header;