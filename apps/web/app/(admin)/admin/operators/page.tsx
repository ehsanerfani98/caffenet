'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, PauseCircle, PlayCircle, Search, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { DataTable, type DataTableColumn } from '@/components/admin/DataTable';
import { PageHeader } from '@/components/admin/PageHeader';
import { Pagination } from '@/components/admin/Pagination';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { toast } from '@/components/ui/use-toast';
import { adminOperatorsApi, type OperatorDto } from '@/lib/api/admin';
import { toPersianDigits } from '@/lib/format';

/**
 * Operators management (9.4) — list with stats columns (9.4.1/9.4.4),
 * create operator (9.4.2), activate/suspend toggle (9.4.4).
 */

interface CreateForm {
  phone: string;
  password: string;
  fullName: string;
  email: string;
}

const EMPTY_FORM: CreateForm = { phone: '', password: '', fullName: '', email: '' };

function randomPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export default function AdminOperatorsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [suspendTarget, setSuspendTarget] = useState<OperatorDto | null>(null);
  const [createdCreds, setCreatedCreds] = useState<{ phone: string; password: string } | null>(
    null,
  );

  const operators = useQuery({
    queryKey: ['admin-operators', page, search, statusFilter],
    queryFn: () =>
      adminOperatorsApi.list({
        page,
        search: search || undefined,
        status: statusFilter || undefined,
      }),
  });

  const data = operators.data;

  const createMutation = useMutation({
    mutationFn: () =>
      adminOperatorsApi.create({
        phone: form.phone.trim(),
        password: form.password,
        fullName: form.fullName.trim() || undefined,
        email: form.email.trim() || undefined,
      }),
    onSuccess: (_res) => {
      toast({ title: 'اپراتور ایجاد شد' });
      setCreatedCreds({ phone: form.phone.trim(), password: form.password });
      setForm(EMPTY_FORM);
      setShowCreate(false);
      void queryClient.invalidateQueries({ queryKey: ['admin-operators'] });
    },
    onError: (e) => toast({ title: 'ایجاد اپراتور ناموفق بود', description: e.message }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'suspended' }) =>
      adminOperatorsApi.setStatus(id, status),
    onSuccess: () => {
      toast({ title: 'وضعیت اپراتور تغییر کرد' });
      setSuspendTarget(null);
      void queryClient.invalidateQueries({ queryKey: ['admin-operators'] });
    },
    onError: (e) => {
      toast({ title: 'تغییر وضعیت ناموفق بود', description: e.message });
      setSuspendTarget(null);
    },
  });

  const columns: Array<DataTableColumn<OperatorDto>> = [
    {
      key: 'fullName',
      header: 'اپراتور',
      render: (o) => (
        <div className="min-w-0">
          <Link
            href={`/admin/users/${o.id}`}
            className="hover:text-brand-600 truncate font-bold text-gray-900"
          >
            {o.fullName ?? '—'}
          </Link>
          <p dir="ltr" className="text-right text-[11px] text-gray-400">
            {o.phone}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'وضعیت',
      render: (o) => (
        <span
          className={
            o.status === 'active'
              ? 'border-brand-200 bg-brand-50 text-brand-700 inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold'
              : 'inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700'
          }
        >
          {o.status === 'active' ? 'فعال' : 'تعلیق'}
        </span>
      ),
    },
    {
      key: 'currentlyAssigned',
      header: 'در جریان',
      render: (o) => toPersianDigits(o.stats.currentlyAssigned),
    },
    {
      key: 'completedTotal',
      header: 'تکمیل‌شده',
      render: (o) => toPersianDigits(o.stats.completedTotal),
    },
    {
      key: 'avgCompletionHours',
      header: 'میانگین انجام',
      render: (o) =>
        o.stats.avgCompletionHours === null
          ? '—'
          : `${toPersianDigits(o.stats.avgCompletionHours)} ساعت`,
    },
    {
      key: 'actions',
      header: 'عملیات',
      render: (o) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (o.status === 'active') setSuspendTarget(o);
            else statusMutation.mutate({ id: o.id, status: 'active' });
          }}
          className={
            o.status === 'active'
              ? 'inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-bold text-amber-700 hover:bg-amber-100'
              : 'border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100 inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold'
          }
        >
          {o.status === 'active' ? (
            <>
              <PauseCircle className="h-3.5 w-3.5" /> تعلیق
            </>
          ) : (
            <>
              <PlayCircle className="h-3.5 w-3.5" /> فعال‌سازی
            </>
          )}
        </button>
      ),
    },
  ];

  const submitSearch = () => {
    setPage(1);
    setSearch(searchInput.trim());
  };

  const total = data ? data.items.reduce((acc, o) => acc + o.stats.currentlyAssigned, 0) : 0;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="اپراتورها"
        description={
          data
            ? `${toPersianDigits(data.meta.total)} اپراتور — ${toPersianDigits(total)} درخواست در جریان`
            : 'ایجاد و مدیریت حساب‌های اپراتور'
        }
        actions={
          <button
            type="button"
            onClick={() => setShowCreate(true)}
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
              aria-label="جستجوی اپراتور"
              className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-3 pr-9 text-sm outline-none focus:bg-white"
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
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          aria-label="فیلتر وضعیت"
          className="focus:border-brand-400 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-xs font-medium text-gray-700 outline-none"
        >
          <option value="">همه وضعیت‌ها</option>
          <option value="active">فعال</option>
          <option value="suspended">تعلیق</option>
        </select>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        {operators.isError ? (
          <ErrorState title="خطا در دریافت اپراتورها" onRetry={() => operators.refetch()} />
        ) : !operators.isLoading && (data?.items ?? []).length === 0 ? (
          <EmptyState
            title="اپراتوری یافت نشد"
            description="با دکمه «ایجاد اپراتور» اولین حساب را بسازید"
            icon={<UserPlus className="h-8 w-8" />}
          />
        ) : (
          <DataTable
            columns={columns}
            rows={data?.items ?? []}
            loading={operators.isLoading}
            emptyText="اپراتوری یافت نشد"
          />
        )}
        <Pagination page={page} totalPages={data?.meta?.totalPages ?? 1} onChange={setPage} />
      </div>

      {/* ===== Create operator dialog (9.4.2) ===== */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="ایجاد اپراتور"
        >
          <div
            className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
            onClick={() => setShowCreate(false)}
            aria-hidden
          />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-base font-extrabold text-gray-900">ایجاد حساب اپراتور</h2>
            <p className="mt-1 text-xs text-gray-500">اطلاعات ورود را برای اپراتور ارسال کنید.</p>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-500">شماره موبایل *</span>
                <input
                  dir="ltr"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="09xxxxxxxxx"
                  className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-500">
                  رمز عبور * (حداقل ۸ نویسه)
                </span>
                <div className="flex gap-2">
                  <input
                    dir="ltr"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 font-mono text-sm outline-none focus:bg-white"
                  />
                  <button
                    type="button"
                    aria-label="تولید رمز"
                    onClick={() => setForm({ ...form, password: randomPassword() })}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50"
                  >
                    <KeyRound className="h-4 w-4" />
                  </button>
                </div>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-500">
                  نام و نام خانوادگی
                </span>
                <input
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-500">ایمیل</span>
                <input
                  dir="ltr"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:bg-white"
                />
              </label>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50"
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={createMutation.isPending}
                onClick={() => createMutation.mutate()}
                className="bg-brand-500 hover:bg-brand-600 rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {createMutation.isPending ? 'در حال ایجاد…' : 'ایجاد اپراتور'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Created credentials reveal */}
      {createdCreds && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="اطلاعات ورود اپراتور"
        >
          <div
            className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
            onClick={() => setCreatedCreds(null)}
            aria-hidden
          />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="flex items-center gap-2 text-base font-extrabold text-gray-900">
              <KeyRound className="text-brand-600 h-5 w-5" />
              اپراتور ایجاد شد
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              این اطلاعات را کپی و برای اپراتور ارسال کنید:
            </p>
            <div className="mt-4 space-y-2 rounded-xl bg-gray-50 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-xs text-gray-500">شماره</span>
                <span dir="ltr" className="font-mono font-bold text-gray-900">
                  {createdCreds.phone}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-xs text-gray-500">رمز عبور</span>
                <span dir="ltr" className="break-all text-left font-mono font-bold text-gray-900">
                  {createdCreds.password}
                </span>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  void navigator.clipboard?.writeText(
                    `${createdCreds.phone} / ${createdCreds.password}`,
                  )
                }
                className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50"
              >
                کپی
              </button>
              <button
                type="button"
                onClick={() => setCreatedCreds(null)}
                className="bg-brand-500 hover:bg-brand-600 rounded-xl px-4 py-2.5 text-sm font-bold text-white"
              >
                متوجه شدم
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suspend confirm */}
      <ConfirmDialog
        open={suspendTarget !== null}
        title="تعلیق اپراتور"
        description={`ورود «${suspendTarget?.fullName ?? suspendTarget?.phone ?? ''}» مسدود و نشست‌های فعال او باطل می‌شود. ادامه می‌دهید؟`}
        confirmLabel="تعلیق حساب"
        pending={statusMutation.isPending}
        onConfirm={() =>
          suspendTarget && statusMutation.mutate({ id: suspendTarget.id, status: 'suspended' })
        }
        onCancel={() => setSuspendTarget(null)}
      />
    </div>
  );
}
