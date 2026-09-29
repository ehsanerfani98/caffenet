'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GripVertical, Pencil, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/admin/PageHeader';
import { ErrorState } from '@/components/common/ErrorState';
import { ListSkeleton } from '@/components/common/Skeleton';
import { toast } from '@/components/ui/use-toast';
import { adminContactMethodsApi } from '@/lib/api/admin';
import { cn } from '@/lib/utils';

/**
 * Contact methods admin (9.9.1) — list with active toggles, reorder up/down,
 * inline add/edit form.
 */

interface CMForm {
  id: string | null;
  name: string;
  slug: string;
  description: string;
  icon: string;
  active: boolean;
}

const EMPTY: CMForm = { id: null, name: '', slug: '', description: '', icon: '', active: true };

export default function AdminContactMethodsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CMForm | null>(null);
  const [moving, setMoving] = useState(false);

  const methods = useQuery({
    queryKey: ['admin-contact-methods'],
    queryFn: adminContactMethodsApi.list,
  });

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ['admin-contact-methods'] });

  const saveMutation = useMutation({
    mutationFn: () => {
      const f = form!;
      if (f.id) {
        return adminContactMethodsApi.update(f.id, {
          name: f.name.trim() || undefined,
          description: f.description.trim() || undefined,
          icon: f.icon.trim() || undefined,
          active: f.active,
        });
      }
      return adminContactMethodsApi.create({
        name: f.name.trim(),
        slug: f.slug.trim(),
        description: f.description.trim() || undefined,
        icon: f.icon.trim() || undefined,
        active: f.active,
      });
    },
    onSuccess: () => {
      toast({ title: form?.id ? 'روش تماس ویرایش شد' : 'روش تماس ایجاد شد' });
      setForm(null);
      invalidate();
    },
    onError: (e) => toast({ title: 'ذخیره ناموفق بود', description: e.message }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      adminContactMethodsApi.update(id, { active }),
    onSuccess: () => invalidate(),
    onError: (e) => toast({ title: 'تغییر وضعیت ناموفق بود', description: e.message }),
  });

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: string[]) => adminContactMethodsApi.reorder(orderedIds),
    onMutate: () => setMoving(true),
    onSettled: () => setMoving(false),
    onSuccess: () => invalidate(),
    onError: (e) => toast({ title: 'جابجایی ناموفق بود', description: e.message }),
  });

  const items = methods.data ?? [];

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const a = next[index]!;
    const b = next[target]!;
    next[index] = b;
    next[target] = a;
    reorderMutation.mutate(next.map((m) => m.id));
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title="روش‌های تماس"
        description="روش‌هایی که مشتری هنگام ثبت درخواست برای تماس انتخاب می‌کند"
        actions={
          <button
            type="button"
            onClick={() => setForm({ ...EMPTY })}
            className="bg-brand-500 hover:bg-brand-600 inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold text-white"
          >
            <Plus className="h-4 w-4" />
            روش جدید
          </button>
        }
      />

      {methods.isLoading ? (
        <ListSkeleton rows={4} />
      ) : methods.isError ? (
        <ErrorState title="خطا در دریافت روش‌های تماس" onRetry={() => methods.refetch()} />
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center text-sm text-gray-500">
          هنوز روش تماسی تعریف نشده است
        </p>
      ) : (
        <ol className={cn('space-y-3 transition-opacity', moving && 'opacity-60')}>
          {items.map((m, index) => (
            <li
              key={m.id}
              className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
            >
              <GripVertical className="h-4 w-4 shrink-0 text-gray-300" aria-hidden />
              <div className="bg-brand-50 text-brand-700 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold">
                {index + 1}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-gray-900">{m.name}</p>
                <p dir="ltr" className="text-right text-[11px] text-gray-400">
                  {m.slug}
                  {m.description ? ` — ${m.description}` : ''}
                </p>
              </div>

              {/* Reorder */}
              <div className="flex shrink-0 flex-col gap-1">
                <button
                  type="button"
                  aria-label="انتقال به بالا"
                  disabled={index <= 0 || moving}
                  onClick={() => move(index, -1)}
                  className="rounded-md border border-gray-200 px-1.5 py-0.5 text-[10px] text-gray-500 hover:bg-gray-50 disabled:opacity-30"
                >
                  ▲
                </button>
                <button
                  type="button"
                  aria-label="انتقال به پایین"
                  disabled={index >= items.length - 1 || moving}
                  onClick={() => move(index, 1)}
                  className="rounded-md border border-gray-200 px-1.5 py-0.5 text-[10px] text-gray-500 hover:bg-gray-50 disabled:opacity-30"
                >
                  ▼
                </button>
              </div>

              {/* Active toggle */}
              <label className="flex shrink-0 cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={m.active}
                  onChange={(e) => toggleMutation.mutate({ id: m.id, active: e.target.checked })}
                  className="accent-brand-600 h-4 w-4"
                  aria-label={`فعال‌سازی ${m.name}`}
                />
                <span
                  className={cn(
                    'text-[11px] font-bold',
                    m.active ? 'text-brand-700' : 'text-gray-400',
                  )}
                >
                  {m.active ? 'فعال' : 'خاموش'}
                </span>
              </label>

              <button
                type="button"
                aria-label="ویرایش"
                onClick={() =>
                  setForm({
                    id: m.id,
                    name: m.name,
                    slug: m.slug,
                    description: m.description ?? '',
                    icon: m.icon ?? '',
                    active: m.active,
                  })
                }
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ol>
      )}

      {/* ===== Inline form dialog ===== */}
      {form && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="فرم روش تماس"
        >
          <div
            className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
            onClick={() => setForm(null)}
            aria-hidden
          />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-extrabold text-gray-900">
                {form.id ? 'ویرایش روش تماس' : 'روش تماس جدید'}
              </h2>
              <button
                type="button"
                aria-label="بستن"
                onClick={() => setForm(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-500">نام (فارسی) *</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="تلفن"
                  className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-500">
                  شناسه (slug انگلیسی) * {form.id && '— غیرقابل تغییر'}
                </span>
                <input
                  dir="ltr"
                  value={form.slug}
                  disabled={!!form.id}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="phone"
                  className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:bg-white disabled:opacity-60"
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
                  آیکن (نام کتابخانه)
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
                disabled={
                  saveMutation.isPending || (!form.id && (!form.name.trim() || !form.slug.trim()))
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
    </div>
  );
}
