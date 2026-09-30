'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, FileText, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { ErrorState } from '@/components/common/ErrorState';
import { MobileHeader } from '@/components/common/MobileHeader';
import { PayRequestActions } from '@/components/common/PayRequestActions';
import { RequestTimeline } from '@/components/common/RequestTimeline';
import { StatusBadge } from '@/components/common/StatusBadge';
import { DetailSkeleton } from '@/components/common/Skeleton';
import { useUiStore } from '@/lib/stores/ui-store';
import { requestsApi } from '@/lib/api/requests';
import { formatJalaliDateTime, formatToman } from '@/lib/format';
import { PAYMENT_STATUS_LABELS } from '@/lib/status-meta';

/**
 * Request detail page (7.7.2) — info card, timeline (7.7.3), chat entry
 * (7.7.5), invoice entry (7.7.6), pay button when waiting_for_payment (7.7.7),
 * cancel action.
 */
export default function RequestDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const queryClient = useQueryClient();
  const openSheet = useUiStore((s) => s.openSheet);
  const [payError, setPayError] = useState<string | null>(null);

  const request = useQuery({
    queryKey: ['request', id],
    queryFn: () => requestsApi.get(id as string),
    enabled: Boolean(id),
  });

  const timeline = useQuery({
    queryKey: ['request-timeline', id],
    queryFn: () => requestsApi.timeline(id as string),
    enabled: Boolean(id),
  });

  const cancelMutation = useMutation({
    mutationFn: (reason?: string) => requestsApi.cancel(id as string, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['request', id] });
      void queryClient.invalidateQueries({ queryKey: ['request-timeline', id] });
    },
  });

  const payMutation = useMutation({
    mutationFn: async (_args: {
      requestId: string;
      method: 'wallet' | 'online';
      gateway?: 'zarinpal' | 'zibal';
    }) => {
      const result = await requestsApi.pay(_args.requestId, {
        method: _args.method,
        gateway: _args.gateway,
      });
      return result as { redirectUrl?: string; walletBalance?: number };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['request', id] });
      void queryClient.invalidateQueries({ queryKey: ['request-timeline', id] });
      void queryClient.invalidateQueries({ queryKey: ['wallet'] });
    },
    onError: (e) => setPayError(e instanceof Error ? e.message : 'پرداخت ناموفق بود'),
  });

  if (request.isLoading) {
    return (
      <>
        <MobileHeader title="جزئیات درخواست" showBack showBell={false} />
        <DetailSkeleton />
      </>
    );
  }

  if (request.isError || !request.data) {
    return (
      <>
        <MobileHeader title="جزئیات درخواست" showBack showBell={false} />
        <ErrorState title="درخواست یافت نشد" onRetry={() => request.refetch()} />
      </>
    );
  }

  const r = request.data;
  const status = String(r.status);
  const canPay = status === 'waiting_for_payment';
  const canCancel = ['pending', 'reviewing', 'waiting_for_customer'].includes(status);

  const showCancelSheet = () => {
    openSheet(
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-gray-600">
          آیا از لغو این درخواست مطمئن هستید؟ این عملیات قابل بازگشت نیست.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => useUiStore.getState().closeSheet()}
            className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-600"
          >
            انصراف
          </button>
          <button
            type="button"
            onClick={() => {
              cancelMutation.mutate();
              useUiStore.getState().closeSheet();
            }}
            className="rounded-xl bg-red-500 px-4 py-2.5 text-sm font-bold text-white"
          >
            {cancelMutation.isPending ? '…' : 'لغو درخواست'}
          </button>
        </div>
      </div>,
      'لغو درخواست',
    );
  };

  return (
    <>
      <MobileHeader title="جزئیات درخواست" showBack showBell={false} />
      <div className="space-y-5 pt-4">
        {/* Summary card */}
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-base font-extrabold text-gray-900">
                {r.service?.name ?? 'درخواست'}
              </h1>
              <p dir="ltr" className="mt-1 text-right font-mono text-xs text-gray-400">
                {r.trackingCode}
              </p>
            </div>
            <StatusBadge status={status} />
          </div>

          <dl className="mt-4 space-y-2.5 border-t border-gray-100 pt-4 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-gray-400">مبلغ نهایی</dt>
              <dd className="font-extrabold text-gray-900">{formatToman(r.finalTotal)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-400">وضعیت پرداخت</dt>
              <dd className="text-gray-700">
                {PAYMENT_STATUS_LABELS[r.paymentStatus] ?? r.paymentStatus}
              </dd>
            </div>
            {r.assignedOperator?.fullName && (
              <div className="flex items-center justify-between">
                <dt className="text-gray-400">اپراتور</dt>
                <dd className="text-gray-700">{r.assignedOperator.fullName}</dd>
              </div>
            )}
            <div className="flex items-center justify-between">
              <dt className="text-gray-400">تاریخ ثبت</dt>
              <dd className="text-gray-700">{formatJalaliDateTime(r.createdAt)}</dd>
            </div>
          </dl>

          {r.description && (
            <p className="mt-4 rounded-xl bg-gray-50 p-3 text-xs leading-relaxed text-gray-600">
              {r.description}
            </p>
          )}

          {/* Field values */}
          {r.fieldValues && r.fieldValues.length > 0 && (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <h2 className="mb-2 text-xs font-bold text-gray-500">اطلاعات فرم</h2>
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

        {/* 7.7.7 — pay button */}
        {canPay && (
          <section className="rounded-2xl border border-orange-200 bg-orange-50/60 p-4">
            <h2 className="mb-3 text-sm font-bold text-orange-800">پرداخت صورت‌حساب</h2>
            <PayRequestActions
              requestId={r.id}
              amountToman={r.finalTotal}
              onPay={(requestId, method, gateway) =>
                payMutation.mutateAsync({ requestId, method, gateway })
              }
              onPaid={() => setPayError(null)}
              disabled={payMutation.isPending}
            />
            {payError && (
              <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-center text-xs font-bold text-red-600">
                {payError}
              </p>
            )}
          </section>
        )}

        {/* 7.7.5 + 7.7.6 — chat & invoice entries */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            href={`/chat/${id}`}
            className="flex items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white p-4 text-sm font-bold text-gray-700 shadow-sm active:bg-gray-50"
          >
            <MessageCircle className="h-4.5 w-4.5 text-brand-600" />
            گفتگو
          </Link>
          <Link
            href="/wallet/invoices"
            className="flex items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white p-4 text-sm font-bold text-gray-700 shadow-sm active:bg-gray-50"
          >
            <FileText className="h-4.5 w-4.5 text-brand-600" />
            صورت‌حساب
          </Link>
        </div>

        {/* Cancel */}
        {canCancel && (
          <button
            type="button"
            onClick={showCancelSheet}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-100 bg-white p-3.5 text-sm font-bold text-red-500 active:bg-red-50"
          >
            <Ban className="h-4 w-4" />
            لغو درخواست
          </button>
        )}

        {/* 7.7.3 — timeline */}
        <section>
          <h2 className="mb-3 text-sm font-bold text-gray-800">روند درخواست</h2>
          {timeline.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-200/80" />
              ))}
            </div>
          ) : timeline.data ? (
            <RequestTimeline entries={timeline.data} />
          ) : (
            <ErrorState title="خطا در دریافت روند" onRetry={() => timeline.refetch()} />
          )}
        </section>
      </div>
    </>
  );
}
