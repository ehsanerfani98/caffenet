'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, FolderTree, Pencil, Plus, Search, Trash2, Wrench } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { DataTable, type DataTableColumn } from '@/components/admin/DataTable';
import { PageHeader } from '@/components/admin/PageHeader';
import { Pagination } from '@/components/admin/Pagination';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { toast } from '@/components/ui/use-toast';
import {
  adminCategoriesApi,
  adminServicesApi,
  type CategoryDto,
  type ServiceDto,
} from '@/lib/api/admin';
import { formatToman, toPersianDigits } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Catalog admin (9.6.1–9.6.5) — tabs:
 *  - دسته‌بندی‌ها: CRUD + reorder up/down (PATCH /admin/categories/reorder)
 *  - خدمات: CRUD + active toggle + form-builder link + pricing editor
 *    (laborFee 9.6.4 + defaultMaterialCost 9.6.5)
 */

type Tab = 'categories' | 'services';

interface CategoryForm {
  id: string | null;
  name: string;
  description: string;
  icon: string;
  active: boolean;
}

interface ServiceForm {
  id: string | null;
  name: string;
  categoryId: string;
  laborFee: string;
  defaultMaterialCost: string;
  estimatedDurationMin: string;
  description: string;
  icon: string;
  active: boolean;
  requiresFile: boolean;
  requiresCustomerInfo: boolean;
}

const EMPTY_CATEGORY: CategoryForm = {
  id: null,
  name: '',
  description: '',
  icon: '',
  active: true,
};
const EMPTY_SERVICE: ServiceForm = {
  id: null,
  name: '',
  categoryId: '',
  laborFee: '0',
  defaultMaterialCost: '0',
  estimatedDurationMin: '',
  description: '',
  icon: '',
  active: true,
  requiresFile: false,
  requiresCustomerInfo: false,
};

export default function AdminCatalogPage() {
  const [tab, setTab] = useState<Tab>('categories');
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="کاتالوگ خدمات" description="مدیریت دسته‌بندی‌ها، خدمات و فرم‌های پویا" />

      {/* Tabs */}
      <div className="mb-4 flex gap-2" role="tablist" aria-label="بخش‌های کاتالوگ">
        {(
          [
            { key: 'categories', label: 'دسته‌بندی‌ها', icon: FolderTree },
            { key: 'services', label: 'خدمات', icon: Wrench },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold transition-colors',
              tab === t.key
                ? 'bg-brand-600 text-white shadow-sm'
                : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'categories' ? <CategoriesTab /> : <ServicesTab />}
    </div>
  );
}

// ===========================================================================
// Categories tab (9.6.1)
// ===========================================================================

function CategoriesTab() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<CategoryForm | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CategoryDto | null>(null);
  const [reordering, setReordering] = useState(false);

  const categories = useQuery({
    queryKey: ['admin-categories', page, search],
    queryFn: () => adminCategoriesApi.list({ page, perPage: 20, search: search || undefined }),
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['admin-categories'] });

  const saveMutation = useMutation({
    mutationFn: () => {
      const f = form!;
      if (f.id) {
        return adminCategoriesApi.update(f.id, {
          name: f.name.trim(),
          description: f.description.trim() || undefined,
          icon: f.icon.trim() || undefined,
          active: f.active,
        });
      }
      return adminCategoriesApi.create({
        name: f.name.trim(),
        description: f.description.trim() || undefined,
        icon: f.icon.trim() || undefined,
        active: f.active,
      });
    },
    onSuccess: () => {
      toast({ title: form?.id ? 'دسته‌بندی ویرایش شد' : 'دسته‌بندی ایجاد شد' });
      setForm(null);
      invalidate();
    },
    onError: (e) => toast({ title: 'ذخیره ناموفق بود', description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminCategoriesApi.remove(id),
    onSuccess: () => {
      toast({ title: 'دسته‌بندی حذف شد' });
      setDeleteTarget(null);
      invalidate();
    },
    onError: (e) => {
      toast({ title: 'حذف ناموفق بود', description: e.message });
      setDeleteTarget(null);
    },
  });

  /** Move a category up/down and persist the new order (batch reorder). */
  const moveMutation = useMutation({
    mutationFn: async ({ items }: { items: Array<{ id: string; sortOrder: number }> }) =>
      adminCategoriesApi.reorder(items),
    onMutate: () => setReordering(true),
    onSettled: () => setReordering(false),
    onSuccess: () => {
      invalidate();
    },
    onError: (e) => toast({ title: 'جابجایی ناموفق بود', description: e.message }),
  });

  const items = categories.data?.items ?? [];

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const a = next[index]!;
    const b = next[target]!;
    next[index] = b;
    next[target] = a;
    moveMutation.mutate({ items: next.map((c, i) => ({ id: c.id, sortOrder: i })) });
  };

  const columns: Array<DataTableColumn<CategoryDto>> = [
    {
      key: 'name',
      header: 'دسته‌بندی',
      render: (c) => (
        <div className="min-w-0">
          <p className="truncate font-bold text-gray-900">{c.name}</p>
          <p dir="ltr" className="text-right text-[11px] text-gray-400">
            {c.slug}
          </p>
        </div>
      ),
    },
    {
      key: 'description',
      header: 'توضیحات',
      render: (c) => (
        <span className="line-clamp-1 text-xs text-gray-500">{c.description ?? '—'}</span>
      ),
    },
    {
      key: 'active',
      header: 'وضعیت',
      render: (c) => (
        <span
          className={
            c.active
              ? 'border-brand-200 bg-brand-50 text-brand-700 inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold'
              : 'inline-flex rounded-full border border-gray-200 bg-gray-100 px-2.5 py-0.5 text-[11px] font-semibold text-gray-500'
          }
        >
          {c.active ? 'فعال' : 'غیرفعال'}
        </span>
      ),
    },
    {
      key: 'order',
      header: 'ترتیب',
      render: (c) => {
        const index = items.findIndex((i) => i.id === c.id);
        return (
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="انتقال به بالا"
              disabled={index <= 0 || reordering}
              onClick={(e) => {
                e.stopPropagation();
                move(index, -1);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label="انتقال به پایین"
              disabled={index >= items.length - 1 || reordering}
              onClick={(e) => {
                e.stopPropagation();
                move(index, 1);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30"
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: 'عملیات',
      render: (c) => (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="ویرایش"
            onClick={(e) => {
              e.stopPropagation();
              setForm({
                id: c.id,
                name: c.name,
                description: c.description ?? '',
                icon: c.icon ?? '',
                active: c.active,
              });
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
              setDeleteTarget(c);
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
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 sm:max-w-xs">
            <Search
              className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              aria-hidden
            />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setPage(1);
                  setSearch(searchInput.trim());
                }
              }}
              placeholder="جستجوی دسته‌بندی…"
              aria-label="جستجوی دسته‌بندی"
              className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-3 pr-9 text-sm outline-none"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => setForm({ ...EMPTY_CATEGORY })}
          className="bg-brand-500 hover:bg-brand-600 inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold text-white"
        >
          <Plus className="h-4 w-4" />
          دسته‌بندی جدید
        </button>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        {categories.isError ? (
          <ErrorState title="خطا در دریافت دسته‌بندی‌ها" onRetry={() => categories.refetch()} />
        ) : !categories.isLoading && items.length === 0 ? (
          <EmptyState title="دسته‌بندی‌ای یافت نشد" description="اولین دسته‌بندی را ایجاد کنید" />
        ) : (
          <DataTable
            columns={columns}
            rows={items}
            loading={categories.isLoading}
            emptyText="دسته‌بندی‌ای یافت نشد"
          />
        )}
        <Pagination
          page={page}
          totalPages={categories.data?.meta?.totalPages ?? 1}
          onChange={setPage}
        />
      </div>

      {/* Category form dialog */}
      {form && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="فرم دسته‌بندی"
        >
          <div
            className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
            onClick={() => setForm(null)}
            aria-hidden
          />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-base font-extrabold text-gray-900">
              {form.id ? 'ویرایش دسته‌بندی' : 'دسته‌بندی جدید'}
            </h2>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-500">نام * </span>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-500">توضیحات</span>
                <input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-500">
                  آیکن (نام کتابخانه، مثل wifi)
                </span>
                <input
                  dir="ltr"
                  value={form.icon}
                  onChange={(e) => setForm({ ...form, icon: e.target.value })}
                  className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:bg-white"
                />
              </label>
              <label className="flex items-center justify-between rounded-xl border border-gray-100 p-3">
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
                disabled={saveMutation.isPending || form.name.trim().length < 2}
                onClick={() => saveMutation.mutate()}
                className="bg-brand-500 hover:bg-brand-600 rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {saveMutation.isPending ? 'در حال ذخیره…' : 'ذخیره'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="حذف دسته‌بندی"
        description={`«${deleteTarget?.name ?? ''}» حذف می‌شود (حذف نرم). خدمت‌های آن از دید مشتریان خارج می‌شوند.`}
        confirmLabel="حذف"
        pending={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

// ===========================================================================
// Services tab (9.6.2–9.6.5)
// ===========================================================================

function ServicesTab() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<ServiceForm | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ServiceDto | null>(null);

  const services = useQuery({
    queryKey: ['admin-services', page, search],
    queryFn: () => adminServicesApi.list({ page, perPage: 20, search: search || undefined }),
  });
  const categories = useQuery({
    queryKey: ['admin-categories', 1, ''],
    queryFn: () => adminCategoriesApi.list({ page: 1, perPage: 100 }),
    staleTime: 5 * 60_000,
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['admin-services'] });

  const saveMutation = useMutation({
    mutationFn: () => {
      const f = form!;
      const base = {
        name: f.name.trim(),
        categoryId: Number(f.categoryId),
        laborFee: Number(f.laborFee || 0),
        defaultMaterialCost: Number(f.defaultMaterialCost || 0),
        estimatedDurationMin: f.estimatedDurationMin ? Number(f.estimatedDurationMin) : undefined,
        description: f.description.trim() || undefined,
        icon: f.icon.trim() || undefined,
        active: f.active,
        requiresFile: f.requiresFile,
        requiresCustomerInfo: f.requiresCustomerInfo,
      };
      return f.id ? adminServicesApi.update(f.id, base) : adminServicesApi.create(base);
    },
    onSuccess: () => {
      toast({ title: form?.id ? 'خدمت ویرایش شد' : 'خدمت ایجاد شد' });
      setForm(null);
      invalidate();
    },
    onError: (e) => toast({ title: 'ذخیره ناموفق بود', description: e.message }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      adminServicesApi.update(id, { active }),
    onSuccess: () => invalidate(),
    onError: (e) => toast({ title: 'تغییر وضعیت ناموفق بود', description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminServicesApi.remove(id),
    onSuccess: () => {
      toast({ title: 'خدمت حذف شد' });
      setDeleteTarget(null);
      invalidate();
    },
    onError: (e) => {
      toast({ title: 'حذف ناموفق بود', description: e.message });
      setDeleteTarget(null);
    },
  });

  const items = services.data?.items ?? [];

  const columns: Array<DataTableColumn<ServiceDto>> = [
    {
      key: 'name',
      header: 'خدمت',
      render: (s) => (
        <div className="min-w-0">
          <p className="truncate font-bold text-gray-900">{s.name}</p>
          <p className="text-[11px] text-gray-400">{s.category?.name ?? '—'}</p>
        </div>
      ),
    },
    {
      key: 'laborFee',
      header: 'دستمزد پایه',
      render: (s) => (
        <span className="text-xs font-bold text-gray-700">{formatToman(s.laborFee)}</span>
      ),
    },
    {
      key: 'defaultMaterialCost',
      header: 'هزینه مصالح پیش‌فرض',
      render: (s) => (
        <span className="text-xs text-gray-500">{formatToman(s.defaultMaterialCost)}</span>
      ),
    },
    {
      key: 'fieldsCount',
      header: 'فیلدهای فرم',
      render: (s) => toPersianDigits(s.fieldsCount ?? 0),
    },
    {
      key: 'active',
      header: 'وضعیت',
      render: (s) => (
        <label
          className="inline-flex cursor-pointer items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={s.active}
            onChange={(e) => toggleActiveMutation.mutate({ id: s.id, active: e.target.checked })}
            className="accent-brand-600 h-4 w-4"
            aria-label={`فعال‌سازی خدمت ${s.name}`}
          />
          <span className="text-[11px] font-bold text-gray-600">
            {s.active ? 'فعال' : 'غیرفعال'}
          </span>
        </label>
      ),
    },
    {
      key: 'actions',
      header: 'عملیات',
      render: (s) => (
        <div className="flex items-center gap-1.5">
          <Link
            href={`/admin/services/${s.id}`}
            onClick={(e) => e.stopPropagation()}
            className="border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold"
          >
            فرم‌ساز
          </Link>
          <button
            type="button"
            aria-label="ویرایش خدمت"
            onClick={(e) => {
              e.stopPropagation();
              setForm({
                id: s.id,
                name: s.name,
                categoryId: s.categoryId,
                laborFee: String(s.laborFee),
                defaultMaterialCost: String(s.defaultMaterialCost),
                estimatedDurationMin: s.estimatedDurationMin ? String(s.estimatedDurationMin) : '',
                description: s.description ?? '',
                icon: s.icon ?? '',
                active: s.active,
                requiresFile: s.requiresFile,
                requiresCustomerInfo: s.requiresCustomerInfo,
              });
            }}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="حذف خدمت"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteTarget(s);
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
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 sm:max-w-xs">
            <Search
              className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              aria-hidden
            />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setPage(1);
                  setSearch(searchInput.trim());
                }
              }}
              placeholder="جستجوی خدمت…"
              aria-label="جستجوی خدمت"
              className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-3 pr-9 text-sm outline-none"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() =>
            setForm({ ...EMPTY_SERVICE, categoryId: categories.data?.items[0]?.id ?? '' })
          }
          className="bg-brand-500 hover:bg-brand-600 inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold text-white"
        >
          <Plus className="h-4 w-4" />
          خدمت جدید
        </button>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        {services.isError ? (
          <ErrorState title="خطا در دریافت خدمات" onRetry={() => services.refetch()} />
        ) : !services.isLoading && items.length === 0 ? (
          <EmptyState title="خدمتی یافت نشد" description="اولین خدمت را ایجاد کنید" />
        ) : (
          <DataTable
            columns={columns}
            rows={items}
            loading={services.isLoading}
            emptyText="خدمتی یافت نشد"
          />
        )}
        <Pagination
          page={page}
          totalPages={services.data?.meta?.totalPages ?? 1}
          onChange={setPage}
        />
      </div>

      {/* Service form dialog — pricing editor 9.6.4/9.6.5 */}
      {form && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="فرم خدمت"
        >
          <div
            className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
            onClick={() => setForm(null)}
            aria-hidden
          />
          <div className="relative max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-base font-extrabold text-gray-900">
              {form.id ? 'ویرایش خدمت' : 'خدمت جدید'}
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs font-medium text-gray-500">نام خدمت *</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-500">دسته‌بندی *</span>
                <select
                  value={form.categoryId}
                  onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                  className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:bg-white"
                >
                  <option value="">انتخاب کنید…</option>
                  {(categories.data?.items ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-500">
                  مدت تقریبی (دقیقه)
                </span>
                <input
                  dir="ltr"
                  type="number"
                  min={1}
                  value={form.estimatedDurationMin}
                  onChange={(e) => setForm({ ...form, estimatedDurationMin: e.target.value })}
                  className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:bg-white"
                />
              </label>
              {/* 9.6.4 — labor fee */}
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-500">
                  دستمزد پایه (تومان) *
                </span>
                <input
                  dir="ltr"
                  type="number"
                  min={0}
                  value={form.laborFee}
                  onChange={(e) => setForm({ ...form, laborFee: e.target.value })}
                  className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:bg-white"
                />
              </label>
              {/* 9.6.5 — default material cost */}
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-500">
                  هزینه مصالح پیش‌فرض (تومان)
                </span>
                <input
                  dir="ltr"
                  type="number"
                  min={0}
                  value={form.defaultMaterialCost}
                  onChange={(e) => setForm({ ...form, defaultMaterialCost: e.target.value })}
                  className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:bg-white"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs font-medium text-gray-500">توضیحات</span>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-500">آیکن</span>
                <input
                  dir="ltr"
                  value={form.icon}
                  onChange={(e) => setForm({ ...form, icon: e.target.value })}
                  className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:bg-white"
                />
              </label>
              <div className="space-y-2">
                <label className="flex items-center justify-between rounded-xl border border-gray-100 p-2.5">
                  <span className="text-xs font-bold text-gray-700">فعال</span>
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm({ ...form, active: e.target.checked })}
                    className="accent-brand-600 h-4 w-4"
                  />
                </label>
                <label className="flex items-center justify-between rounded-xl border border-gray-100 p-2.5">
                  <span className="text-xs font-bold text-gray-700">نیازمند فایل</span>
                  <input
                    type="checkbox"
                    checked={form.requiresFile}
                    onChange={(e) => setForm({ ...form, requiresFile: e.target.checked })}
                    className="accent-brand-600 h-4 w-4"
                  />
                </label>
                <label className="flex items-center justify-between rounded-xl border border-gray-100 p-2.5">
                  <span className="text-xs font-bold text-gray-700">نیازمند اطلاعات مشتری</span>
                  <input
                    type="checkbox"
                    checked={form.requiresCustomerInfo}
                    onChange={(e) => setForm({ ...form, requiresCustomerInfo: e.target.checked })}
                    className="accent-brand-600 h-4 w-4"
                  />
                </label>
              </div>
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
                disabled={saveMutation.isPending || form.name.trim().length < 2 || !form.categoryId}
                onClick={() => saveMutation.mutate()}
                className="bg-brand-500 hover:bg-brand-600 rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {saveMutation.isPending ? 'در حال ذخیره…' : 'ذخیره'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="حذف خدمت"
        description={`«${deleteTarget?.name ?? ''}» حذف می‌شود (حذف نرم). درخواست‌های قبلی حفظ می‌شوند.`}
        confirmLabel="حذف"
        pending={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
