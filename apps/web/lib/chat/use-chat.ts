'use client';

import { InfiniteData, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { chatApi, type ChatMessageDto } from '@/lib/api/chat';
import {
  bindConnectionState,
  emitTyping,
  subscribeRequestChannels,
  unsubscribeRequestChannels,
  type ConnectionState,
} from '@/lib/pusher/pusher-client';

const MESSAGES_KEY = (requestId: string) => ['chat-messages', requestId] as const;

type MessagesPage = {
  items: ChatMessageDto[];
  meta: { hasMore: boolean; nextCursor: string | null };
};
type MessagesInfiniteData = InfiniteData<MessagesPage>;

/**
 * Real-time chat hook (Phase 10.5).
 *
 * - Message history via cursor pagination (10.5.3 — infinite scroll up)
 * - Live updates over private-request.{id} (10.4.1/10.4.2)
 * - Optimistic send + rollback on failure (10.5.7)
 * - Read receipts via MessageRead events (10.5.6)
 * - Typing indicator via presence client events (10.5.5)
 * - Connection state + auto-reconnect awareness (10.5.8 / 10.5.9)
 */
export function useChat(requestId: string) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const meId = user?.id ?? '';

  const [typingFrom, setTypingFrom] = useState<{ userId: string; name?: string } | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('initialized');
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);

  // ---------- History (infinite, newest page first from API) ----------
  const messagesQuery = useInfiniteQuery<
    MessagesPage,
    Error,
    MessagesInfiniteData,
    readonly [string, string],
    string | null
  >({
    queryKey: MESSAGES_KEY(requestId),
    queryFn: ({ pageParam }) =>
      chatApi.messages(requestId, { before: pageParam ?? undefined, limit: 30 }),
    initialPageParam: null as string | null,
    getPreviousPageParam: (firstPage) => firstPage.meta.nextCursor ?? undefined,
    getNextPageParam: () => undefined, // scroll-up only; newest page is last
    enabled: Boolean(requestId) && Boolean(meId),
  });

  const pages = messagesQuery.data?.pages ?? [];
  // Flatten ascending (oldest → newest)
  const messages: ChatMessageDto[] = useMemo(() => pages.flatMap((p) => p.items), [pages]);
  const hasMoreHistory = pages[0]?.meta.hasMore ?? false;
  const loadOlder = useCallback(() => {
    if (hasMoreHistory && !messagesQuery.isFetching) {
      void messagesQuery.fetchPreviousPage();
    }
  }, [hasMoreHistory, messagesQuery]);

  // ---------- Live channel ----------
  useEffect(() => {
    if (!requestId || !meId) return;

    const upsertMessage = (raw: unknown) => {
      const msg = raw as ChatMessageDto;
      if (!msg?.id) return;
      queryClient.setQueryData<InfiniteData<MessagesPage>>(MESSAGES_KEY(requestId), (data) => {
        if (!data) return data;
        const pages = data.pages.map((p) => ({ ...p, items: [...p.items] }));
        // Dedupe by id (replaces optimistic placeholder on own sends)
        for (const page of pages) {
          const idx = page.items.findIndex(
            (m) => m.id === msg.id || (m.id.startsWith('tmp-') && m.uuid === msg.uuid),
          );
          if (idx >= 0) {
            page.items[idx] = msg;
            return { ...data, pages };
          }
        }
        const last = pages[pages.length - 1];
        if (last) last.items = [...last.items, msg];
        return { ...data, pages };
      });

      // Incoming → auto mark as read when the tab is visible
      if (!msg.isMine && document.visibilityState === 'visible') {
        void chatApi.markRead(requestId, msg.id).catch(() => undefined);
      }
      void queryClient.invalidateQueries({ queryKey: ['chat-rooms'] });
      void queryClient.invalidateQueries({ queryKey: ['chat-unread'] });
    };

    const applyRead = (raw: unknown) => {
      const payload = raw as { readerId?: string; lastMessageId?: string; readAt?: string };
      if (!payload?.lastMessageId) return;
      const lastId = Number(payload.lastMessageId);
      queryClient.setQueryData<InfiniteData<MessagesPage>>(MESSAGES_KEY(requestId), (data) => {
        if (!data) return data;
        const pages = data.pages.map((p) => ({
          ...p,
          items: p.items.map((m) => {
            // Only the READER's counterpart (my own messages) flips to ✓✓
            if (m.senderId === payload.readerId || Number(m.id) > lastId) {
              return m;
            }
            return m.readAt ? m : { ...m, readAt: payload.readAt ?? new Date().toISOString() };
          }),
        }));
        return { ...data, pages };
      });
    };

    const applyDeleted = (raw: unknown) => {
      const payload = raw as { messageId?: string; deletedAt?: string };
      if (!payload?.messageId) return;
      queryClient.setQueryData<InfiniteData<MessagesPage>>(MESSAGES_KEY(requestId), (data) => {
        if (!data) return data;
        const pages = data.pages.map((p) => ({
          ...p,
          items: p.items.map((m) =>
            m.id === payload.messageId
              ? { ...m, deletedAt: payload.deletedAt ?? new Date().toISOString(), body: null }
              : m,
          ),
        }));
        return { ...data, pages };
      });
    };

    const handleTyping = (raw: unknown) => {
      const payload = raw as { userId?: string; name?: string };
      if (!payload?.userId || payload.userId === meId) return;
      setTypingFrom({ userId: payload.userId, name: payload.name });
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTypingFrom(null), 2500);
    };

    subscribeRequestChannels(requestId, {
      onMessage: upsertMessage,
      onMessageRead: applyRead,
      onDeleted: applyDeleted,
      onTyping: handleTyping,
    });

    // 10.5.8 — connection indicator + 10.5.9 refetch on reconnect
    const unbind = bindConnectionState((state) => {
      setConnectionState(state);
      if (state === 'connected') {
        void messagesQuery.refetch();
        void queryClient.invalidateQueries({ queryKey: ['chat-rooms'] });
      }
    });

    return () => {
      unbind();
      unsubscribeRequestChannels(requestId);
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId, meId, queryClient]);

  // Mark visible unread messages read on mount/visibility
  useEffect(() => {
    const markVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const lastIncoming = [...messages]
        .reverse()
        .find((m) => !m.isMine && !m.readAt && !m.deletedAt);
      if (lastIncoming) {
        void chatApi.markRead(requestId, lastIncoming.id).catch(() => undefined);
      }
    };
    markVisible();
    document.addEventListener('visibilitychange', markVisible);
    return () => document.removeEventListener('visibilitychange', markVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId, messages.length]);

  // ---------- Send (optimistic + rollback) ----------
  const textMutation = useMutation({
    mutationFn: (body: string) => chatApi.sendText(requestId, body),
    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey: MESSAGES_KEY(requestId) });
      const temp: ChatMessageDto = {
        id: `tmp-${Date.now()}`,
        uuid: `tmp-${Date.now()}`,
        roomId: '',
        senderId: meId,
        sender: { id: meId, fullName: user?.fullName ?? null },
        isMine: true,
        type: 'text',
        body,
        metadata: null,
        attachments: [],
        readAt: null,
        deletedAt: null,
        createdAt: new Date().toISOString(),
      };
      const previous = queryClient.getQueryData<InfiniteData<MessagesPage>>(
        MESSAGES_KEY(requestId),
      );
      queryClient.setQueryData<InfiniteData<MessagesPage>>(MESSAGES_KEY(requestId), (data) => {
        if (!data) return data;
        const pages = data.pages.map((p) => ({ ...p }));
        const last = pages[pages.length - 1];
        if (last) last.items = [...last.items, temp];
        return { ...data, pages };
      });
      return { previous, tempId: temp.id };
    },
    onError: (_err, _body, ctx) => {
      // 10.5.7 — rollback optimistic append
      if (ctx?.previous) queryClient.setQueryData(MESSAGES_KEY(requestId), ctx.previous);
    },
    onSuccess: (saved, _body, ctx) => {
      queryClient.setQueryData<InfiniteData<MessagesPage>>(MESSAGES_KEY(requestId), (data) => {
        if (!data || !ctx) return data;
        const pages = data.pages.map((p) => ({
          ...p,
          items: p.items.map((m) => (m.id === ctx.tempId ? saved : m)),
        }));
        return { ...data, pages };
      });
      void queryClient.invalidateQueries({ queryKey: ['chat-rooms'] });
    },
  });

  const fileMutation = useMutation({
    mutationFn: (args: { file: File; caption?: string }) =>
      chatApi.sendFile(requestId, args.file, args.caption),
    onSuccess: (saved) => {
      queryClient.setQueryData<InfiniteData<MessagesPage>>(MESSAGES_KEY(requestId), (data) => {
        if (!data) return data;
        const pages = data.pages.map((p) => ({ ...p }));
        const last = pages[pages.length - 1];
        if (last && !last.items.some((m) => m.id === saved.id)) {
          last.items = [...last.items, saved];
        }
        return { ...data, pages };
      });
      void queryClient.invalidateQueries({ queryKey: ['chat-rooms'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (messageId: string) => chatApi.deleteMessage(requestId, messageId),
    onSuccess: (_res, messageId) => {
      queryClient.setQueryData<InfiniteData<MessagesPage>>(MESSAGES_KEY(requestId), (data) => {
        if (!data) return data;
        const pages = data.pages.map((p) => ({
          ...p,
          items: p.items.map((m) =>
            m.id === messageId ? { ...m, deletedAt: new Date().toISOString(), body: null } : m,
          ),
        }));
        return { ...data, pages };
      });
    },
  });

  const sendTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSent.current < 1500) return;
    lastTypingSent.current = now;
    emitTyping(requestId, { id: meId, name: user?.fullName });
  }, [requestId, meId, user?.fullName]);

  return {
    messages,
    isLoading: messagesQuery.isLoading,
    isError: messagesQuery.isError,
    refetch: messagesQuery.refetch,
    hasMoreHistory,
    loadOlder,
    connectionState,
    typingFrom,
    sendText: (body: string) => textMutation.mutateAsync(body),
    isSending: textMutation.isPending,
    sendFile: (file: File, caption?: string) => fileMutation.mutateAsync({ file, caption }),
    isSendingFile: fileMutation.isPending,
    deleteMessage: (messageId: string) => deleteMutation.mutateAsync(messageId),
    sendTyping,
  };
}
