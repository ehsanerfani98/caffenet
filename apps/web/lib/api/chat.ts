'use client';

import { apiClient } from '@/lib/api-client';

/**
 * Chat API (Phase 10) — realtime chat over Pusher.
 * Mirrors apps/api/src/modules/chat endpoints.
 */

export interface ChatSenderDto {
  id: string;
  fullName: string | null;
  phone?: string;
}

export interface ChatAttachmentDto {
  id: string;
  fileId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  url: string | null;
}

export interface ChatMessageDto {
  id: string;
  uuid: string;
  roomId: string;
  senderId: string;
  sender: ChatSenderDto | null;
  isMine: boolean;
  type: 'text' | 'image' | 'file' | 'system';
  body: string | null;
  metadata: Record<string, unknown> | null;
  attachments: ChatAttachmentDto[];
  readAt: string | null;
  deletedAt: string | null;
  createdAt: string;
}

export interface ChatMessagesPage {
  items: ChatMessageDto[];
  meta: { hasMore: boolean; nextCursor: string | null };
}

export interface ChatRoomDto {
  id: string;
  uuid: string;
  requestId: string;
  type: string;
  updatedAt: string;
  request: {
    id: string;
    trackingCode: string;
    status: string;
    serviceName: string | null;
    customer: { id: string; fullName: string | null; phone: string } | null;
  };
  lastMessage: {
    id: string;
    type: string;
    body: string | null;
    senderId: string;
    senderName: string | null;
    isMine: boolean;
    createdAt: string;
  } | null;
  unreadCount: number;
}

export interface ChatRoomsPage {
  items: ChatRoomDto[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export const chatApi = {
  /** 10.3.1 — message history (cursor pagination, newest page first) */
  messages: (requestId: string, params?: { before?: string; limit?: number }) =>
    apiClient
      .get<ChatMessagesPage>(`/requests/${requestId}/messages`, { params })
      .then((r) => r.data),

  /** 10.3.2 — send text message */
  sendText: (requestId: string, body: string) =>
    apiClient.post<ChatMessageDto>(`/requests/${requestId}/messages`, { body }).then((r) => r.data),

  /** 10.3.3 — send image/file message (multipart) */
  sendFile: (requestId: string, file: File, caption?: string) => {
    const form = new FormData();
    form.append('file', file);
    if (caption) form.append('caption', caption);
    return apiClient
      .post<ChatMessageDto>(`/requests/${requestId}/messages/file`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },

  /** 10.3.4 — mark incoming messages read (optionally up to a message) */
  markRead: (requestId: string, messageId?: string) =>
    apiClient
      .post<{ markedCount: number }>(
        `/requests/${requestId}/messages/${messageId ?? 'all'}/read`,
        {},
      )
      .then((r) => r.data),

  /** 10.3.5 — soft delete own message */
  deleteMessage: (requestId: string, messageId: string) =>
    apiClient
      .delete<{ message: string }>(`/requests/${requestId}/messages/${messageId}`)
      .then((r) => r.data),

  /** Rooms list with unread badges */
  rooms: (params?: { page?: number; limit?: number }) =>
    apiClient.get<ChatRoomsPage>('/chat/rooms', { params }).then((r) => r.data),

  /** Total unread messages badge */
  unreadCount: () =>
    apiClient.get<{ count: number }>('/chat/unread-count').then((r) => r.data.count),
};
