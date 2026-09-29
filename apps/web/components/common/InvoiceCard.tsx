'use client';

/**
 * InvoiceCard (Phase 5.4.6) — invoice summary card with PDF download.
 *
 * Data source: InvoiceDto from @caffenet/shared
 *  (GET /api/v1/invoices/:id or listMine).
 *
 * Design notes:
 *  - RTL-first (Persian), pure presentational — data fetching belongs to the page
 *  - Download links to /api/v1/invoices/:id/download (server-rendered PDF)
 *  - Status badge mirrors InvoiceStatus: issued / paid / void
 */

import { cn } from '@/lib/utils';
import type { InvoiceDto } from '@caffenet/shared';

interface InvoiceCardProps {
  invoice: InvoiceDto;
  /** Show customer name/phone (operator/admin views) — hidden for customers */
  showCustomer?: boolean;
  /** Absolute or app-relative base for the download URL (default: /api/v1) */
  apiBase?: string;
  className?: string;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  draft: { label: 'پیش‌نویس', cls: 'bg-gray-100 text-gray-700' },
  issued: { label: 'صادرشده — در انتظار پرداخت', cls: 'bg-violet-100 text-violet-800' },
  paid: { label: 'پرداخت‌شده', cls: 'bg-emerald-100 text-emerald-800' },
  void: { label: 'باطل‌شده', cls: 'bg-rose-100 text-rose-700' },
};

const ITEM_LABELS: Record<string, string> = {
  labor: 'دستمزد خدمت',
  material: 'هزینه مواد',
  additional: 'هزینه‌های تکمیلی',
  discount: 'تخفیف',
};

function fa(amount: number): string {
  try {
    return new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 }).format(amount);
  } catch {
    return String(amount);
  }
}

function faDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function InvoiceCard({
  invoice,
  showCustomer = false,
  apiBase = '/api/v1',
  className,
}: InvoiceCardProps) {
  const status = STATUS_BADGE[invoice.status] ?? STATUS_BADGE.issued!;
  const unit = 'تومان';

  const items: Array<{ label: string; amount: number; negative?: boolean }> = (invoice.items ?? [])
    .filter((i) => i.amount !== 0)
    .map((i) => ({
      label: ITEM_LABELS[i.type] ?? i.description,
      amount: Math.abs(i.amount),
      negative: i.amount < 0,
    }));

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900',
        className,
      )}
      dir="rtl"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-800/50">
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden>
            🧾
          </span>
          <div>
            <p
              className="font-mono text-sm font-semibold text-gray-900 dark:text-gray-100"
              dir="ltr"
            >
              {invoice.invoiceNumber}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{faDate(invoice.createdAt)}</p>
          </div>
        </div>
        <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', status.cls)}>
          {status.label}
        </span>
      </div>

      {/* Customer / request info */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 px-4 py-3 text-sm sm:grid-cols-4">
        {showCustomer && (
          <>
            <div>
              <p className="text-xs text-gray-400">مشتری</p>
              <p className="text-gray-800 dark:text-gray-200">{invoice.customerName ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">تلفن</p>
              <p className="tabular-nums text-gray-800 dark:text-gray-200" dir="ltr">
                {invoice.customerPhone ?? '—'}
              </p>
            </div>
          </>
        )}
        <div>
          <p className="text-xs text-gray-400">کد رهگیری</p>
          <p className="font-mono text-gray-800 dark:text-gray-200" dir="ltr">
            {invoice.requestTrackingCode ?? '—'}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400">تاریخ پرداخت</p>
          <p className="text-gray-800 dark:text-gray-200">{faDate(invoice.paidAt)}</p>
        </div>
        {invoice.discountCode && (
          <div>
            <p className="text-xs text-gray-400">کد تخفیف</p>
            <p className="font-mono text-gray-800 dark:text-gray-200" dir="ltr">
              {invoice.discountCode}
            </p>
          </div>
        )}
      </div>

      {/* Line items */}
      {items.length > 0 && (
        <dl className="space-y-1.5 border-t border-gray-100 px-4 py-3 dark:border-gray-800">
          {items.map((i) => (
            <div
              key={`${i.label}-${i.amount}`}
              className="flex items-center justify-between text-sm"
            >
              <dt
                className={cn(
                  i.negative
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-gray-600 dark:text-gray-400',
                )}
              >
                {i.label}
              </dt>
              <dd
                className={cn(
                  'font-medium tabular-nums',
                  i.negative
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-gray-900 dark:text-gray-100',
                )}
              >
                {i.negative ? '−' : ''}
                {fa(i.amount)} <span className="text-xs text-gray-400">{unit}</span>
              </dd>
            </div>
          ))}
        </dl>
      )}

      {/* Total + download */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 bg-violet-50/60 px-4 py-3 dark:border-gray-800 dark:bg-violet-950/30">
        <div>
          <p className="text-xs text-violet-700/70 dark:text-violet-300/70">مبلغ نهایی فاکتور</p>
          <p className="text-lg font-bold tabular-nums text-violet-900 dark:text-violet-200">
            {fa(invoice.finalTotal)} <span className="text-xs font-normal">{unit}</span>
          </p>
        </div>
        <a
          href={`${apiBase}/invoices/${invoice.id}/download`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M12 4v12m0 0l-4-4m4 4l4-4"
            />
          </svg>
          دانلود PDF
        </a>
      </div>
    </div>
  );
}
