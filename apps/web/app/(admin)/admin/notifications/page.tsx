'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Send } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/admin/PageHeader';
import { Pagination } from '@/components/admin/Pagination';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { toast } from '@/components/ui/use-toast';
import { adminNotificationsApi, type BroadcastItemDto } from '@/lib/api/admin';
import { formatJalaliDateTime, toPersianDigits } from '@/lib/format';

/**
 * Broadcast notifications (9.9.2–9.9.3) — send form (title/body/audience/type)
 * + history table. Push subscriptions list intentionally deferred (Phase 11).
 */

const AUDIENCES: Array<{ key: 'all' | 'customers' | 'operators'; label: string }> = [
  { key: 'all', label: 'همه کاربران' },
  { key: 'customers', label: 'فقط مشتریان' },
  { key: 'operators', label: 'فقط اپراتورها' },
];

const TYPES = [
  { key: '', label: 'سیستمی (پیش‌فرض)' },
  { key: 'system', label: 'سیستمی' },
  { key: 'request', label: 'درخواست' },
  { key: 'wallet', label: 'کیف پول' },
  { key: 'message', label: 'پیام' },
  { key: 'marketing', label: 'تبلیغاتی' },
];

const AUDIENCE_FA: Record<string, string> = {
  all: 'همه',
  customers: 'مشتریان',
  operators: 'اپراتورها',
};

export default function AdminNotificationsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<'all' | 'customers' | 'operators'>('all');
  const [type, setType] = useState('');

  const history = useQuery({
    queryKey: ['admin-broadcasts', page],
    queryFn: () => adminNotificationsApi.history({ page, perPage: 15 }),
  });

  const broadcastMutation = useMutation({
    mutationFn: () =>
      adminNotificationsApi.broadcast({
        title: title.trim(),
        body: body.trim() || undefined,
        audience,
        type: type || undefined,
      }),
    onSuccess: (res) => {
      toast({
        title: 'اعلان همگانی ارسال شد',
        description: `برای ${toPersianDigits(res.recipients)} کاربر ثبت شد`,
      });
      setTitle('');
      setBody('');
      void queryClient.invalidateQueries({ queryKey: ['admin-broadcasts'] });
    },
    onError: (e) => toast({ title: 'ارسال ناموفق بود', description: e.message }),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader title="اعلان‌ها" description="ارسال اعلان همگانی و مشاهده تاریخچه" />

      <div className="grid gap-5 lg:grid-cols-5">
        {/* ===== Broadcast form (9.9.2) ===== */}
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-extrabold text-gray-800">
            <Megaphone className="text-brand-600 h-4 w-4" />
            اعلان همگانی جدید
          </h2>
          <p className="mb-4 text-[11px] leading-relaxed text-gray-400">
            اعلان به صندوق اعلان‌های همه کاربران گروه انتخابی اضافه می‌شود.
          </p>
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-500">
                عنوان * (حداقل ۲ نویسه)
              </span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:bg-white"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-500">متن اعلان</span>
              <textarea
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:bg-white"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-500">مخاطبان *</span>
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value as 'all' | 'customers' | 'operators')}
                className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:bg-white"
              >
                {AUDIENCES.map((a) => (
                  <option key={a.key} value={a.key}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-500">نوع</span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:bg-white"
              >
                {TYPES.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={broadcastMutation.isPending || title.trim().length < 2}
              onClick={() => broadcastMutation.mutate()}
              className="bg-brand-500 hover:bg-brand-600 inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-xs font-bold text-white disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
              {broadcastMutation.isPending ? 'در حال ارسال…' : 'ارسال اعلان'}
            </button>
          </div>
        </section>

        {/* ===== History (9.9.3) ===== */}
        <section className="rounded-2xl border border-gray-100 bg-white shadow-sm lg:col-span-3">
          <div className="border-b border-gray-100 px-5 py-3">
            <h2 className="text-sm font-extrabold text-gray-800">تاریخچه ارسال</h2>
          </div>
          <div className="p-4">
            {history.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded-xl bg-gray-200/70" />
                ))}
              </div>
            ) : history.isError ? (
              <ErrorState title="خطا در دریافت تاریخچه" onRetry={() => history.refetch()} />
            ) : (history.data?.items ?? []).length === 0 ? (
              <EmptyState
                title="اعلانی ارسال نشده"
                description="اولین اعلان همگانی را ارسال کنید"
              />
            ) : (
              <>
                <ul className="divide-y divide-gray-100">
                  {(history.data!.items as BroadcastItemDto[]).map((b) => (
                    <li key={b.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-extrabold text-gray-900">{b.title}</p>
                        <p className="mt-0.5 text-[11px] text-gray-400">
                          {AUDIENCE_FA[b.audience] ?? b.audience} · توسط {b.actorName} ·{' '}
                          {formatJalaliDateTime(b.createdAt)}
                        </p>
                      </div>
                      <span className="bg-brand-50 text-brand-700 shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold">
                        {toPersianDigits(b.recipients)} گیرنده
                      </span>
                    </li>
                  ))}
                </ul>
                <Pagination
                  page={page}
                  totalPages={history.data?.meta?.totalPages ?? 1}
                  onChange={setPage}
                />
              </>
            )}
          </div>
        </section>
      </div>

      {/* ===== Push subscriptions — Phase 11 placeholder ===== */}
      <section className="rounded-2xl border border-dashed border-gray-300 bg-gray-50/50">
        <EmptyState
          title="اشتراک‌های Push در فاز ۱۱ فعال می‌شود"
          description="ماژول Web Push هنوز پیاده‌سازی نشده است؛ پس از فعال‌سازی، مدیریت اشتراک‌ها اینجا نمایش داده می‌شود."
        />
      </section>
    </div>
  );
}
