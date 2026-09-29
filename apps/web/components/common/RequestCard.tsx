'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import type { RequestDto } from '@caffenet/shared';
import { StatusBadge } from './StatusBadge';
import { formatJalaliDateTime, formatToman } from '@/lib/format';

/**
 * RequestCard (7.7.4) — summary row in the requests list / home.
 */
export function RequestCard({ request }: { request: RequestDto }) {
  return (
    <Link
      href={`/requests/${request.id}`}
      className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm active:bg-gray-50"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="truncate text-sm font-bold text-gray-900">
            {request.service?.name ?? 'درخواست'}
          </h3>
          <StatusBadge status={String(request.status)} />
        </div>
        <p className="mt-1 text-xs text-gray-500" dir="ltr">
          {request.trackingCode}
        </p>
        <div className="mt-1.5 flex items-center justify-between text-xs">
          <span className="text-gray-400">{formatJalaliDateTime(request.createdAt)}</span>
          {request.finalTotal > 0 && (
            <span className="font-semibold text-gray-700">{formatToman(request.finalTotal)}</span>
          )}
        </div>
      </div>
      <ChevronLeft className="h-4 w-4 shrink-0 text-gray-300" />
    </Link>
  );
}
