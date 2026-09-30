'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Notifications client store (7.10) + preferences (7.9.5).
 *
 * The backend notifications module lands in Phase 11 (Notification + Web Push):
 *   GET  /api/v1/notifications            → setAll(list)
 *   POST /api/v1/notifications/:id/read   → markRead(id)
 *   POST /api/v1/notifications/read-all   → markAllRead()
 *   PATCH /api/v1/users/me/notification-preferences → setPrefs (server sync)
 *
 * Until then the list is hydrated client-side only (empty on first run);
 * the UI layer (filters, unread badge, mark-as-read) is fully wired so
 * Phase 11 only needs to swap the data source.
 */

export type NotificationType = 'request' | 'wallet' | 'message' | 'system';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body?: string;
  createdAt: string; // ISO
  read: boolean;
  /** Deep-link target, e.g. /requests/12 or /wallet/transactions */
  link?: string;
}

export interface NotificationPrefs {
  /** وضعیت درخواست‌ها (تغییر وضعیت، تکمیل، رد) */
  requests: boolean;
  /** کیف پول و صورت‌حساب‌ها (شارژ، پرداخت، بدهی) */
  wallet: boolean;
  /** پیام‌های چت با اپراتور */
  messages: boolean;
  /** اخبار، تخفیف‌ها و اطلاعیه‌ها */
  marketing: boolean;
  /** سوئیچ اصلی Web Push (فعال‌سازی در Phase 11) */
  pushEnabled: boolean;
}

interface NotificationState {
  list: AppNotification[];
  prefs: NotificationPrefs;

  setAll: (list: AppNotification[]) => void;
  /** Phase 11 — insert (or move to top) a live notification from realtime/poll */
  upsert: (n: AppNotification) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearRead: () => void;

  setPref: <K extends keyof NotificationPrefs>(key: K, value: NotificationPrefs[K]) => void;
}

const defaultPrefs: NotificationPrefs = {
  requests: true,
  wallet: true,
  messages: true,
  marketing: false,
  pushEnabled: false,
};

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      list: [],
      prefs: defaultPrefs,

      setAll: (list) => set({ list }),
      upsert: (n) =>
        set((s) => ({
          list: [n, ...s.list.filter((x) => x.id !== n.id)].slice(0, 100),
        })),
      markRead: (id) =>
        set((s) => ({ list: s.list.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
      markAllRead: () => set((s) => ({ list: s.list.map((n) => ({ ...n, read: true })) })),
      clearRead: () => set((s) => ({ list: s.list.filter((n) => !n.read) })),

      setPref: (key, value) => set((s) => ({ prefs: { ...s.prefs, [key]: value } })),
    }),
    {
      name: 'caffenet-notifications',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

/** Persian labels for notification types (filter tabs — 7.10.4). */
export const notificationTypeLabels: Record<NotificationType, string> = {
  request: 'درخواست‌ها',
  wallet: 'کیف پول',
  message: 'پیام‌ها',
  system: 'سیستم',
};
