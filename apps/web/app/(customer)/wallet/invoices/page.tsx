'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { MobileHeader } from '@/components/common/MobileHeader';
import { invoicesApi } from '@/lib/api/wallet';
import { formatJalaliDate, formatToman } from '@/lib/format';
import { INVOICE_STATUS_LABELS } from '@/lib/status-meta';
import { cn } from '@/lib/utils';

/**
 * Invoices list (7.8.5 entry) — all customer invoices.
 */

const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  issued: 'bg-blue-50 text-blue-700',
  paid: 'bg-emerald-50 text-emerald-700',
  void: 'bg-red-50 text-red-600',
};

export default function InvoicesPage() {
  const invoices = useQuery({
    queryKey: ['invoices', 1],
    queryFn: () => invoicesApi.list({ page: 1, limit: 20 }),
  });

  const items = invoices.data?.items ?? [];

  return (
    <>
      <MobileHeader title="صورت‌حساب‌ها" showBack showBell={false} />
      <div className="pt-3">
        {invoices.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-gray-200/80" />
            ))}
          </div>
        ) : invoices.isError ? (
          <ErrorState onRetry={() => invoices.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            title="صورت‌حسابی یافت نشد"
            description="صورت‌حساب‌ها پس از تأیید هزینه درخواست‌ها صادر می‌شوند"
          />
        ) : (
          <div className="space-y-3">
            {items.map((inv) => (
              <Link
                key={inv.id}
                href={`/wallet/invoices/${inv.id}`}
                className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm active:bg-gray-50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 dir="ltr" className="truncate text-sm font-bold text-gray-900">
                      {inv.invoiceNumber}
                    </h3>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold',
                        STATUS_COLOR[inv.status] ?? 'bg-gray-100 text-gray-600',
                      )}
                    >
                      {INVOICE_STATUS_LABELS[inv.status] ?? inv.status}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-xs">
                    <span className="text-gray-400">{formatJalaliDate(inv.createdAt)}</span>
                    <span className="font-extrabold text-gray-800">
                      {formatToman(inv.finalTotal)}
                    </span>
                  </div>
                </div>
                <ChevronLeft className="h-4 w-4 shrink-0 text-gray-300" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
