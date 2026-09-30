'use client';

import {
  useNotificationHydration,
  useNotificationRealtime,
} from '@/lib/notifications/use-notifications';

/**
 * Phase 11.6 — app-level notification bridge.
 * Mounts once per app shell; wires the private-user.{id} realtime channel,
 * live badge invalidation, in-app toasts and server hydration.
 */
export function NotificationRealtimeBridge() {
  useNotificationRealtime();
  useNotificationHydration();
  return null;
}
