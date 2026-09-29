'use client';

import { MessageCircleOff } from 'lucide-react';
import { MobileHeader } from '@/components/common/MobileHeader';
import { EmptyState } from '@/components/common/EmptyState';

/**
 * Chat page — entry point exists from request detail (7.7.5).
 * NOTE: Real-time chat backend lands in Phase 10 (Pusher).
 * The Pusher client is already wired (lib/pusher/pusher-client.ts).
 */
export default function ChatPage() {
  return (
    <>
      <MobileHeader title="گفتگو" showBell={false} />
      <EmptyState
        className="pt-10"
        icon={<MessageCircleOff className="h-8 w-8" />}
        title="گفتگویی فعال نیست"
        description="گفتگو با اپراتور از صفحه جزئیات هر درخواست در دسترس قرار می‌گیرد"
      />
    </>
  );
}
