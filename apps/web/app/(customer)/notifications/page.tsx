'use client';

import { useMemo, useState } from 'react';
import { BellOff, CheckCheck } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { MobileHeader } from '@/components/common/MobileHeader';
import { NotificationItem } from '@/components/common/NotificationItem';
import { toPersianDigits } from '@/lib/format';
import {
  notificationTypeLabels,
  useNotificationStore,
  type NotificationType,
} from '@/lib/stores/notification-store';
import { cn } from '@/lib/utils';

/**
 * Notifications page (7.10) — list (7.10.1), mark as read single + bulk
 * (7.10.2), NotificationItem (7.10.3), filter by type (7.10.4).
 *
 * NOTE: the backend notifications module lands in Phase 11 (Notification +
 * Web Push). Data is hydrated into the client store then; all UI behaviour
 * below is final and Phase 11 only swaps the data source.
 */

type Filter = 'all' | NotificationType;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'همه' },
  { key: 'request', label: notificationTypeLabels.request },
  { key: 'wallet', label: notificationTypeLabels.wallet },
  { key: 'message', label: notificationTypeLabels.message },
  { key: 'system', label: notificationTypeLabels.system },
];

export default function NotificationsPage() {
  const { list, markRead, markAllRead } = useNotificationStore();
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = useMemo(
    () => (filter === 'all' ? list : list.filter((n) => n.type === filter)),
    [list, filter],
  );
  const unreadCount = useMemo(() => list.filter((n) => !n.read).length, [list]);

  return (
    <>
      <MobileHeader title="اعلان‌ها" showBack showBell={false} />

      {/* Filter tabs (7.10.4) */}
      <div className="sticky top-14 z-10 -mx-4 border-b border-gray-100 bg-white/95 px-4 py-2.5 backdrop-blur">
        <div className="flex gap-2 overflow-x-auto pb-0.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors',
                filter === f.key
                  ? 'bg-brand-600 text-white'
                  : 'bg-gray-100 text-gray-600 active:bg-gray-200',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mark all as read (7.10.2 — bulk) */}
      {unreadCount > 0 && (
        <button
          type="button"
          onClick={markAllRead}
          className="bg-brand-50 text-brand-700 active:bg-brand-100 mx-auto mt-3 flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold"
        >
          <CheckCheck className="h-4 w-4" />
          علامت‌گذاری همه به‌عنوان خوانده‌شده ({toPersianDigits(unreadCount)})
        </button>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          className="pt-10"
          icon={<BellOff className="h-8 w-8" />}
          title={
            filter === 'all'
              ? 'اعلان جدیدی ندارید'
              : `«${FILTERS.find((f) => f.key === filter)?.label}» خالی است`
          }
          description="تغییر وضعیت درخواست‌ها، صورت‌حساب‌ها و پیام‌ها اینجا اطلاع‌رسانی می‌شود"
        />
      ) : (
        <div className="mt-3 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          {filtered.map((n) => (
            <NotificationItem key={n.id} notification={n} onRead={markRead} />
          ))}
        </div>
      )}
    </>
  );
}
