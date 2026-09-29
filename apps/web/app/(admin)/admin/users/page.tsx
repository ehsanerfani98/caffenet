'use client';

import { useQuery } from '@tanstack/react-query';
import { Search, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { DataTable, type DataTableColumn } from '@/components/admin/DataTable';
import { PageHeader } from '@/components/admin/PageHeader';
import { Pagination } from '@/components/admin/Pagination';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { adminUsersApi, type AdminUserDto } from '@/lib/api/admin';
import { formatJalaliDate, toPersianDigits } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Users list (9.3.1) — search + role filter + status filter + pagination.
 * Row click → /admin/users/[id].
 */

const ROLE_FILTERS = [
  { key: '', label: 'همه نقش‌ها' },
  { key: 'customer', label: 'مشتری' },
  { key: 'operator', label: 'اپراتور' },
  { key: 'admin', label: 'ادمین' },
];

const STATUS_FILTERS = [
  { key: '', label: 'همه وضعیت‌ها' },
  { key: 'active', label: 'فعال' },
  { key: 'suspended', label: 'تعلیق' },
  { key: 'banned', label: 'مسدود' },
  { key: 'pending_otp', label: 'در انتظار تأیید' },
];

const USER_STATUS_FA: Record<string, string> = {
  active: 'فعال',
  suspended: 'تعلیق',
  banned: 'مسدود',
  pending_otp: 'در انتظار تأیید',
};

const USER_STATUS_CLASS: Record<string, string> = {
  active: 'bg-brand-50 text-brand-700 border-brand-200',
  suspended: 'bg-amber-50 text-amber-700 border-amber-200',
  banned: 'bg-red-50 text-red-700 border-red-200',
  pending_otp: 'bg-gray-100 text-gray-600 border-gray-200',
};

const ROLE_FA: Record<string, string> = {
  customer: 'مشتری',
  operator: 'اپراتور',
  admin: 'ادمین',
};

function UserStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
        USER_STATUS_CLASS[status] ?? 'border-gray-200 bg-gray-100 text-gray-600',
      )}
    >
      {USER_STATUS_FA[status] ?? status}
    </span>
  );
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const users = useQuery({
    queryKey: ['admin-users', page, search, role, status],
    queryFn: () =>
      adminUsersApi.list({
        page,
        perPage: 15,
        search: search || undefined,
        role: role || undefined,
        status: status || undefined,
      }),
  });

  const data = users.data;
  const totalPages = data?.meta?.totalPages ?? 1;

  const columns: Array<DataTableColumn<AdminUserDto>> = [
    {
      key: 'fullName',
      header: 'کاربر',
      render: (u) => (
        <div className="min-w-0">
          <p className="truncate font-bold text-gray-900">{u.fullName ?? '—'}</p>
          <p dir="ltr" className="text-right text-[11px] text-gray-400">
            {u.phone}
          </p>
        </div>
      ),
    },
    {
      key: 'roles',
      header: 'نقش‌ها',
      render: (u) => (
        <div className="flex flex-wrap gap-1">
          {u.roles.length === 0 && <span className="text-xs text-gray-400">مشتری</span>}
          {u.roles.map((r) => (
            <span
              key={r.id}
              className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600"
            >
              {ROLE_FA[r.slug] ?? r.name}
            </span>
          ))}
        </div>
      ),
    },
    { key: 'status', header: 'وضعیت', render: (u) => <UserStatusBadge status={u.status} /> },
    {
      key: 'email',
      header: 'ایمیل',
      render: (u) => (
        <span className="text-xs text-gray-500" dir="ltr">
          {u.email ?? '—'}
        </span>
      ),
    },
    {
      key: 'lastLoginAt',
      header: 'آخرین ورود',
      render: (u) => (
        <span className="text-xs text-gray-500">{formatJalaliDate(u.lastLoginAt)}</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'تاریخ عضویت',
      render: (u) => <span className="text-xs text-gray-500">{formatJalaliDate(u.createdAt)}</span>,
    },
  ];

  const submitSearch = () => {
    setPage(1);
    setSearch(searchInput.trim());
  };

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="کاربران"
        description={
          data ? `${toPersianDigits(data.meta.total)} کاربر ثبت‌شده` : 'مدیریت کاربران سامانه'
        }
        actions={
          <button
            type="button"
            onClick={() => router.push('/admin/operators')}
            className="bg-brand-500 hover:bg-brand-600 inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold text-white transition-colors"
          >
            <UserPlus className="h-4 w-4" />
            ایجاد اپراتور
          </button>
        }
      />

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1">
            <Search
              className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              aria-hidden
            />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitSearch()}
              placeholder="جستجوی نام، شماره یا ایمیل…"
              aria-label="جستجوی کاربران"
              className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-3 pr-9 text-sm outline-none transition-colors focus:bg-white"
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
        <select
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setPage(1);
          }}
          aria-label="فیلتر نقش"
          className="focus:border-brand-400 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-xs font-medium text-gray-700 outline-none"
        >
          {ROLE_FILTERS.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          aria-label="فیلتر وضعیت"
          className="focus:border-brand-400 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-xs font-medium text-gray-700 outline-none"
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        {users.isError ? (
          <ErrorState title="خطا در دریافت کاربران" onRetry={() => users.refetch()} />
        ) : !users.isLoading && (data?.items ?? []).length === 0 ? (
          <EmptyState
            title="کاربری یافت نشد"
            description="فیلترها را تغییر دهید یا عبارت دیگری جستجو کنید"
          />
        ) : (
          <DataTable
            columns={columns}
            rows={data?.items ?? []}
            loading={users.isLoading}
            emptyText="کاربری یافت نشد"
            onRowClick={(u) => router.push(`/admin/users/${u.id}`)}
          />
        )}
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </div>
    </div>
  );
}
