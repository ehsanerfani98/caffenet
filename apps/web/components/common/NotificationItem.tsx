'use client';

import { Bell, ClipboardList, MessageCircle, Settings, Wallet } from 'lucide-react';
import Link from 'next/link';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type AppNotification, type NotificationType } from '@/lib/stores/notification-store';

/**
 * NotificationItem (7.10.3) — single notification row.
 * Unread dot + type icon tint + relative Persian time; tapping marks as read
 * and follows the deep link when present.
 */

const typeMeta: Record<
  NotificationType,
  { icon: React.ComponentType<{ className?: string }>; tint: string }
> = {
  request: { icon: ClipboardList, tint: 'bg-brand-50 text-brand-600' },
  wallet: { icon: Wallet, tint: 'bg-emerald-50 text-emerald-600' },
  message: { icon: MessageCircle, tint: 'bg-sky-50 text-sky-600' },
  system: { icon: Settings, tint: 'bg-gray-100 text-gray-500' },
};

interface NotificationItemProps {
  notification: AppNotification;
  onRead?: (id: string) => void;
}

export function NotificationItem({ notification, onRead }: NotificationItemProps) {
  const meta = typeMeta[notification.type] ?? { icon: Bell, tint: 'bg-gray-100 text-gray-500' };
  const Icon = meta.icon;

  const inner = (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-3.5 active:bg-gray-50',
        !notification.read && 'bg-brand-50/40',
      )}
    >
      <div
        className={cn(
          'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
          meta.tint,
        )}
      >
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p
            className={cn(
              'truncate text-sm',
              notification.read ? 'font-medium text-gray-700' : 'font-bold text-gray-900',
            )}
          >
            {notification.title}
          </p>
          {!notification.read && <span className="bg-brand-500 h-2 w-2 shrink-0 rounded-full" />}
        </div>
        {notification.body && (
          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-gray-500">
            {notification.body}
          </p>
        )}
        <p className="mt-1 text-[10px] text-gray-400">{formatRelative(notification.createdAt)}</p>
      </div>
    </div>
  );

  const className = 'block border-b border-gray-50 last:border-0';

  if (notification.link) {
    return (
      <Link
        href={notification.link}
        className={className}
        onClick={() => onRead?.(notification.id)}
      >
        {inner}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={cn(className, 'w-full text-right')}
      onClick={() => onRead?.(notification.id)}
    >
      {inner}
    </button>
  );
}
