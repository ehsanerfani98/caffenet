'use client';

import type { NotificationType } from '@/lib/stores/notification-store';

/**
 * Mapping between server notification types (NotificationType enum in
 * @caffenet/shared, snake_case strings) and the client UI groups used by the
 * notification store / filter tabs (7.10.4).
 */

export function serverTypeToUiType(serverType: string): NotificationType {
  if (serverType === 'new_chat_message') return 'message';
  if (
    serverType === 'payment_successful' ||
    serverType === 'payment_failed' ||
    serverType === 'wallet_charged' ||
    serverType === 'refund_issued'
  ) {
    return 'wallet';
  }
  if (serverType.startsWith('request_')) return 'request';
  return 'system';
}

export interface UiNotification {
  id: string;
  type: NotificationType;
  title: string;
  body?: string;
  createdAt: string;
  read: boolean;
  link?: string;
}

/** Server DTO (REST or NotificationCreated realtime payload) → store item */
export function toUiNotification(input: {
  id?: string | null;
  uuid?: string;
  type: string;
  title: string;
  body?: string | null;
  data?: { link?: string } | null;
  readAt?: string | null;
  createdAt?: string;
}): UiNotification {
  return {
    id: input.uuid ?? input.id ?? `rt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: serverTypeToUiType(input.type),
    title: input.title,
    body: input.body ?? undefined,
    createdAt: input.createdAt ?? new Date().toISOString(),
    read: input.readAt ? Boolean(input.readAt) : false,
    link: input.data?.link,
  };
}
