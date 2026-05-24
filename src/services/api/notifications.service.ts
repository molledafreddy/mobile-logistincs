import { apiClient } from './client';
import type { AppNotification, PaginatedResponse } from '../../types';

export const NotificationsService = {
  async getNotifications(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<AppNotification>> {
    const { data } = await apiClient.get<PaginatedResponse<AppNotification>>('/notifications', { params });
    return data;
  },

  async markRead(notificationId: string): Promise<void> {
    await apiClient.patch(`/notifications/${notificationId}/read`);
  },

  async markAllRead(): Promise<void> {
    await apiClient.patch('/notifications/read-all');
  },
};
