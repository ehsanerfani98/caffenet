'use client';

/**
 * RequestTimeline (Phase 4.4.3) — UI-friendly vertical timeline for a request.
 *
 * Consumes the output of GET /api/v1/requests/:id/timeline
 * (RequestTimelineEntryDto[] from @caffenet/shared, newest first).
 *
 * Design notes:
 *  - RTL-first (Persian) — works in LTR too
 *  - Each entry type maps to an icon + accent color
 *  - Pure presentational: no fetching, no side effects → easy to test
 */

import { cn } from '@/lib/utils';
import type { RequestTimelineEntryDto } from '@caffenet/shared';

interface RequestTimelineProps {
  entries: RequestTimelineEntryDto[];
  /** Hide actor names (e.g. customer view) */
  showActor?: boolean;
  className?: string;
  emptyMessage?: string;
}

const TYPE_STYLES: Record<string, { icon: string; ring: string; bg: string; label: string }> = {
  created: { icon: '📝', ring: 'ring-blue-200', bg: 'bg-blue-50', label: 'text-blue-700' },
  status_changed: {
    icon: '🔄',
    ring: 'ring-amber-200',
    bg: 'bg-amber-50',
    label: 'text-amber-700',
  },
  assigned: { icon: '👤', ring: 'ring-indigo-200', bg: 'bg-indigo-50', label: 'text-indigo-700' },
  unassigned: { icon: '👤', ring: 'ring-gray-200', bg: 'bg-gray-50', label: 'text-gray-600' },
  attachment_added: { icon: '📎', ring: 'ring-teal-200', bg: 'bg-teal-50', label: 'text-teal-700' },
  completed: {
    icon: '✅',
    ring: 'ring-emerald-200',
    bg: 'bg-emerald-50',
    label: 'text-emerald-700',
  },
  cancelled: { icon: '🚫', ring: 'ring-rose-200', bg: 'bg-rose-50', label: 'text-rose-700' },
  note: { icon: '💬', ring: 'ring-gray-200', bg: 'bg-gray-50', label: 'text-gray-600' },
};

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-700',
  reviewing: 'bg-amber-100 text-amber-800',
  waiting_for_customer: 'bg-sky-100 text-sky-800',
  in_progress: 'bg-indigo-100 text-indigo-800',
  waiting_for_payment: 'bg-violet-100 text-violet-800',
  paid: 'bg-teal-100 text-teal-800',
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-rose-100 text-rose-800',
  rejected: 'bg-red-100 text-red-800',
};

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function RequestTimeline({
  entries,
  showActor = true,
  className,
  emptyMessage = 'رویدادی برای نمایش وجود ندارد',
}: RequestTimelineProps) {
  if (!entries || entries.length === 0) {
    return (
      <div className={cn('py-8 text-center text-sm text-gray-500', className)}>{emptyMessage}</div>
    );
  }

  return (
    <ol role="list" className={cn('relative space-y-4 border-r-2 border-gray-100 pr-5', className)}>
      {entries.map((entry, idx) => {
        const style = TYPE_STYLES[entry.type] ?? TYPE_STYLES.note!;
        const status = entry.meta?.status as string | undefined;
        return (
          <li key={`${entry.at}-${idx}`} className="relative">
            {/* Node dot */}
            <span
              aria-hidden
              className={cn(
                'absolute -right-[31px] flex h-7 w-7 items-center justify-center rounded-full text-xs ring-4 ring-white',
                style.bg,
                style.ring,
              )}
            >
              {style.icon}
            </span>

            <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm transition-shadow hover:shadow-md">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className={cn('text-sm font-semibold', style.label)}>{entry.title}</p>
                <time className="text-xs text-gray-400" dateTime={entry.at}>
                  {formatDateTime(entry.at)}
                </time>
              </div>

              {status && (
                <span
                  className={cn(
                    'mt-2 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium',
                    STATUS_BADGE[status] ?? 'bg-gray-100 text-gray-700',
                  )}
                >
                  {entry.meta?.statusFa ? String(entry.meta.statusFa) : status}
                </span>
              )}

              {entry.description && (
                <p className="mt-1.5 text-sm leading-6 text-gray-600">{entry.description}</p>
              )}

              {showActor && entry.actorName && (
                <p className="mt-1.5 text-xs text-gray-400">توسط: {entry.actorName}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default RequestTimeline;
