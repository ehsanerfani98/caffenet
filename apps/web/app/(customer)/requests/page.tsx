'use client';

import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { MobileHeader } from '@/components/common/MobileHeader';
import { RequestCard } from '@/components/common/RequestCard';
import { ListSkeleton } from '@/components/common/Skeleton';
import { requestsApi } from '@/lib/api/requests';
import { REQUEST_STATUS_LABELS } from '@/lib/status-meta';

/**
 * My requests list (7.7.1) — status filter chips + search by tracking code.
 */

const STATUS_FILTERS: Array<{ key: string; label: string }> = [
  { key: '', label: 'همه' },
  { key: 'pending', label: REQUEST_STATUS_LABELS.pending ?? 'در انتظار بررسی' },
  { key: 'in_progress', label: REQUEST_STATUS_LABELS.in_progress ?? 'در حال انجام' },
  {
    key: 'waiting_for_payment',
    label: REQUEST_STATUS_LABELS.waiting_for_payment ?? 'در انتظار پرداخت',
  },
  { key: 'completed', label: REQUEST_STATUS_LABELS.completed ?? 'تکمیل شده' },
];

export default function RequestsPage() {
  const [status, setStatus] = useState('');
  const [code, setCode] = useState('');

  const list = useQuery({
    queryKey: ['requests', 'list', status],
    queryFn: () => requestsApi.list({ page: 1, limit: 20, status: status || undefined }),
  });

  const byCode = useQuery({
    queryKey: ['requests', 'by-code', code],
    queryFn: () => requestsApi.byTrackingCode(code.trim()),
    enabled: code.trim().length >= 4,
    retry: false,
  });

  const items = list.data?.items ?? [];
  const codeResult = byCode.data;
  const filtered = codeResult && code.trim().length >= 4 ? [codeResult] : items;

  return (
    <>
      <MobileHeader title="درخواست‌های من" showBell />
      <div className="pt-3">
        {/* Search by tracking code */}
        <div className="relative mb-3">
          <Search className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            dir="ltr"
            placeholder="RRN… / کد رهگیری"
            className="focus:border-brand-500 focus:ring-brand-100 w-full rounded-2xl border border-gray-100 bg-white py-3 pl-4 pr-10 text-sm shadow-sm focus:outline-none focus:ring-2"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>

        {/* Status filter chips */}
        <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => {
                setStatus(f.key);
                setCode('');
              }}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                status === f.key
                  ? 'bg-brand-600 text-white'
                  : 'border border-gray-200 bg-white text-gray-600'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {list.isLoading ? (
          <ListSkeleton rows={5} />
        ) : list.isError ? (
          <ErrorState onRetry={() => list.refetch()} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={code ? 'درخواستی با این کد یافت نشد' : 'درخواستی یافت نشد'}
            description={
              code
                ? 'کد رهگیری را بررسی کنید یا فیلتر «همه» را انتخاب کنید'
                : 'با ثبت اولین درخواست، وضعیت آن اینجا نمایش داده می‌شود'
            }
          />
        ) : (
          <div className="space-y-3">
            {filtered.map((r) => (
              <RequestCard key={r.id} request={r} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
