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
import { notificationsApi } from '@/lib/api/notifications';

/**
 * Notifications page (7.10 + Phase 11.6.3).
 *
 * Phase 11: the list is server-backed (GET /notifications — unread first),
 * cached in the zustand store; mark-as-read single (11.3.2) and bulk
 * (11.3.3) hit the API and reconcile the store optimistically.
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
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(
    () => (filter === 'all' ? list : list.filter((n) => n.type === filter)),
    [list, filter],
  );
  const unreadCount = useMemo(() => list.filter((n) => !n.read).length, [list]);

  /** 11.3.2 — mark one as read (optimistic store update + API call). */
  const handleRead = (id: string) => {
    const item = list.find((n) => n.id === id);
    if (item && !item.read && busyId !== id) {
      setBusyId(id);
      markRead(id);
      notificationsApi
        .markRead(id)
        .catch(() => undefined)
        .finally(() => setBusyId(null));
    }
  };

  /** 11.3.3 — mark all as read. */
  const handleReadAll = () => {
    if (unreadCount === 0) return;
    markAllRead();
    notificationsApi.markAllRead().catch(() => undefined);
  };

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

      {/* Mark all as read (11.3.3) */}
      {unreadCount > 0 && (
        <button
          type="button"
          onClick={handleReadAll}
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
            <NotificationItem key={n.id} notification={n} onRead={handleRead} />
          ))}
        </div>
      )}
    </>
  );
}
