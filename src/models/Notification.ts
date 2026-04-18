export interface Notification {
  notificationId: number;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationPaginatedResponse {
  total: number;
  page: number;
  pageSize: number;
  data: Notification[];
}
