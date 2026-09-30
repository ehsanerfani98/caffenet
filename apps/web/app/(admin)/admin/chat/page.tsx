'use client';

import { PageHeader } from '@/components/admin/PageHeader';
import { ChatRoomList } from '@/components/chat/ChatRoomList';

/**
 * Admin chat moderation (9.9.4 + Phase 10) — monitor every conversation.
 * Admin can open any room read/write (server-side authorization allows admin).
 */
export default function AdminChatPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="نظارت بر چت" description="پایش و مدیریت گفتگوهای مشتری و اپراتور" />
      <div className="mt-4">
        <ChatRoomList
          basePath="/admin/chat"
          title="همهٔ گفتگوها"
          description="برای ورود به اتاق گفتگو و مشاهدهٔ کامل تاریخچه، روی هر ردیف بزنید"
        />
      </div>
    </div>
  );
}
