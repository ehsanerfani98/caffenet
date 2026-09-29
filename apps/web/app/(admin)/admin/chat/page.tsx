'use client';

import { MessageSquareLock } from 'lucide-react';
import { PageHeader } from '@/components/admin/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';

/**
 * Chat moderation placeholder (9.9.4) — the chat module (realtime via Pusher)
 * lands in Phase 10; moderation UI activates then.
 */
export default function AdminChatPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="نظارت بر چت" description="پایش و مدیریت گفتگوهای مشتری و اپراتور" />
      <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50/50">
        <EmptyState
          icon={<MessageSquareLock className="h-8 w-8" />}
          title="نظارت بر چت با ماژول چت (فاز ۱۰) فعال می‌شود"
          description="چت Real-time روی Pusher در فاز ۱۰ پیاده‌سازی می‌شود؛ ابزارهای نظارت، مسدودسازی و گزارش گفتگو پس از آن فعال خواهند شد."
        />
      </div>
    </div>
  );
}
