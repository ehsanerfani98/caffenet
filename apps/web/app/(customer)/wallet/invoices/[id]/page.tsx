'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { Download, Loader2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { ErrorState } from '@/components/common/ErrorState';
import { FullScreenModal } from '@/components/common/FullScreenModal';
import { MobileHeader } from '@/components/common/MobileHeader';
import { invoicesApi } from '@/lib/api/wallet';
import { formatJalaliDate, formatToman } from '@/lib/format';
import { INVOICE_STATUS_LABELS } from '@/lib/status-meta';
import { useState } from 'react';

/**
 * Invoice viewer (7.8.5) — full invoice detail + PDF download (7.8.6).
 */
export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [showRaw, setShowRaw] = useState(false);

  const invoice = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => invoicesApi.get(id as string),
    enabled: Boolean(id),
  });

  const downloadMutation = useMutation({
    mutationFn: async () => {
      const blob = await invoicesApi.download(id as string);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoice.data?.invoiceNumber ?? 'invoice'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
  });

  if (invoice.isLoading) {
    return (
      <>
        <MobileHeader title="صورت‌حساب" showBack showBell={false} />
        <div className="mt-4 h-64 animate-pulse rounded-2xl bg-gray-200/80" />
      </>
    );
  }

  if (invoice.isError || !invoice.data) {
    return (
      <>
        <MobileHeader title="صورت‌حساب" showBack showBell={false} />
        <ErrorState title="صورت‌حساب یافت نشد" onRetry={() => invoice.refetch()} />
      </>
    );
  }

  const inv = invoice.data;

  return (
    <>
      <MobileHeader title="صورت‌حساب" showBack showBell={false} />
      <div className="space-y-4 pt-4">
        {/* Invoice header */}
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h1 dir="ltr" className="font-mono text-base font-extrabold text-gray-900">
              {inv.invoiceNumber}
            </h1>
            <span className="bg-brand-50 text-brand-700 rounded-full px-2.5 py-1 text-[11px] font-bold">
              {INVOICE_STATUS_LABELS[inv.status] ?? inv.status}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-400">
            تاریخ صدور: {formatJalaliDate(inv.createdAt)}
          </p>
          {inv.requestTrackingCode && (
            <p dir="ltr" className="mt-1 text-right font-mono text-xs text-gray-400">
              {inv.requestTrackingCode}
            </p>
          )}
        </section>

        {/* Line items */}
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-gray-800">اقلام</h2>
          <dl className="space-y-2.5 text-sm">
            <Row label="دستمزد خدمت" value={formatToman(inv.laborFee)} />
            {inv.materialCost > 0 && (
              <Row label="هزینه مواد" value={formatToman(inv.materialCost)} />
            )}
            {inv.additionalCost > 0 && (
              <Row label="هزینه‌های اضافی" value={formatToman(inv.additionalCost)} />
            )}
            {inv.discountAmount > 0 && (
              <Row
                label={`تخفیف${inv.discountCode ? ` (${inv.discountCode})` : ''}`}
                value={`− ${formatToman(inv.discountAmount)}`}
                negative
              />
            )}
          </dl>
          <div className="mt-4 flex items-center justify-between border-t border-dashed border-gray-200 pt-4">
            <span className="text-sm font-bold text-gray-700">مبلغ نهایی</span>
            <span className="text-brand-700 text-lg font-extrabold">
              {formatToman(inv.finalTotal)}
            </span>
          </div>
          {inv.paidAt && (
            <p className="mt-2 text-left text-[11px] text-emerald-600">
              پرداخت‌شده در {formatJalaliDate(inv.paidAt)}
            </p>
          )}
        </section>

        {/* PDF download */}
        <button
          type="button"
          onClick={() => downloadMutation.mutate()}
          disabled={downloadMutation.isPending}
          className="border-brand-600 text-brand-700 active:bg-brand-50 flex w-full items-center justify-center gap-2 rounded-2xl border-2 bg-white p-4 text-sm font-extrabold disabled:opacity-50"
        >
          {downloadMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4.5 w-4.5" />
          )}
          دانلود PDF صورت‌حساب
        </button>
      </div>

      {/* Raw invoice modal (fallback preview) */}
      <FullScreenModal open={showRaw} onClose={() => setShowRaw(false)} title="پیش‌نمایش">
        <pre className="p-4 text-xs">{JSON.stringify(inv, null, 2)}</pre>
      </FullScreenModal>
    </>
  );
}

function Row({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-gray-400">{label}</dt>
      <dd className={negative ? 'font-medium text-red-500' : 'font-medium text-gray-800'}>
        {value}
      </dd>
    </div>
  );
}
