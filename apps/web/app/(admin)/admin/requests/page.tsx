'use client';

import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { DataTable, type DataTableColumn } from '@/components/admin/DataTable';
import { PageHeader } from '@/components/admin/PageHeader';
import { Pagination } from '@/components/admin/Pagination';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { StatusBadge } from '@/components/common/StatusBadge';
import { adminRequestsApi } from '@/lib/api/admin';
import type { RequestDto } from '@caffenet/shared';
import { formatJalaliDateTime, formatToman, toPersianDigits } from '@/lib/format';

/**
 * All requests (9.7.1) — status tabs + search (code/description) + pagination.
 * Row click → admin request detail.
 */

const STATUS_TABS = [
  { key: '', label: 'همه' },
  { key: 'pending', label: 'در انتظار بررسی' },
  { key: 'reviewing', label: 'در حال بررسی' },
  { key: 'in_progress', label: 'در حال انجام' },
  { key: 'waiting_for_payment', label: 'در انتظار پرداخت' },
  { key: 'paid', label: 'پرداخت شده' },
  { key: 'completed', label: 'تکمیل شده' },
  { key: 'cancelled', label: 'لغو شده' },
  { key: 'rejected', label: 'رد شده' },
] as const;

export default function AdminRequestsPage() {
  const router = useRouter();
  const [status, setStatus] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const requests = useQuery({
    queryKey: ['admin-requests', page, status, search],
    queryFn: () =>
      adminRequestsApi.list({
        page,
        perPage: 15,
        status: status || undefined,
        search: search || undefined,
      }),
  });

  const data = requests.data;
  const items = data?.items ?? [];

  const columns: Array<DataTableColumn<RequestDto>> = [
    {
      key: 'trackingCode',
      header: 'کد رهگیری',
      render: (r) => (
        <div>
          <p dir="ltr" className="text-right font-mono text-xs font-bold text-gray-900">
            {r.trackingCode}
          </p>
          <p className="text-[11px] text-gray-400">{formatJalaliDateTime(r.createdAt)}</p>
        </div>
      ),
    },
    {
      key: 'service',
      header: 'خدمت',
      render: (r) => (
        <span className="text-xs font-medium text-gray-700">{r.service?.name ?? '—'}</span>
      ),
    },
    {
      key: 'customer',
      header: 'مشتری',
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-gray-700">
            {r.customer?.fullName ?? '—'}
          </p>
          <p dir="ltr" className="text-right text-[11px] text-gray-400">
            {r.customer?.phone ?? ''}
          </p>
        </div>
      ),
    },
    {
      key: 'assignedOperator',
      header: 'اپراتور',
      render: (r) => (
        <span className="text-xs text-gray-600">
          {r.assignedOperator?.fullName ?? 'تخصیص نیافته'}
        </span>
      ),
    },
    { key: 'status', header: 'وضعیت', render: (r) => <StatusBadge status={String(r.status)} /> },
    {
      key: 'finalTotal',
      header: 'مبلغ',
      render: (r) => (
        <span className="text-xs font-bold text-gray-800">{formatToman(r.finalTotal)}</span>
      ),
    },
  ];

  const submitSearch = () => {
    setPage(1);
    setSearch(searchInput.trim());
  };

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="درخواست‌ها"
        description={
          data ? `${toPersianDigits(data.meta.total)} درخواست` : 'مدیریت همه درخواست‌های سامانه'
        }
      />

      {/* Status tabs */}
      <div
        className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0"
        role="tablist"
        aria-label="فیلتر وضعیت"
      >
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={status === t.key}
            onClick={() => {
              setStatus(t.key);
              setPage(1);
            }}
            className={
              status === t.key
                ? 'bg-brand-600 shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold text-white'
                : 'shrink-0 rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50'
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1 sm:max-w-sm">
          <Search
            className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            aria-hidden
          />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitSearch()}
            placeholder="جستجوی کد رهگیری یا توضیحات…"
            aria-label="جستجوی درخواست"
            className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-3 pr-9 text-sm outline-none"
          />
        </div>
        <button
          type="button"
          onClick={submitSearch}
          className="shrink-0 rounded-xl bg-gray-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-gray-800"
        >
          جستجو
        </button>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        {requests.isError ? (
          <ErrorState title="خطا در دریافت درخواست‌ها" onRetry={() => requests.refetch()} />
        ) : !requests.isLoading && items.length === 0 ? (
          <EmptyState
            title="درخواستی یافت نشد"
            description="فیلتر وضعیت یا عبارت جستجو را تغییر دهید"
            icon={<ClipboardList className="h-8 w-8" />}
          />
        ) : (
          <DataTable
            columns={columns}
            rows={items}
            loading={requests.isLoading}
            emptyText="درخواستی یافت نشد"
            onRowClick={(r) => router.push(`/admin/requests/${r.id}`)}
          />
        )}
        <Pagination page={page} totalPages={data?.meta?.totalPages ?? 1} onChange={setPage} />
      </div>
    </div>
  );
}
