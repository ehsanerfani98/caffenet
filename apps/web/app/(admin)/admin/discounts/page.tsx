'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { History, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { DataTable, type DataTableColumn } from '@/components/admin/DataTable';
import { PageHeader } from '@/components/admin/PageHeader';
import { Pagination } from '@/components/admin/Pagination';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { toast } from '@/components/ui/use-toast';
import { adminDiscountsApi, type DiscountDto, type DiscountUsageDto } from '@/lib/api/admin';
import { formatJalaliDate, formatToman, toPersianDigits } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Discount codes admin (9.8.6–9.8.7) — table + create/edit form +
 * usages drawer per code + usage stats columns.
 */

interface DiscountForm {
  id: string | null;
  code: string;
  type: 'percent' | 'fixed';
  value: string;
  minOrderAmount: string;
  maxDiscountAmount: string;
  usageLimit: string;
  usageLimitPerUser: string;
  startsAt: string; // yyyy-mm-dd
  expiresAt: string;
  active: boolean;
}

function emptyForm(): DiscountForm {
  return {
    id: null,
    code: '',
    type: 'percent',
    value: '',
    minOrderAmount: '',
    maxDiscountAmount: '',
    usageLimit: '',
    usageLimitPerUser: '',
    startsAt: new Date().toISOString().slice(0, 10),
    expiresAt: '',
    active: true,
  };
}

function discountToForm(d: DiscountDto): DiscountForm {
  return {
    id: d.id,
    code: d.code,
    type: (d.type as 'percent' | 'fixed') ?? 'percent',
    value: String(d.value),
    minOrderAmount: d.minOrderAmount ? String(d.minOrderAmount) : '',
    maxDiscountAmount: d.maxDiscountAmount ? String(d.maxDiscountAmount) : '',
    usageLimit: d.usageLimit ? String(d.usageLimit) : '',
    usageLimitPerUser: d.usageLimitPerUser ? String(d.usageLimitPerUser) : '',
    startsAt: (d.startsAt ?? '').slice(0, 10),
    expiresAt: d.expiresAt ? d.expiresAt.slice(0, 10) : '',
    active: d.active,
  };
}

export default function AdminDiscountsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<DiscountForm | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DiscountDto | null>(null);
  const [usagesOf, setUsagesOf] = useState<DiscountDto | null>(null);

  const discounts = useQuery({
    queryKey: ['admin-discounts', page, activeFilter, search],
    queryFn: () =>
      adminDiscountsApi.list({
        page,
        perPage: 20,
        active: activeFilter,
        search: search || undefined,
      }),
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['admin-discounts'] });

  const saveMutation = useMutation({
    mutationFn: () => {
      const f = form!;
      if (f.id) {
        return adminDiscountsApi.update(f.id, {
          active: f.active,
          valueToman: Number(f.value),
          minOrderAmountToman: f.minOrderAmount ? Number(f.minOrderAmount) : undefined,
          maxDiscountAmountToman: f.maxDiscountAmount ? Number(f.maxDiscountAmount) : undefined,
          usageLimit: f.usageLimit ? Number(f.usageLimit) : undefined,
          usageLimitPerUser: f.usageLimitPerUser ? Number(f.usageLimitPerUser) : undefined,
          expiresAt: f.expiresAt ? new Date(f.expiresAt).toISOString() : undefined,
        });
      }
      return adminDiscountsApi.create({
        code: f.code.trim().toUpperCase(),
        type: f.type,
        valueToman: Number(f.value),
        minOrderAmountToman: f.minOrderAmount ? Number(f.minOrderAmount) : undefined,
        maxDiscountAmountToman: f.maxDiscountAmount ? Number(f.maxDiscountAmount) : undefined,
        usageLimit: f.usageLimit ? Number(f.usageLimit) : undefined,
        usageLimitPerUser: f.usageLimitPerUser ? Number(f.usageLimitPerUser) : undefined,
        startsAt: new Date(f.startsAt).toISOString(),
        expiresAt: f.expiresAt ? new Date(f.expiresAt).toISOString() : undefined,
        active: f.active,
      });
    },
    onSuccess: () => {
      toast({ title: form?.id ? 'کد تخفیف ویرایش شد' : 'کد تخفیف ایجاد شد' });
      setForm(null);
      invalidate();
    },
    onError: (e) => toast({ title: 'ذخیره ناموفق بود', description: e.message }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      adminDiscountsApi.update(id, { active }),
    onSuccess: () => invalidate(),
    onError: (e) => toast({ title: 'تغییر وضعیت ناموفق بود', description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminDiscountsApi.remove(id),
    onSuccess: () => {
      toast({ title: 'کد تخفیف حذف شد' });
      setDeleteTarget(null);
      invalidate();
    },
    onError: (e) => {
      // Codes with usages cannot be hard-deleted (409) — deactivate instead
      toast({
        title: 'حذف ناموفق بود',
        description: `${e.message} — می‌توانید کد را غیرفعال کنید.`,
      });
      setDeleteTarget(null);
    },
  });

  const items = discounts.data?.items ?? [];

  const columns: Array<DataTableColumn<DiscountDto>> = [
    {
      key: 'code',
      header: 'کد',
      render: (d) => (
        <div>
          <p dir="ltr" className="text-right font-mono text-xs font-extrabold text-gray-900">
            {d.code}
          </p>
          <p className="text-[11px] text-gray-400">
            {d.type === 'percent' ? 'درصدی' : 'مبلغ ثابت'}
          </p>
        </div>
      ),
    },
    {
      key: 'value',
      header: 'مقدار',
      render: (d) => (
        <span className="text-xs font-bold text-gray-800">
          {d.type === 'percent' ? `${toPersianDigits(d.value)}٪` : formatToman(d.value)}
        </span>
      ),
    },
    {
      key: 'usedCount',
      header: 'استفاده',
      render: (d) => (
        <span className="text-xs text-gray-700">
          {toPersianDigits(d.usedCount)}
          {d.usageLimit ? ` از ${toPersianDigits(d.usageLimit)}` : ''}
        </span>
      ),
    },
    {
      key: 'expiresAt',
      header: 'انقضا',
      render: (d) => <span className="text-xs text-gray-500">{formatJalaliDate(d.expiresAt)}</span>,
    },
    {
      key: 'active',
      header: 'وضعیت',
      render: (d) => (
        <label
          className="inline-flex cursor-pointer items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={d.active}
            onChange={(e) => toggleActiveMutation.mutate({ id: d.id, active: e.target.checked })}
            className="accent-brand-600 h-4 w-4"
            aria-label={`فعال‌سازی کد ${d.code}`}
          />
          <span
            className={cn('text-[11px] font-bold', d.active ? 'text-brand-700' : 'text-gray-400')}
          >
            {d.active ? 'فعال' : 'غیرفعال'}
          </span>
        </label>
      ),
    },
    {
      key: 'actions',
      header: 'عملیات',
      render: (d) => (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="سابقه استفاده"
            onClick={(e) => {
              e.stopPropagation();
              setUsagesOf(d);
            }}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
          >
            <History className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="ویرایش"
            onClick={(e) => {
              e.stopPropagation();
              setForm(discountToForm(d));
            }}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="حذف"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteTarget(d);
            }}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-500 hover:bg-red-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="کدهای تخفیف"
        description={
          discounts.data
            ? `${toPersianDigits(discounts.data.meta.total)} کد`
            : 'ایجاد و مدیریت کدهای تخفیف'
        }
        actions={
          <button
            type="button"
            onClick={() => setForm(emptyForm())}
            className="bg-brand-500 hover:bg-brand-600 inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold text-white"
          >
            <Plus className="h-4 w-4" />
            کد جدید
          </button>
        }
      />

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 sm:max-w-xs">
            <Search
              className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              aria-hidden
            />
            <input
              type="search"
              dir="ltr"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setPage(1);
                  setSearch(searchInput.trim());
                }
              }}
              placeholder="SEARCH…"
              aria-label="جستجوی کد"
              className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-3 pr-9 text-sm outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setPage(1);
              setSearch(searchInput.trim());
            }}
            className="shrink-0 rounded-xl bg-gray-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-gray-800"
          >
            جستجو
          </button>
        </div>
        <select
          value={activeFilter}
          onChange={(e) => {
            setActiveFilter(e.target.value as 'all' | 'active' | 'inactive');
            setPage(1);
          }}
          aria-label="فیلتر وضعیت"
          className="focus:border-brand-400 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-xs font-medium text-gray-700 outline-none"
        >
          <option value="all">همه</option>
          <option value="active">فعال</option>
          <option value="inactive">غیرفعال</option>
        </select>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        {discounts.isError ? (
          <ErrorState title="خطا در دریافت کدها" onRetry={() => discounts.refetch()} />
        ) : !discounts.isLoading && items.length === 0 ? (
          <EmptyState title="کد تخفیفی یافت نشد" description="اولین کد تخفیف را ایجاد کنید" />
        ) : (
          <DataTable
            columns={columns}
            rows={items}
            loading={discounts.isLoading}
            emptyText="کد تخفیفی یافت نشد"
          />
        )}
        <Pagination
          page={page}
          totalPages={discounts.data?.meta?.totalPages ?? 1}
          onChange={setPage}
        />
      </div>

      {/* ===== Create / edit form ===== */}
      {form && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="فرم کد تخفیف"
        >
          <div
            className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
            onClick={() => setForm(null)}
            aria-hidden
          />
          <div className="relative max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-base font-extrabold text-gray-900">
              {form.id ? `ویرایش کد ${form.code}` : 'کد تخفیف جدید'}
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-500">
                  کد * {form.id && '(غیرقابل تغییر)'}
                </span>
                <input
                  dir="ltr"
                  value={form.code}
                  disabled={!!form.id}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="WELCOME10"
                  className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 font-mono text-sm outline-none focus:bg-white disabled:opacity-60"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-500">نوع *</span>
                <select
                  value={form.type}
                  disabled={!!form.id}
                  onChange={(e) =>
                    setForm({ ...form, type: e.target.value as 'percent' | 'fixed' })
                  }
                  className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:bg-white disabled:opacity-60"
                >
                  <option value="percent">درصدی</option>
                  <option value="fixed">مبلغ ثابت (تومان)</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-500">
                  {form.type === 'percent' ? 'مقدار (۱ تا ۱۰۰) *' : 'مبلغ (تومان) *'}
                </span>
                <input
                  dir="ltr"
                  type="number"
                  min={1}
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:bg-white"
                />
              </label>
              {form.type === 'percent' && (
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-gray-500">
                    سقف مبلغ تخفیف (تومان)
                  </span>
                  <input
                    dir="ltr"
                    type="number"
                    min={0}
                    value={form.maxDiscountAmount}
                    onChange={(e) => setForm({ ...form, maxDiscountAmount: e.target.value })}
                    className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:bg-white"
                  />
                </label>
              )}
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-500">
                  حداقل مبلغ سفارش (تومان)
                </span>
                <input
                  dir="ltr"
                  type="number"
                  min={0}
                  value={form.minOrderAmount}
                  onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })}
                  className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-500">سقف کل استفاده</span>
                <input
                  dir="ltr"
                  type="number"
                  min={1}
                  value={form.usageLimit}
                  onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
                  className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-500">سقف per-user</span>
                <input
                  dir="ltr"
                  type="number"
                  min={1}
                  value={form.usageLimitPerUser}
                  onChange={(e) => setForm({ ...form, usageLimitPerUser: e.target.value })}
                  className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-500">شروع اعتبار *</span>
                <input
                  dir="ltr"
                  type="date"
                  value={form.startsAt}
                  disabled={!!form.id}
                  onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                  className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:bg-white disabled:opacity-60"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-500">پایان اعتبار</span>
                <input
                  dir="ltr"
                  type="date"
                  value={form.expiresAt}
                  onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                  className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:bg-white"
                />
              </label>
              <label className="flex items-center justify-between rounded-xl border border-gray-100 p-3 sm:col-span-2">
                <span className="text-xs font-bold text-gray-700">فعال</span>
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="accent-brand-600 h-4 w-4"
                />
              </label>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm(null)}
                className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50"
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={
                  saveMutation.isPending || !form.value || (!form.id && form.code.trim().length < 3)
                }
                onClick={() => saveMutation.mutate()}
                className="bg-brand-500 hover:bg-brand-600 rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {saveMutation.isPending ? 'در حال ذخیره…' : 'ذخیره'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Usages drawer ===== */}
      {usagesOf && <UsagesDrawer discount={usagesOf} onClose={() => setUsagesOf(null)} />}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="حذف کد تخفیف"
        description={`کد «${deleteTarget?.code ?? ''}» حذف می‌شود. کدهای دارای سابقه استفاده قابل حذف نیستند و باید غیرفعال شوند.`}
        confirmLabel="حذف"
        pending={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

// ===========================================================================
// Usages drawer (9.8.7)
// ===========================================================================

function UsagesDrawer({ discount, onClose }: { discount: DiscountDto; onClose: () => void }) {
  const usages = useQuery({
    queryKey: ['admin-discount-usages', discount.id],
    queryFn: () => adminDiscountsApi.usages(discount.id),
  });

  const rows = usages.data?.usages ?? [];

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label={`سابقه استفاده از ${discount.code}`}
    >
      <div
        className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="absolute inset-y-0 left-0 flex w-full max-w-md flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 dir="ltr" className="text-right font-mono text-sm font-extrabold text-gray-900">
              {discount.code}
            </h2>
            <p className="mt-0.5 text-[11px] text-gray-400">
              {toPersianDigits(discount.usedCount)} استفاده ثبت‌شده
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
        <div className="max-h-96 flex-1 overflow-y-auto p-4 [scrollbar-width:thin]">
          {usages.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-gray-200/70" />
              ))}
            </div>
          ) : usages.isError ? (
            <ErrorState title="خطا در دریافت سابقه" onRetry={() => usages.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState title="هنوز استفاده نشده" description="این کد تاکنون مصرف نشده است" />
          ) : (
            <ul className="space-y-2">
              {(rows as DiscountUsageDto[]).map((u) => (
                <li
                  key={u.id}
                  className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2.5"
                >
                  <div>
                    <p className="text-xs font-bold text-gray-800">
                      درخواست #{toPersianDigits(u.requestId)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-gray-400">{formatJalaliDate(u.usedAt)}</p>
                  </div>
                  <span className="text-brand-700 text-xs font-extrabold">
                    {formatToman(u.amountSaved)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
