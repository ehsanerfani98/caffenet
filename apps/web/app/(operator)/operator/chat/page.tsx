'use client';

import { useQuery } from '@tanstack/react-query';
import { MessageCircleOff } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { operatorApi } from '@/lib/api/operator';
import { toPersianDigits } from '@/lib/format';
import { OPERATOR_KEYS } from '@/components/operator/requests-cache';

/**
 * Operator Chat (8.6 placeholder) — real-time chat backend lands in
 * Phase 10 (Pusher). Until then this shows the unread-chats KPI
 * (8.2.4) and a coming-soon panel.
 */
export default function OperatorChatPage() {
  const dashboard = useQuery({
    queryKey: OPERATOR_KEYS.dashboard,
    queryFn: operatorApi.dashboard,
    staleTime: 30_000,
    retry: 1,
  });
  const unread = dashboard.data?.kpis.unreadChats;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-extrabold text-gray-900">گفتگو با مشتریان</h2>
        <p className="mt-0.5 text-xs text-gray-400">
          مرکز پیام‌های زندهٔ درخواست‌های تخصیص‌یافته به شما
        </p>
      </div>

      {typeof unread === 'number' && unread > 0 && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
          {toPersianDigits(unread)} گفتگوی خوانده‌نشده دارید — پس از فعال شدن چت، از همین‌جا پاسخ
          می‌دهید.
        </div>
      )}

      <EmptyState
        icon={<MessageCircleOff className="h-8 w-8" />}
        title="چت زنده به‌زودی فعال می‌شود"
        description="گفتگوی بلادرنگ با مشتریان در فاز بعدی سامانه (Phase 10) از طریق همین صفحه در دسترس قرار می‌گیرد."
      />
    </div>
  );
}
