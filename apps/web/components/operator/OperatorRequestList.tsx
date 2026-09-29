'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { ListSkeleton } from '@/components/common/Skeleton';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { OperatorRequestCard } from '@/components/operator/OperatorRequestCard';
import { OPERATOR_KEYS } from '@/components/operator/requests-cache';
import { operatorApi } from '@/lib/api/operator';
import { toPersianDigits } from '@/lib/format';
import { useAuthStore } from '@/lib/stores/auth-store';
import { REQUEST_STATUS_LABELS } from '@/lib/status-meta';

/**
 * OperatorRequestList — shared engine behind the Queue page (scope=all,
 * 8.3) and My Requests (scope=mine, 8.1.3): status tabs, debounced search,
 * sort (incl. «طولانی‌ترین انتظار» = asc + pending/reviewing), pagination.
 */

const STATUS_FILTERS: Array<{ key: string; label: string }> = [
  { key: '', label: 'همه' },
  { key: 'pending', label: REQUEST_STATUS_LABELS.pending ?? 'در انتظار بررسی' },
  { key: 'reviewing', label: REQUEST_STATUS_LABELS.reviewing ?? 'در حال بررسی' },
  {
    key: 'waiting_for_customer',
    label: REQUEST_STATUS_LABELS.waiting_for_customer ?? 'در انتظار مشتری',
  },
  { key: 'in_progress', label: REQUEST_STATUS_LABELS.in_progress ?? 'در حال انجام' },
  {
    key: 'waiting_for_payment',
    label: REQUEST_STATUS_LABELS.waiting_for_payment ?? 'در انتظار پرداخت',
  },
  { key: 'completed', label: REQUEST_STATUS_LABELS.completed ?? 'تکمیل شده' },
];

const SORT_OPTIONS = [
  { key: 'desc', label: 'جدیدترین' },
  { key: 'asc', label: 'قدیمی‌ترین' },
  { key: 'wait', label: 'طولانی‌ترین انتظار' },
] as const;

type SortKey = (typeof SORT_OPTIONS)[number]['key'];

/** Debounce any fast-changing value (search box). */
function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

interface OperatorRequestListProps {
  scope: 'mine' | 'all';
  emptyTitle: string;
  emptyDescription: string;
  /** Queue variant: allow self-assign directly from the card */
  showAssign?: boolean;
}

export function OperatorRequestList({
  scope,
  emptyTitle,
  emptyDescription,
  showAssign = false,
}: OperatorRequestListProps) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canAssign = user?.permissions.includes('requests.assign') ?? false;

  const [status, setStatus] = useState('');
  const [sort, setSort] = useState<SortKey>('desc');
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim(), 350);
  const [page, setPage] = useState(1);

  const effectiveStatus = sort === 'wait' ? 'pending,reviewing' : status || undefined;
  const effectiveSortDir: 'asc' | 'desc' = sort === 'wait' ? 'asc' : sort;

  const list = useQuery({
    queryKey: ['operator', 'requests', scope, effectiveStatus ?? '', sort, search, page],
    queryFn: () =>
      operatorApi.list({
        scope,
        status: effectiveStatus,
        search: search.length >= 2 ? search : undefined,
        sortDir: effectiveSortDir,
        page,
        perPage: 20,
      }),
    placeholderData: keepPreviousData,
  });

  const assign = useMutation({
    mutationFn: (requestId: string) =>
      operatorApi.assign(requestId, user ? { operatorId: Number(user.id) } : {}),
    onSuccess: (_result, requestId) => {
      toast({
        title: 'درخواست به شما تخصیص یافت',
        description: 'از فهرست «درخواست‌های من» قابل پیگیری است.',
      });
      void queryClient.invalidateQueries({ queryKey: OPERATOR_KEYS.lists });
      void queryClient.invalidateQueries({ queryKey: OPERATOR_KEYS.request(requestId) });
      void queryClient.invalidateQueries({ queryKey: OPERATOR_KEYS.dashboard });
    },
    onError: (e) => {
      toast({
        title: 'خطا در تخصیص درخواست',
        description: e instanceof Error ? e.message : 'لطفاً دوباره تلاش کنید',
      });
    },
  });

  const items = list.data?.items ?? [];
  const meta = list.data?.meta;
  const totalPages = meta?.totalPages ?? 1;

  const resetToFirstPage = () => setPage(1);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          dir="auto"
          placeholder="جستجو: کد رهگیری، نام مشتری، خدمت…"
          className="focus:border-brand-500 focus:ring-brand-100 w-full rounded-2xl border border-gray-100 bg-white py-3 pl-4 pr-10 text-sm shadow-sm focus:outline-none focus:ring-2"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            resetToFirstPage();
          }}
        />
      </div>

      {/* Status tabs */}
      <div
        className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4"
        role="tablist"
        aria-label="فیلتر وضعیت"
      >
        {STATUS_FILTERS.map((f) => {
          const active = sort !== 'wait' && status === f.key;
          return (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setStatus(f.key);
                setSort((s) => (s === 'wait' ? 'desc' : s));
                resetToFirstPage();
              }}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                active ? 'bg-brand-600 text-white' : 'border border-gray-200 bg-white text-gray-600'
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Sort */}
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-xs text-gray-500">
          <span className="shrink-0 font-bold">ترتیب:</span>
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as SortKey);
              resetToFirstPage();
            }}
            className="focus:border-brand-500 focus:ring-brand-100 rounded-xl border border-gray-200 bg-white px-2.5 py-2 text-xs font-bold text-gray-700 focus:outline-none focus:ring-2"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {meta && (
          <span className="shrink-0 text-[11px] text-gray-400">
            {toPersianDigits(meta.total)} درخواست
          </span>
        )}
      </div>

      {sort === 'wait' && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-700">
          حالت «طولانی‌ترین انتظار»: درخواست‌های بدون اپراتور (در انتظار بررسی / در حال بررسی) از
          قدیمی‌ترین به جدیدترین نمایش داده می‌شوند.
        </p>
      )}

      {/* List */}
      {list.isLoading ? (
        <ListSkeleton rows={5} />
      ) : list.isError ? (
        <ErrorState onRetry={() => void list.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <div className="space-y-3">
          {items.map((r) => (
            <OperatorRequestCard
              key={r.id}
              request={r}
              showAssign={
                showAssign &&
                canAssign &&
                !r.assignedOperatorId &&
                ['pending', 'reviewing'].includes(String(r.status))
              }
              assignPending={assign.isPending && assign.variables === r.id}
              onAssign={() => assign.mutate(r.id)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {meta && totalPages > 1 && (
        <nav className="flex items-center justify-between gap-3 pt-2" aria-label="صفحه‌بندی">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronRight className="h-4 w-4" />
            صفحه قبل
          </Button>
          <span className="text-xs font-bold tabular-nums text-gray-500">
            صفحه {toPersianDigits(page)} از {toPersianDigits(totalPages)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            صفحه بعد
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </nav>
      )}
    </div>
  );
}
