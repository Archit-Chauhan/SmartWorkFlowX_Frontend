import { useEffect, useRef, useState, useCallback } from 'react';
import * as signalR from '@microsoft/signalr';
import type { Notification } from '../models';

const HUB_URL = import.meta.env.VITE_HUB_URL || 'https://localhost:52082/hubs/notifications';

export const useNotificationHub = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const connectionRef = useRef<signalR.HubConnection | null>(null);

  const connect = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${HUB_URL}?access_token=${token}`, {
        skipNegotiation: true,
        transport: signalR.HttpTransportType.WebSockets,
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connection.on('ReceiveNotification', (notification: Notification) => {
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);
    });

    connection.start().catch(err =>
      console.warn('SignalR connection failed:', err)
    );

    connectionRef.current = connection;
  }, []);

  const disconnect = useCallback(() => {
    connectionRef.current?.stop();
    connectionRef.current = null;
  }, []);

  useEffect(() => {
    connect();
    return () => { disconnect(); };
  }, [connect, disconnect]);

  const clearUnread = useCallback(() => setUnreadCount(0), []);

  return { notifications, unreadCount, clearUnread };
};
