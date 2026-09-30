'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { chatApi } from '@/lib/api/chat';
import { toPersianDigits } from '@/lib/format';

/**
 * Operator chat room (Phase 10.5) — realtime conversation with the
 * customer of an assigned request.
 */
export default function OperatorChatRoomPage() {
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
      <header className="flex items-center gap-3 border-b border-gray-100 bg-white px-4 py-3">
        <Link
          href="/operator/chat"
          className="rounded-full p-1.5 text-gray-500 transition-colors hover:bg-gray-100"
          aria-label="بازگشت به لیست گفتگوها"
        >
          <ArrowRight className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold text-gray-800">
            {room.data?.request.customer?.fullName || 'گفتگو با مشتری'}
          </p>
          <p className="text-[11px] text-gray-400">
            {room.data
              ? `${room.data.request.serviceName ?? ''} · کد ${toPersianDigits(room.data.request.trackingCode)}`
              : '…'}
          </p>
        </div>
        {room.data && (
          <Link
            href={`/operator/requests/${requestId}`}
            className="hover:border-brand-300 hover:text-brand-600 shrink-0 rounded-full border border-gray-200 px-3 py-1 text-[11px] font-bold text-gray-500 transition-colors"
          >
            پروندهٔ درخواست
          </Link>
        )}
      </header>

      <div className="min-h-0 flex-1 p-3">
        {requestId ? <ChatPanel requestId={requestId} className="h-full" /> : null}
      </div>
    </div>
  );
}
