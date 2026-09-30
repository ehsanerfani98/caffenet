'use client';

import { apiClient } from '@/lib/api-client';

/**
 * Notifications API (Phase 11.3 / 11.4) — mirrors
 * apps/api/src/modules/notifications endpoints.
 */

export interface ServerNotificationDto {
  id: string;
  uuid: string;
  type: string;
  title: string;
  body: string | null;
  data: {
    requestId?: string;
    link?: string;
    [key: string]: unknown;
  } | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsPage {
  items: ServerNotificationDto[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    unreadCount: number;
  };
}

export interface ChannelFlagsDto {
  inApp: boolean;
  push: boolean;
  email: boolean;
  sms: boolean;
}

export interface GroupPrefsDto {
  requests: ChannelFlagsDto;
  wallet: ChannelFlagsDto;
  messages: ChannelFlagsDto;
  marketing: ChannelFlagsDto;
  pushEnabled: boolean;
}

export interface PushSubscriptionDto {
  id: string;
  endpoint: string;
  createdAt: string;
}

export const notificationsApi = {
  /** 11.3.1 — paginated list, unread first */
  list: (params?: { page?: number; limit?: number; unreadOnly?: boolean }) =>
    apiClient.get<NotificationsPage>('/notifications', { params }).then((r) => r.data),

  /** 11.3.4 — badge counter */
  unreadCount: () =>
    apiClient.get<{ count: number }>('/notifications/unread-count').then((r) => r.data.count),

  /** 11.3.2 */
  markRead: (id: string) =>
    apiClient
      .post<ServerNotificationDto>(`/notifications/${encodeURIComponent(id)}/read`)
      .then((r) => r.data),

  /** 11.3.3 */
  markAllRead: () =>
    apiClient.post<{ updated: number }>('/notifications/read-all').then((r) => r.data),

  /** 11.3.5 */
  remove: (id: string) =>
    apiClient
      .delete<{ ok: boolean }>(`/notifications/${encodeURIComponent(id)}`)
      .then((r) => r.data),

  /** 11.3.6 — grouped preference view */
  getPreferences: () =>
    apiClient.get<GroupPrefsDto>('/notifications/preferences').then((r) => r.data),

  /** 11.3.6 — partial group update */
  updatePreferences: (
    patch: Partial<Omit<GroupPrefsDto, 'pushEnabled'>> & { pushEnabled?: boolean },
  ) => apiClient.put<GroupPrefsDto>('/notifications/preferences', patch).then((r) => r.data),

  // ---- Web Push (11.4) ----

  /** VAPID public key + availability */
  vapidPublicKey: () =>
    apiClient
      .get<{ publicKey: string | null; enabled: boolean }>('/notifications/vapid-public-key')
      .then((r) => r.data),

  /** 11.4.3 — register (or rotate) this browser's subscription */
  subscribe: (body: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
    userAgent?: string;
    deviceType?: 'mobile' | 'tablet' | 'desktop';
  }) => apiClient.post<PushSubscriptionDto>('/push/subscribe', body).then((r) => r.data),

  /** 11.4.4 — remove this browser's subscription */
  unsubscribe: (endpoint: string) =>
    apiClient
      .delete<{ removed: number }>('/push/subscribe', { data: { endpoint } })
      .then((r) => r.data),
};
