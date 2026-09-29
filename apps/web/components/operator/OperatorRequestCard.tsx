'use client';

import { ChevronLeft, UserRound, UserPlus } from 'lucide-react';
import Link from 'next/link';
import type { RequestDto } from '@caffenet/shared';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/common/StatusBadge';
import { formatJalaliDateTime, formatToman } from '@/lib/format';

/**
 * OperatorRequestCard (8.3) — operator variant of the request row.
 * Shows the customer identity + an optional «تخصیص به من» self-assign action.
 * The card body is a link; the assign button is a sibling (never nested) so
 * both stay keyboard-accessible.
 */

interface OperatorRequestCardProps {
  request: RequestDto;
  /** Link target for the card body (defaults to the operator detail page) */
  href?: string;
  /** Render the self-assign button (only when allowed + unassigned) */
  showAssign?: boolean;
  assignPending?: boolean;
  onAssign?: () => void;
  /** Trailing chevron — useful in lists, off in dense grids */
  showChevron?: boolean;
}

export function OperatorRequestCard({
  request,
  href,
  showAssign = false,
  assignPending = false,
  onAssign,
  showChevron = true,
}: OperatorRequestCardProps) {
  const customerName = request.customer?.fullName ?? request.customer?.phone ?? '—';

  return (
    <div className="flex items-stretch gap-2 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <Link
        href={href ?? `/operator/requests/${request.id}`}
        className="min-w-0 flex-1"
        aria-label={`جزئیات درخواست ${request.service?.name ?? request.trackingCode}`}
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="truncate text-sm font-bold text-gray-900">
            {request.service?.name ?? 'درخواست'}
          </h3>
          <StatusBadge status={String(request.status)} />
        </div>

        <p dir="ltr" className="mt-1 text-right font-mono text-xs text-gray-400">
          {request.trackingCode}
        </p>

        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-600">
          <UserRound className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          <span className="truncate">{customerName}</span>
        </p>

        <div className="mt-1.5 flex items-center justify-between text-xs">
          <span className="text-gray-400">{formatJalaliDateTime(request.createdAt)}</span>
          {request.finalTotal > 0 && (
            <span className="font-semibold text-gray-700">{formatToman(request.finalTotal)}</span>
          )}
        </div>
      </Link>

      <div className="flex shrink-0 flex-col items-center justify-center gap-2">
        {showAssign && onAssign && (
          <Button size="sm" onClick={onAssign} disabled={assignPending} className="gap-1.5">
            <UserPlus className="h-3.5 w-3.5" />
            {assignPending ? '…' : 'تخصیص به من'}
          </Button>
        )}
        {showChevron && (
          <ChevronLeft className="hidden h-4 w-4 text-gray-300 sm:block" aria-hidden />
        )}
      </div>
    </div>
  );
}
