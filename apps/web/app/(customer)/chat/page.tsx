'use client';

import { MobileHeader } from '@/components/common/MobileHeader';
import { ChatRoomList } from '@/components/chat/ChatRoomList';

/**
 * Customer chat hub (Phase 10.5) — list of my conversation rooms
 * with unread badges. Opening a room starts the realtime chat.
 */
export default function CustomerChatPage() {
  return (
    <>
      <MobileHeader title="گفتگوها" showBell={false} />
      <div className="space-y-4 px-4 py-2">
        <ChatRoomList
          basePath="/chat"
          title="گفتگو با اپراتورها"
          description="پیام‌های زندهٔ درخواست‌های شما"
        />
      </div>
    </>
  );
}
