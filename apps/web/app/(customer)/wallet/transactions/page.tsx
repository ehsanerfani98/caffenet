'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { MobileHeader } from '@/components/common/MobileHeader';
import { TransactionItem } from '@/components/common/TransactionItem';
import { walletApi } from '@/lib/api/wallet';

/**
 * Transactions list (7.8.3) — paginated + type filter.
 */

const TYPE_FILTERS = [
  { key: '', label: 'همه' },
  { key: 'deposit', label: 'شارژ' },
  { key: 'service_payment', label: 'پرداخت خدمت' },
  { key: 'refund', label: 'بازگشت وجه' },
];

export default function TransactionsPage() {
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);

  const tx = useQuery({
    queryKey: ['wallet-transactions', page, type],
    queryFn: () => walletApi.transactions({ page, limit: 15, type: type || undefined }),
  });

  const data = tx.data;
  const totalPages = data?.pages ?? (Math.ceil((data?.total ?? 0) / (data?.limit ?? 15)) || 1);

  return (
    <>
      <MobileHeader title="تراکنش‌ها" showBack showBell={false} />
      <div className="pt-3">
        <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => {
                setType(f.key);
                setPage(1);
              }}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                type === f.key
                  ? 'bg-brand-600 text-white'
                  : 'border border-gray-200 bg-white text-gray-600'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {tx.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-200/80" />
            ))}
          </div>
        ) : tx.isError ? (
          <ErrorState onRetry={() => tx.refetch()} />
        ) : (data?.items ?? []).length === 0 ? (
          <EmptyState title="تراکنشی یافت نشد" description="با شارژ کیف پول شروع کنید" />
        ) : (
          <>
            <div className="space-y-2">
              {(data?.items ?? []).map((t) => (
                <TransactionItem key={t.id} transaction={t} />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 py-6">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-600 disabled:opacity-40"
                >
                  قبلی
                </button>
                <span className="text-xs text-gray-500">
                  صفحه {page} از {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-600 disabled:opacity-40"
                >
                  بعدی
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
