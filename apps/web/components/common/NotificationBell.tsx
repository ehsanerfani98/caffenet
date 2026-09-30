'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toPersianDigits } from '@/lib/format';
import { useUnreadCount } from '@/lib/notifications/use-notifications';
import { openNotificationSheet } from '@/components/common/NotificationSheet';

/**
 * NotificationBell (Phase 11.6.1 + 11.6.2) — bell with live unread badge.
 *  - variant="sheet" (mobile customer): opens the notification bottom sheet
 *  - variant="link" (operator/admin shells): jumps to the notifications page
 */

interface NotificationBellProps {
  href?: string;
  className?: string;
  variant?: 'link' | 'sheet';
}

export function NotificationBell({
  href = '/notifications',
  className,
  variant = 'link',
}: NotificationBellProps) {
  const unread = useUnreadCount();

  const inner = (
    <>
      <Bell className="h-5 w-5" />
      {unread > 0 && (
        <span
          data-testid="unread-badge"
          className="h-4.5 min-w-4.5 absolute -right-0.5 -top-0.5 flex items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white shadow-sm"
        >
          {unread > 99 ? '۹۹+' : toPersianDigits(unread)}
        </span>
      )}
    </>
  );

  const cls = cn('relative rounded-full p-2 text-gray-700 active:bg-gray-100', className);

  if (variant === 'sheet') {
    return (
      <button
        type="button"
        onClick={openNotificationSheet}
        aria-label={unread > 0 ? `اعلان‌ها (${toPersianDigits(unread)} خوانده‌نشده)` : 'اعلان‌ها'}
        className={cls}
      >
        {inner}
      </button>
    );
  }

  return (
    <Link
      href={href}
      aria-label={unread > 0 ? `اعلان‌ها (${toPersianDigits(unread)} خوانده‌نشده)` : 'اعلان‌ها'}
      className={cls}
    >
      {inner}
    </Link>
  );
}
