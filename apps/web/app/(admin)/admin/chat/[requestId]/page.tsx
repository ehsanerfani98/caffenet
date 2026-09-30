'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { chatApi } from '@/lib/api/chat';
import { toPersianDigits } from '@/lib/format';

/**
 * Admin chat room view (9.9.4 + Phase 10) — full history + live events
 * for moderation purposes (admin participates as observer via server authz).
 */
export default function AdminChatRoomPage() {
  const params = useParams<{ requestId: string }>();
  const requestId = params?.requestId;

  const room = useQuery({
    queryKey: ['chat-room', requestId],
    queryFn: () => chatApi.rooms({ limit: 50 }),
    enabled: Boolean(requestId),
    select: (data) => data.items.find((r) => r.requestId === requestId),
  });

  return (
    <div className="mx-auto flex h-dvh max-w-3xl flex-col">
      <header className="flex items-center gap-3 border-b border-gray-100 bg-white px-4 py-3">
        <Link
          href="/admin/chat"
          className="rounded-full p-1.5 text-gray-500 transition-colors hover:bg-gray-100"
          aria-label="بازگشت"
        >
          <ArrowRight className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold text-gray-800">
            {room.data?.request.customer?.fullName || 'نظارت بر گفتگو'}
          </p>
          <p className="text-[11px] text-gray-400">
            {room.data
              ? `${room.data.request.serviceName ?? ''} · کد ${toPersianDigits(room.data.request.trackingCode)}`
              : '…'}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-extrabold text-amber-700">
          حالت نظارت
        </span>
      </header>

      <div className="min-h-0 flex-1 p-3">
        {requestId ? <ChatPanel requestId={requestId} className="h-full" /> : null}
      </div>
    </div>
  );
}
