'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, Loader2, MessageSquareOff, PenLine, WifiOff } from 'lucide-react';
import { ChatInput } from './ChatInput';
import { ChatMessageItem } from './ChatMessageItem';
import { useChat } from '@/lib/chat/use-chat';
import { ErrorState } from '@/components/common/ErrorState';

/**
 * ChatPanel (10.5) — realtime conversation for one request room.
 * Infinite scroll-up history (10.5.3), connection indicator (10.5.8),
 * auto-reconnect + refetch (10.5.9), typing indicator (10.5.5),
 * optimistic send (10.5.7), read receipts (10.5.6).
 */
export function ChatPanel({ requestId, className }: { requestId: string; className?: string }) {
  const {
    messages,
    isLoading,
    isError,
    refetch,
    hasMoreHistory,
    loadOlder,
    connectionState,
    typingFrom,
    sendText,
    isSending,
    sendFile,
    deleteMessage,
    sendTyping,
  } = useChat(requestId);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomAnchorRef = useRef<HTMLDivElement>(null);
  const [showJump, setShowJump] = useState(false);
  const stickToBottom = useRef(true);

  const scrollToBottom = useCallback((smooth = true) => {
    bottomAnchorRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  // Initial load + new messages: keep pinned to bottom unless user scrolled up
  useEffect(() => {
    if (!isLoading && stickToBottom.current) {
      scrollToBottom(false);
      requestAnimationFrame(() => scrollToBottom(false));
    }
  }, [isLoading, messages.length, scrollToBottom]);

  // Track scroll position: infinite scroll up (10.5.3) + jump-to-latest badge
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottom.current = distanceFromBottom < 80;
    setShowJump(distanceFromBottom > 240);

    if (el.scrollTop < 60 && hasMoreHistory) {
      const prevHeight = el.scrollHeight;
      loadOlder();
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight - prevHeight;
      });
    }
  }, [hasMoreHistory, loadOlder]);

  const disconnected = connectionState !== 'connected';

  if (isError) {
    return (
      <div className={className}>
        <ErrorState title="خطا در دریافت پیام‌ها" onRetry={() => void refetch()} />
      </div>
    );
  }

  return (
    <div
      className={`relative flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-gray-50 ${className ?? ''}`}
    >
      {/* Status strip — connection (10.5.8) */}
      <div
        className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-bold transition-colors ${
          disconnected ? 'bg-amber-50 text-amber-700' : 'bg-brand-50 text-brand-700'
        }`}
      >
        {disconnected ? (
          <>
            <WifiOff className="h-3 w-3" />
            اتصال برقرار نیست — تلاش برای اتصال مجدد…
          </>
        ) : (
          <span className="flex items-center gap-1.5">
            <span className="bg-brand-500 h-1.5 w-1.5 rounded-full" />
            متصل
          </span>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="relative flex-1 space-y-2 overflow-y-auto p-3"
        style={{ minHeight: 260 }}
      >
        {isLoading && (
          <div className="flex items-center justify-center py-10 text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}

        {!isLoading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-gray-400">
            <MessageSquareOff className="h-8 w-8" />
            <p className="text-sm font-bold text-gray-500">اولین پیام را بفرستید</p>
            <p className="text-xs">گفتگوی این درخواست هنوز شروع نشده است</p>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className="group relative">
            <ChatMessageItem message={m} />
            {m.isMine && !m.deletedAt && !m.id.startsWith('tmp-') && (
              <button
                type="button"
                onClick={() => void deleteMessage(m.id).catch(() => undefined)}
                className="absolute left-0 top-1/2 hidden -translate-y-1/2 rounded-md px-1.5 py-0.5 text-[10px] text-gray-300 hover:text-red-500 group-hover:block"
                aria-label="حذف پیام"
              >
                حذف
              </button>
            )}
          </div>
        ))}

        {/* Typing indicator (10.5.5) */}
        {typingFrom && (
          <div className="flex items-center gap-1.5 px-1 text-[11px] text-gray-400">
            <span className="flex gap-0.5">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-300 [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-300 [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-300 [animation-delay:300ms]" />
            </span>
            <PenLine className="h-3 w-3" />
            {typingFrom.name ? `${typingFrom.name} در حال نوشتن…` : 'در حال نوشتن…'}
          </div>
        )}

        <div ref={bottomAnchorRef} />
      </div>

      {/* Jump to latest */}
      {showJump && (
        <button
          type="button"
          onClick={() => scrollToBottom()}
          className="absolute bottom-20 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full bg-gray-800/90 px-3 py-1.5 text-[11px] font-bold text-white shadow-lg"
        >
          <ArrowDown className="h-3 w-3" />
          آخرین پیام‌ها
        </button>
      )}

      {/* Composer */}
      <ChatInput
        onSendText={sendText}
        onSendFile={sendFile}
        onTyping={sendTyping}
        disabled={isSending}
      />
    </div>
  );
}
