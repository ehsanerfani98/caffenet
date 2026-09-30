'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, MessageCircle, MessageSquareText, Paperclip } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { ListSkeleton } from '@/components/common/Skeleton';
import { chatApi, type ChatRoomDto } from '@/lib/api/chat';
import { formatRelative, toPersianDigits } from '@/lib/format';
import { REQUEST_STATUS_LABELS } from '@/lib/status-meta';

const CHAT_KEYS = {
  rooms: ['chat-rooms'] as const,
  unread: ['chat-unread'] as const,
};

function lastMessagePreview(room: ChatRoomDto): string {
  const last = room.lastMessage;
  if (!last) return 'هنوز پیامی رد و بدل نشده';
  const prefix = last.isMine ? 'شما: ' : '';
  if (last.type === 'image') return `${prefix}🖼 تصویر`;
  if (last.type === 'file') return `${prefix}📎 فایل`;
  return `${prefix}${last.body ?? ''}`;
}

function RoomRow({ room, basePath }: { room: ChatRoomDto; basePath: string }) {
  return (
    <Link
      href={`${basePath}/${room.requestId}`}
      className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3.5 shadow-sm transition-colors active:bg-gray-50"
    >
      <span className="bg-brand-50 text-brand-600 relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl">
        <MessageCircle className="h-5 w-5" />
        {room.unreadCount > 0 && (
          <span className="absolute -left-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-extrabold text-white">
            {toPersianDigits(room.unreadCount)}
          </span>
        )}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-extrabold text-gray-800">
            {room.request.customer?.fullName || room.request.customer?.phone || 'مشتری'}
          </p>
          <span className="shrink-0 text-[10px] text-gray-400">
            {room.lastMessage ? formatRelative(room.lastMessage.createdAt) : ''}
          </span>
        </div>
        <p
          className={`mt-0.5 truncate text-xs ${
            room.unreadCount > 0 ? 'font-bold text-gray-700' : 'text-gray-400'
          }`}
        >
          {lastMessagePreview(room)}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-[10px] text-gray-400">
          <span className="rounded-full bg-gray-100 px-1.5 py-0.5 font-bold">
            {room.request.trackingCode}
          </span>
          <span>{room.request.serviceName}</span>
          <span className="text-brand-600">
            · {REQUEST_STATUS_LABELS[room.request.status] ?? room.request.status}
          </span>
        </p>
      </div>

      <ChevronLeft className="h-4 w-4 shrink-0 text-gray-300" />
    </Link>
  );
}

/**
 * ChatRoomList (10.5.4) — my conversation rooms with unread badges.
 * Used by the customer chat page, operator console and admin moderation.
 */
export function ChatRoomList({
  basePath,
  title,
  description,
}: {
  basePath: string;
  title: string;
  description?: string;
}) {
  const rooms = useQuery({
    queryKey: CHAT_KEYS.rooms,
    queryFn: () => chatApi.rooms({ limit: 30 }),
    staleTime: 15_000,
    refetchInterval: 60_000, // rooms refresh; live updates arrive via Pusher
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-extrabold text-gray-900">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-gray-400">{description}</p>}
      </div>

      {rooms.isLoading && <ListSkeleton rows={4} />}

      {rooms.isError && (
        <ErrorState title="خطا در دریافت گفتگوها" onRetry={() => void rooms.refetch()} />
      )}

      {rooms.data && rooms.data.items.length === 0 && (
        <EmptyState
          icon={<MessageSquareText className="h-8 w-8" />}
          title="گفتگویی وجود ندارد"
          description="با ثبت درخواست یا تخصیص آن به اپراتور، گفتگوی زنده از همین‌جا در دسترس قرار می‌گیرد."
        />
      )}

      {rooms.data && rooms.data.items.length > 0 && (
        <div className="space-y-2.5">
          {rooms.data.items.map((room) => (
            <RoomRow key={room.id} room={room} basePath={basePath} />
          ))}
        </div>
      )}

      {rooms.data && rooms.data.items.length > 0 && (
        <p className="flex items-center justify-center gap-1 text-center text-[10px] text-gray-300">
          <Paperclip className="h-3 w-3" />
          ارسال تصویر و فایل در گفتگو پشتیبانی می‌شود
        </p>
      )}
    </div>
  );
}
