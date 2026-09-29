'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, DollarSign, Eraser, UserPlus, XCircle } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { PageHeader } from '@/components/admin/PageHeader';
import { ErrorState } from '@/components/common/ErrorState';
import { DetailSkeleton } from '@/components/common/Skeleton';
import { RequestTimeline } from '@/components/common/RequestTimeline';
import { StatusBadge } from '@/components/common/StatusBadge';
import { toast } from '@/components/ui/use-toast';
import type { RequestDto, RequestTimelineEntryDto } from '@caffenet/shared';
import { adminRequestsApi, adminUsersApi, type OperatorDto } from '@/lib/api/admin';
import { formatJalaliDateTime, formatToman } from '@/lib/format';
import { PAYMENT_STATUS_LABELS } from '@/lib/status-meta';

/**
 * Admin request detail (9.7.2–9.7.5) — read-only overview + admin actions:
 *  - force status (including «paid» with Persian warning)  (9.7.3)
 *  - force-assign / auto-assign operator                   (9.7.2)
 *  - cancel with reason                                    (9.7.4)
 *  - remove applied discount                               (9.7.5)
 *  - timeline viewer
 */

const FORCE_STATUS_OPTIONS: Array<{ key: string; label: string; note?: string }> = [
  { key: 'reviewing', label: 'در حال بررسی' },
  { key: 'waiting_for_customer', label: 'در انتظار پاسخ مشتری' },
  { key: 'in_progress', label: 'در حال انجام' },
  {
    key: 'waiting_for_payment',
    label: 'در انتظار پرداخت',
    note: 'مشتری باید صورت‌حساب را پرداخت کند',
  },
  {
    key: 'paid',
    label: 'پرداخت شده (ثبت دستی)',
    note: 'هشدار: این وضعیت را فقط وقتی اعمال کنید که مبلغ به‌صورت دیگری (نقدی/خارج از سامانه) تسویه شده است. هیچ پرداخت آنلاینی ثبت نمی‌شود.',
  },
  { key: 'completed', label: 'تکمیل شده' },
  { key: 'rejected', label: 'رد شده' },
];

export default function AdminRequestDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const queryClient = useQueryClient();

  const [statusTarget, setStatusTarget] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState('');
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignOperatorId, setAssignOperatorId] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [removeDiscountOpen, setRemoveDiscountOpen] = useState(false);

  const request = useQuery({
    queryKey: ['admin-request', id],
    queryFn: () => adminRequestsApi.get(id as string),
    enabled: Boolean(id),
  });

  const timeline = useQuery({
    queryKey: ['admin-request-timeline', id],
    queryFn: () => adminRequestsApi.timeline(id as string),
    enabled: Boolean(id),
  });

  const operators = useQuery({
    queryKey: ['admin-operators-all'],
    queryFn: () => adminUsersApi.list({ role: 'operator', perPage: 100 }),
    enabled: assignOpen,
    staleTime: 60_000,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-request', id] });
    void queryClient.invalidateQueries({ queryKey: ['admin-request-timeline', id] });
    void queryClient.invalidateQueries({ queryKey: ['admin-requests'] });
  };

  const changeStatusMutation = useMutation({
    mutationFn: () =>
      adminRequestsApi.changeStatus(id as string, {
        status: statusTarget as string,
        note: statusNote.trim() || undefined,
      }),
    onSuccess: () => {
      toast({ title: 'وضعیت درخواست تغییر کرد' });
      setStatusTarget(null);
      setStatusNote('');
      invalidate();
    },
    onError: (e) => toast({ title: 'تغییر وضعیت ناموفق بود', description: e.message }),
  });

  const assignMutation = useMutation({
    mutationFn: () => adminRequestsApi.assign(id as string, assignOperatorId || undefined),
    onSuccess: () => {
      toast({ title: assignOperatorId ? 'اپراتور تخصیص یافت' : 'تخصیص خودکار انجام شد' });
      setAssignOpen(false);
      setAssignOperatorId('');
      invalidate();
    },
    onError: (e) => toast({ title: 'تخصیص ناموفق بود', description: e.message }),
  });

  const cancelMutation = useMutation({
    mutationFn: () => adminRequestsApi.cancel(id as string, cancelReason.trim() || undefined),
    onSuccess: () => {
      toast({ title: 'درخواست لغو شد' });
      setCancelOpen(false);
      setCancelReason('');
      invalidate();
    },
    onError: (e) => toast({ title: 'لغو ناموفق بود', description: e.message }),
  });

  const removeDiscountMutation = useMutation({
    mutationFn: () => adminRequestsApi.removeDiscount(id as string),
    onSuccess: () => {
      toast({ title: 'تخفیف اعمال‌شده حذف شد' });
      setRemoveDiscountOpen(false);
      invalidate();
    },
    onError: (e) => toast({ title: 'حذف تخفیف ناموفق بود', description: e.message }),
  });

  if (request.isLoading) {
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeader title="جزئیات درخواست" backHref="/admin/requests" />
        <DetailSkeleton />
      </div>
    );
  }

  if (request.isError || !request.data) {
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeader title="جزئیات درخواست" backHref="/admin/requests" />
        <ErrorState title="درخواست یافت نشد" onRetry={() => request.refetch()} />
      </div>
    );
  }

  const r: RequestDto = request.data;
  const status = String(r.status);
  const terminal = status === 'completed' || status === 'cancelled' || status === 'rejected';
  const operatorItems = (operators.data?.items ?? []) as OperatorDto[];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        title={`درخواست ${r.trackingCode}`}
        description={r.service?.name}
        backHref="/admin/requests"
      />

      {/* ============ Read-only info card ============ */}
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-extrabold text-gray-900">
              {r.service?.name ?? 'درخواست'}
            </h2>
            <p dir="ltr" className="mt-1 text-right font-mono text-xs text-gray-400">
              {r.trackingCode}
            </p>
          </div>
          <StatusBadge status={status} />
        </div>

        <dl className="mt-4 grid gap-x-6 gap-y-2.5 border-t border-gray-100 pt-4 text-sm sm:grid-cols-2">
          <Row label="مشتری" value={r.customer?.fullName ?? '—'} sub={r.customer?.phone} />
          <Row label="اپراتور" value={r.assignedOperator?.fullName ?? 'تخصیص نیافته'} />
          <Row label="مبلغ نهایی" value={formatToman(r.finalTotal)} />
          <Row label="دستمزد پایه" value={formatToman(r.laborFee)} />
          <Row
            label="وضعیت پرداخت"
            value={PAYMENT_STATUS_LABELS[r.paymentStatus] ?? r.paymentStatus}
          />
          <Row label="تاریخ ثبت" value={formatJalaliDateTime(r.createdAt)} />
          <Row label="تاریخ تکمیل" value={formatJalaliDateTime(r.completedAt ?? null)} />
          <Row label="روش تماس" value={r.contactValue ?? '—'} />
        </dl>

        {r.cancellationReason && (
          <p className="mt-4 rounded-xl bg-red-50 p-3 text-xs leading-relaxed text-red-600">
            دلیل لغو: {r.cancellationReason}
          </p>
        )}
        {r.description && (
          <p className="mt-4 rounded-xl bg-gray-50 p-3 text-xs leading-relaxed text-gray-600">
            {r.description}
          </p>
        )}

        {r.fieldValues && r.fieldValues.length > 0 && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <h3 className="mb-2 text-xs font-bold text-gray-500">اطلاعات فرم</h3>
            <dl className="space-y-1.5 text-xs">
              {r.fieldValues.map((fv) => (
                <div key={fv.id} className="flex items-start justify-between gap-3">
                  <dt className="text-gray-400">{fv.fieldLabel ?? fv.fieldName}</dt>
                  <dd className="text-left font-medium text-gray-700">{fv.value ?? '—'}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </section>

      {/* ============ Admin actions (9.7.2–9.7.5) ============ */}
      {!terminal && (
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-extrabold text-gray-800">اقدامات مدیریتی</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setAssignOpen(true)}
              className="border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100 inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-xs font-bold"
            >
              <UserPlus className="h-4 w-4" />
              تخصیص اجباری اپراتور
            </button>
            <button
              type="button"
              onClick={() => setCancelOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-600 hover:bg-red-100"
            >
              <XCircle className="h-4 w-4" />
              لغو درخواست
            </button>
          </div>

          {/* Force status list */}
          <h3 className="mb-2 mt-5 text-xs font-bold text-gray-500">تغییر اجباری وضعیت (9.7.3)</h3>
          <div className="flex flex-wrap gap-2">
            {FORCE_STATUS_OPTIONS.filter((o) => o.key !== status).map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => {
                  setStatusNote('');
                  setStatusTarget(o.key);
                }}
                className={
                  o.key === 'paid'
                    ? 'rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-700 hover:bg-amber-100'
                    : 'rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-bold text-gray-600 hover:bg-gray-50'
                }
              >
                {o.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Remove discount entry — shown when a discount seems applied */}
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-extrabold text-gray-800">
          <Eraser className="text-brand-600 h-4 w-4" />
          تخفیف اعمال‌شده
        </h2>
        <p className="text-xs leading-relaxed text-gray-500">
          اگر کد تخفیفی روی این درخواست قفل شده باشد، پیش از صدور فاکتور قابل حذف است. مبلغ نهایی پس
          از حذف بازمحاسبه می‌شود.
        </p>
        <button
          type="button"
          onClick={() => setRemoveDiscountOpen(true)}
          className="mt-3 rounded-xl border border-gray-200 px-3.5 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50"
        >
          حذف تخفیف درخواست
        </button>
      </section>

      {/* ============ Timeline ============ */}
      <section>
        <h2 className="mb-3 text-sm font-bold text-gray-800">روند درخواست</h2>
        {timeline.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-200/80" />
            ))}
          </div>
        ) : timeline.isError ? (
          <ErrorState title="خطا در دریافت روند" onRetry={() => timeline.refetch()} />
        ) : (
          <RequestTimeline entries={(timeline.data ?? []) as RequestTimelineEntryDto[]} />
        )}
      </section>

      {/* ===== Force status confirm ===== */}
      <ConfirmDialog
        open={statusTarget !== null}
        title="تغییر اجباری وضعیت"
        description={FORCE_STATUS_OPTIONS.find((o) => o.key === statusTarget)?.note}
        confirmLabel="اعمال وضعیت"
        pending={changeStatusMutation.isPending}
        onConfirm={() => changeStatusMutation.mutate()}
        onCancel={() => setStatusTarget(null)}
      >
        {statusTarget === 'paid' && (
          <p className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-bold leading-relaxed text-amber-700">
            <DollarSign className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            با ثبت دستی «پرداخت شده»، وجهی از کیف پول یا درگاه کسر نمی‌شود و ردیابی مالی برای این
            درخواست ثبت نخواهد شد.
          </p>
        )}
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">
            یادداشت (ثبت در تاریخچه)
          </span>
          <textarea
            rows={2}
            value={statusNote}
            onChange={(e) => setStatusNote(e.target.value)}
            placeholder="دلیل تغییر وضعیت…"
            className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:bg-white"
          />
        </label>
      </ConfirmDialog>

      {/* ===== Force assign dialog ===== */}
      {assignOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="تخصیص اپراتور"
        >
          <div
            className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
            onClick={() => setAssignOpen(false)}
            aria-hidden
          />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-base font-extrabold text-gray-900">تخصیص اپراتور (9.7.2)</h2>
            <p className="mt-1 text-xs text-gray-500">
              اپراتور موردنظر را انتخاب کنید؛ بدون انتخاب، تخصیص خودکار انجام می‌شود.
            </p>
            <select
              value={assignOperatorId}
              onChange={(e) => setAssignOperatorId(e.target.value)}
              aria-label="انتخاب اپراتور"
              className="focus:border-brand-400 mt-4 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:bg-white"
            >
              <option value="">— تخصیص خودکار —</option>
              {operatorItems.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.fullName ?? o.phone} ({o.stats.currentlyAssigned} در جریان)
                </option>
              ))}
            </select>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAssignOpen(false)}
                className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50"
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={assignMutation.isPending}
                onClick={() => assignMutation.mutate()}
                className="bg-brand-500 hover:bg-brand-600 rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {assignMutation.isPending ? 'در حال تخصیص…' : 'تخصیص'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Cancel with reason ===== */}
      <ConfirmDialog
        open={cancelOpen}
        title="لغو درخواست"
        description="درخواست برای همیشه لغو می‌شود و به مشتری اطلاع داده می‌شود."
        confirmLabel="لغو درخواست"
        pending={cancelMutation.isPending}
        onConfirm={() => cancelMutation.mutate()}
        onCancel={() => setCancelOpen(false)}
      >
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">دلیل لغو</span>
          <textarea
            rows={2}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="مثلاً عدم امکان انجام سرویس در این منطقه…"
            className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:bg-white"
          />
        </label>
      </ConfirmDialog>

      {/* ===== Remove discount ===== */}
      <ConfirmDialog
        open={removeDiscountOpen}
        title="حذف تخفیف درخواست"
        description="کد تخفیف قفل‌شده روی این درخواست آزاد و مبلغ نهایی بدون تخفیف بازمحاسبه می‌شود. ادامه می‌دهید؟"
        confirmLabel="حذف تخفیف"
        pending={removeDiscountMutation.isPending}
        onConfirm={() => removeDiscountMutation.mutate()}
        onCancel={() => setRemoveDiscountOpen(false)}
      >
        <p className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-[11px] text-gray-500">
          <Ban className="h-3.5 w-3.5" />
          این عملیات در لاگ ممیزی ثبت می‌شود.
        </p>
      </ConfirmDialog>
    </div>
  );
}

function Row({ label, value, sub }: { label: string; value: string; sub?: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="shrink-0 text-gray-400">{label}</dt>
      <dd className="min-w-0 text-left text-gray-700">
        {value}
        {sub && (
          <span dir="ltr" className="mt-0.5 block text-[11px] text-gray-400">
            {sub}
          </span>
        )}
      </dd>
    </div>
  );
}
