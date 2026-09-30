'use client';

import Link from 'next/link';
import { CheckCheck } from 'lucide-react';
import { useUiStore } from '@/lib/stores/ui-store';
import { useNotificationStore } from '@/lib/stores/notification-store';
import { NotificationItem } from '@/components/common/NotificationItem';
import { notificationsApi } from '@/lib/api/notifications';
import { toPersianDigits } from '@/lib/format';

/**
 * NotificationSheet (Phase 11.6.2) — notification dropdown as a mobile bottom
 * sheet. Shows the latest notifications inline with quick mark-all-read;
 * "مشاهده همه" opens the full list page.
 *
 * Triggered from NotificationBell (customer shell); desktop shells jump to
 * the list page instead.
 */
export function openNotificationSheet() {
  const { openSheet } = useUiStore.getState();
  const { list, markAllRead } = useNotificationStore();
  const unread = list.filter((n) => !n.read).length;
  const latest = list.slice(0, 8);

  openSheet(
    <div className="-mx-5 -mb-5">
      {unread > 0 && (
        <button
          type="button"
          onClick={() => {
            markAllRead();
            notificationsApi.markAllRead().catch(() => undefined);
          }}
          className="bg-brand-50 text-brand-700 active:bg-brand-100 mx-5 mb-2 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold"
        >
          <CheckCheck className="h-3.5 w-3.5" />
          علامت‌گذاری همه به‌عنوان خوانده‌شده ({toPersianDigits(unread)})
        </button>
      )}
      {latest.length === 0 ? (
        <p className="px-5 pb-8 pt-2 text-center text-sm text-gray-400">اعلان جدیدی ندارید</p>
      ) : (
        <div className="max-h-[50vh] overflow-y-auto">
          {latest.map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              onRead={(id) => useNotificationStore.getState().markRead(id)}
            />
          ))}
        </div>
      )}
      <Link
        href="/notifications"
        className="text-brand-700 bg-brand-50/60 mx-5 my-3 block rounded-xl py-2.5 text-center text-xs font-bold"
      >
        مشاهده همه اعلان‌ها
      </Link>
    </div>,
    'اعلان‌ها',
  );
}
