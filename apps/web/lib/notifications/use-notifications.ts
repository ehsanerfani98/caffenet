'use client';

import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PUSHER_CONFIG } from '@caffenet/shared';
import { getPusherClient } from '@/lib/pusher/pusher-client';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useNotificationStore } from '@/lib/stores/notification-store';
import { toUiNotification, type UiNotification } from '@/lib/notifications/map';
import { toast } from '@/components/ui/use-toast';
import { notificationsApi } from '@/lib/api/notifications';

/**
 * Phase 11.6 — notification realtime bridge + unread badge source.
 *
 *  - Hydrates the local store from the server list (7.10.1 data source swap).
 *  - Subscribes to `private-user.{id}` and handles `NotificationCreated`
 *    (11.2.4): upsert into the store, bump the badge, show an in-app toast
 *    (11.6.5).
 *  - `useUnreadCount()` feeds every bell badge (11.6.1).
 *
 * Mounted once from <Providers/> — safe across customer/operator/admin shells.
 */

const UNREAD_KEY = ['notifications', 'unread-count'] as const;

interface NotificationCreatedPayload {
  id?: string | null;
  uuid?: string;
  type: string;
  title: string;
  body?: string | null;
  data?: { link?: string; requestId?: string } | null;
  createdAt?: string;
}

/** Subscribe + react to live notifications for the logged-in user. */
export function useNotificationRealtime(): void {
  const userId = useAuthStore((s) => s.user?.id);
  const upsert = useNotificationStore((s) => s.upsert);
  const queryClient = useQueryClient();
  // Keep the handler stable but always-fresh via refs (avoid re-subscribing)
  const upsertRef = useRef(upsert);
  upsertRef.current = upsert;

  useEffect(() => {
    if (!userId) return;
    const pusher = getPusherClient();
    if (!pusher) return;

    const channelName = PUSHER_CONFIG.PRIVATE_USER_CHANNEL(userId);
    const channel = pusher.subscribe(channelName);

    const onCreated = (payload: NotificationCreatedPayload) => {
      const item: UiNotification = toUiNotification(payload);
      upsertRef.current(item);
      // Bump the badge immediately (fall back to refetch on race)
      queryClient.setQueryData<number>(UNREAD_KEY, (old) => (old ?? 0) + 1);
      toast({
        title: payload.title,
        description: payload.body ?? undefined,
      });
    };

    channel.bind('NotificationCreated', onCreated);
    return () => {
      channel.unbind('NotificationCreated', onCreated);
      pusher.unsubscribe(channelName);
    };
  }, [userId, queryClient]);
}

/** Hydrate the local store from the server once per session. */
export function useNotificationHydration(): void {
  const setAll = useNotificationStore((s) => s.setAll);
  useEffect(() => {
    let cancelled = false;
    notificationsApi
      .list({ page: 1, limit: 30 })
      .then((page) => {
        if (cancelled) return;
        setAll(
          page.items.map((n) =>
            toUiNotification({
              id: n.id,
              uuid: n.uuid,
              type: n.type,
              title: n.title,
              body: n.body,
              data: n.data,
              readAt: n.readAt,
              createdAt: n.createdAt,
            }),
          ),
        );
      })
      .catch(() => undefined); // silent — the local cache stays usable offline
    return () => {
      cancelled = true;
    };
  }, [setAll]);
}

/** Unread badge counter (11.6.1) — realtime-bumped + refetched on focus. */
export function useUnreadCount(): number {
  const userId = useAuthStore((s) => s.user?.id);
  const { data } = useQuery({
    queryKey: UNREAD_KEY,
    queryFn: () => notificationsApi.unreadCount(),
    enabled: Boolean(userId),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
  return data ?? 0;
}
