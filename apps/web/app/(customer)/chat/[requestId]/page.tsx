'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { chatApi } from '@/lib/api/chat';
import { toPersianDigits } from '@/lib/format';

/**
 * Customer chat room (Phase 10.5) — realtime conversation for one request.
 */
export default function CustomerChatRoomPage() {
  const params = useParams<{ requestId: string }>();
  const requestId = params?.requestId;

  const room = useQuery({
    queryKey: ['chat-room', requestId],
    queryFn: () => chatApi.rooms({ limit: 50 }),
    enabled: Boolean(requestId),
    select: (data) => data.items.find((r) => r.requestId === requestId),
  });

  return (
    <div className="flex h-dvh flex-col">
      <header className="pt-safe flex items-center gap-3 border-b border-gray-100 bg-white px-3 py-3">
        <Link
          href="/chat"
          className="rounded-full p-1.5 text-gray-500 transition-colors hover:bg-gray-100"
          aria-label="بازگشت"
        >
          <ArrowRight className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold text-gray-800">
            {room.data?.request.customer?.fullName || 'گفتگوی درخواست'}
          </p>
          <p className="text-[11px] text-gray-400">
            {room.data
              ? `کد رهگیری ${toPersianDigits(room.data.request.trackingCode)} · ${room.data.request.serviceName ?? ''}`
              : '…'}
          </p>
        </div>
      </header>

      <div className="min-h-0 flex-1 p-3">
        {requestId ? <ChatPanel requestId={requestId} className="h-full" /> : null}
      </div>
    </div>
  );
}
