'use client';

import { ChatRoomList } from '@/components/chat/ChatRoomList';

/**
 * Operator Chat (Phase 10.5) — live conversations for the requests
 * assigned to me. Unread badge per room + KPI badge in the dashboard.
 */
export default function OperatorChatPage() {
  return (
    <div className="space-y-4">
      <ChatRoomList
        basePath="/operator/chat"
        title="گفتگو با مشتریان"
        description="مرکز پیام‌های زندهٔ درخواست‌های تخصیص‌یافته به شما"
      />
    </div>
  );
}
