'use client';

import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { useState } from 'react';
import { BarList, RateRing } from '@/components/admin/charts';
import { PageHeader } from '@/components/admin/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Skeleton } from '@/components/common/Skeleton';
import {
  adminReportsApi,
  type FinancialReportDto,
  type ServiceReportRowDto,
  type WalletReportRowDto,
} from '@/lib/api/admin';
import { formatToman, toPersianDigits } from '@/lib/format';
import { WALLET_TX_LABELS } from '@/lib/status-meta';
import { cn } from '@/lib/utils';

/**
 * Reports (9.10.1–9.10.5) — tabs مالی/خدمات/کیف پول/پرداخت‌ها with from/to
 * date inputs + quick presets, tables + small SVG charts, and per-tab CSV
 * export (BOM + Blob download, filename like financial-report-1404-07.csv).
 */

type Tab = 'financial' | 'services' | 'wallet' | 'payments';

const TABS: Array<{ key: Tab; label: string; filename: string }> = [
  { key: 'financial', label: 'مالی', filename: 'financial-report' },
  { key: 'services', label: 'خدمات', filename: 'services-report' },
  { key: 'wallet', label: 'کیف پول', filename: 'wallet-report' },
  { key: 'payments', label: 'پرداخت‌ها', filename: 'payments-report' },
];

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** CSV export with UTF-8 BOM so Excel renders Persian correctly. */
function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  const escape = (v: string | number) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))];
  const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const PAYMENT_STATUS_FA: Record<string, string> = {
  pending: 'در انتظار',
  verifying: 'در حال تأیید',
  successful: 'موفق',
  failed: 'ناموفق',
  cancelled: 'لغوشده',
  refunded: 'بازگشت‌شده',
};

export default function AdminReportsPage() {
  const [tab, setTab] = useState<Tab>('financial');
  const [from, setFrom] = useState(isoDaysAgo(30));
  const [to, setTo] = useState(todayIso());

  const params = { from, to };

  const financial = useQuery({
    queryKey: ['admin-report-financial', from, to],
    queryFn: () => adminReportsApi.financial(params),
    enabled: tab === 'financial',
  });
  const services = useQuery({
    queryKey: ['admin-report-services', from, to],
    queryFn: () => adminReportsApi.services(params),
    enabled: tab === 'services',
  });
  const wallet = useQuery({
    queryKey: ['admin-report-wallet', from, to],
    queryFn: () => adminReportsApi.wallet(params),
    enabled: tab === 'wallet',
  });
  const payments = useQuery({
    queryKey: ['admin-report-payments', from, to],
    queryFn: () => adminReportsApi.payments(params),
    enabled: tab === 'payments',
  });

  const activeMeta = TABS.find((t) => t.key === tab)!;
  const rangeLabel = `${from.replace(/-/g, '')}-${to.replace(/-/g, '')}`;

  const exportCsv = () => {
    if (tab === 'financial' && financial.data) exportFinancial(financial.data, rangeLabel);
    if (tab === 'services' && services.data) exportServices(services.data, rangeLabel);
    if (tab === 'wallet' && wallet.data) exportWallet(wallet.data, rangeLabel);
    if (tab === 'payments' && payments.data) exportPayments(payments.data, rangeLabel);
  };

  const hasData =
    (tab === 'financial' && !!financial.data) ||
    (tab === 'services' && (services.data ?? []).length > 0) ||
    (tab === 'wallet' && (wallet.data ?? []).length > 0) ||
    (tab === 'payments' && !!payments.data);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="گزارش‌ها"
        description="گزارش مالی، خدمات، کیف پول و پرداخت‌ها با بازه دلخواه"
        actions={
          <button
            type="button"
            disabled={!hasData}
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            <Download className="h-4 w-4" />
            خروجی CSV
          </button>
        }
      />

      {/* Tabs + range */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="نوع گزارش">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'rounded-xl px-4 py-2.5 text-xs font-bold transition-colors',
                tab === t.key
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { days: 7, label: '۷ روز' },
              { days: 30, label: '۳۰ روز' },
              { days: 90, label: '۹۰ روز' },
            ] as const
          ).map((p) => (
            <button
              key={p.days}
              type="button"
              onClick={() => {
                setFrom(isoDaysAgo(p.days));
                setTo(todayIso());
              }}
              className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-bold text-gray-600 hover:bg-gray-50"
            >
              {p.label}
            </button>
          ))}
          <input
            type="date"
            dir="ltr"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            aria-label="از تاریخ"
            className="focus:border-brand-400 rounded-xl border border-gray-200 bg-white px-2.5 py-2 text-xs outline-none"
          />
          <span className="text-[11px] text-gray-400">تا</span>
          <input
            type="date"
            dir="ltr"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            aria-label="تا تاریخ"
            className="focus:border-brand-400 rounded-xl border border-gray-200 bg-white px-2.5 py-2 text-xs outline-none"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
        {tab === 'financial' && (
          <FinancialContent
            data={financial.data}
            loading={financial.isLoading}
            error={financial.isError}
            retry={() => financial.refetch()}
          />
        )}
        {tab === 'services' && (
          <ServicesContent
            data={services.data}
            loading={services.isLoading}
            error={services.isError}
            retry={() => services.refetch()}
          />
        )}
        {tab === 'wallet' && (
          <WalletContent
            data={wallet.data}
            loading={wallet.isLoading}
            error={wallet.isError}
            retry={() => wallet.refetch()}
          />
        )}
        {tab === 'payments' && (
          <PaymentsContent
            data={payments.data}
            loading={payments.isLoading}
            error={payments.isError}
            retry={() => payments.refetch()}
          />
        )}
      </div>

      <p className="mt-3 text-center text-[11px] text-gray-400">
        فایل خروجی: {activeMeta.filename}-{rangeLabel}.csv
      </p>
    </div>
  );
}

// ==================== Financial tab (9.10.1) ====================

function FinancialContent({
  data,
  loading,
  error,
  retry,
}: {
  data?: FinancialReportDto;
  loading: boolean;
  error: boolean;
  retry: () => void;
}) {
  if (loading) return <Skeleton className="h-48 rounded-2xl" />;
  if (error) return <ErrorState title="خطا در دریافت گزارش مالی" onRetry={retry} />;
  if (!data) return null;

  const cards = [
    {
      label: 'درآمد (درخواست‌های پرداخت‌شده)',
      value: formatToman(data.revenueToman),
      accent: true,
    },
    { label: 'سهم دستمزد اپراتورها', value: formatToman(data.laborToman) },
    {
      label: 'تخفیف‌ها',
      value: `${formatToman(data.discountsToman)} (${toPersianDigits(data.discountsCount)} مورد)`,
    },
    {
      label: 'بازگشت وجه',
      value: `${formatToman(data.refundsToman)} (${toPersianDigits(data.refundsCount)} مورد)`,
    },
  ];

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-400">
        {toPersianDigits(data.paidRequests)} درخواست پرداخت‌شده در بازه انتخابی
      </p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className={cn(
              'rounded-2xl border p-4',
              c.accent ? 'border-brand-200 bg-brand-50/60' : 'border-gray-100 bg-gray-50/60',
            )}
          >
            <p className="text-[11px] font-medium text-gray-500">{c.label}</p>
            <p
              className={cn(
                'mt-1 text-base font-extrabold',
                c.accent ? 'text-brand-700' : 'text-gray-900',
              )}
            >
              {c.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function exportFinancial(d: FinancialReportDto, range: string) {
  downloadCsv(
    `financial-report-${range}`,
    [
      'بازه',
      'درآمد (تومان)',
      'دستمزد (تومان)',
      'تخفیف (تومان)',
      'تعداد تخفیف',
      'بازگشت وجه (تومان)',
      'تعداد بازگشت',
      'درخواست پرداخت‌شده',
    ],
    [
      [
        `${d.from.slice(0, 10)} تا ${d.to.slice(0, 10)}`,
        d.revenueToman,
        d.laborToman,
        d.discountsToman,
        d.discountsCount,
        d.refundsToman,
        d.refundsCount,
        d.paidRequests,
      ],
    ],
  );
}

// ==================== Services tab (9.10.2) ====================

function ServicesContent({
  data,
  loading,
  error,
  retry,
}: {
  data?: ServiceReportRowDto[];
  loading: boolean;
  error: boolean;
  retry: () => void;
}) {
  if (loading) return <Skeleton className="h-64 rounded-2xl" />;
  if (error) return <ErrorState title="خطا در دریافت گزارش خدمات" onRetry={retry} />;

  const rows = data ?? [];

  return (
    <div className="space-y-5">
      <BarList
        items={rows.slice(0, 6).map((r) => ({
          label: r.serviceName,
          value: r.revenueToman,
          hint: `${toPersianDigits(r.requests)} درخواست`,
        }))}
        valueFormatter={(v) => formatToman(v)}
      />
      {rows.length === 0 ? (
        <EmptyState title="داده‌ای در این بازه نیست" description="بازه زمانی را تغییر دهید" />
      ) : (
        <div className="-mx-4 overflow-x-auto sm:mx-0">
          <div className="min-w-[640px]">
            <table className="w-full border-collapse text-right text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/80">
                  <th className="px-3 py-2.5 text-xs font-bold text-gray-500">خدمت</th>
                  <th className="px-3 py-2.5 text-xs font-bold text-gray-500">دسته</th>
                  <th className="px-3 py-2.5 text-xs font-bold text-gray-500">تعداد</th>
                  <th className="px-3 py-2.5 text-xs font-bold text-gray-500">
                    میانگین زمان (دقیقه)
                  </th>
                  <th className="px-3 py-2.5 text-xs font-bold text-gray-500">درآمد</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.serviceId}
                    className="border-b border-gray-100 last:border-0 odd:bg-white even:bg-gray-50/50"
                  >
                    <td className="px-3 py-2.5 text-xs font-bold text-gray-800">{r.serviceName}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-500">{r.categoryName}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700">
                      {toPersianDigits(r.requests)}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-700">
                      {r.avgDurationMin === null ? '—' : toPersianDigits(r.avgDurationMin)}
                    </td>
                    <td className="px-3 py-2.5 text-xs font-bold text-gray-800">
                      {formatToman(r.revenueToman)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function exportServices(rows: ServiceReportRowDto[], range: string) {
  downloadCsv(
    `services-report-${range}`,
    ['خدمت', 'دسته', 'تعداد', 'میانگین زمان (دقیقه)', 'درآمد (تومان)'],
    rows.map((r) => [
      r.serviceName,
      r.categoryName,
      r.requests,
      r.avgDurationMin ?? '',
      r.revenueToman,
    ]),
  );
}

// ==================== Wallet tab (9.10.3) ====================

function WalletContent({
  data,
  loading,
  error,
  retry,
}: {
  data?: WalletReportRowDto[];
  loading: boolean;
  error: boolean;
  retry: () => void;
}) {
  if (loading) return <Skeleton className="h-64 rounded-2xl" />;
  if (error) return <ErrorState title="خطا در دریافت گزارش کیف پول" onRetry={retry} />;

  const rows = data ?? [];

  return (
    <div className="space-y-5">
      {rows.length === 0 ? (
        <EmptyState title="تراکنشی در این بازه نیست" description="بازه زمانی را تغییر دهید" />
      ) : (
        <>
          <BarList
            items={rows.map((r) => ({
              label: WALLET_TX_LABELS[r.type] ?? r.type,
              value: Math.abs(r.netToman),
              hint: `${toPersianDigits(r.count)} تراکنش`,
            }))}
            valueFormatter={(v) => formatToman(v)}
          />
          <div className="-mx-4 overflow-x-auto sm:mx-0">
            <div className="min-w-[520px]">
              <table className="w-full border-collapse text-right text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/80">
                    <th className="px-3 py-2.5 text-xs font-bold text-gray-500">نوع تراکنش</th>
                    <th className="px-3 py-2.5 text-xs font-bold text-gray-500">تعداد</th>
                    <th className="px-3 py-2.5 text-xs font-bold text-gray-500">خالص (تومان)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.type}
                      className="border-b border-gray-100 last:border-0 odd:bg-white even:bg-gray-50/50"
                    >
                      <td className="px-3 py-2.5 text-xs font-bold text-gray-800">
                        {WALLET_TX_LABELS[r.type] ?? r.type}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-700">
                        {toPersianDigits(r.count)}
                      </td>
                      <td
                        className={cn(
                          'px-3 py-2.5 text-xs font-bold',
                          r.netToman >= 0 ? 'text-brand-700' : 'text-red-600',
                        )}
                      >
                        {formatToman(r.netToman)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function exportWallet(rows: WalletReportRowDto[], range: string) {
  downloadCsv(
    `wallet-report-${range}`,
    ['نوع تراکنش', 'تعداد', 'خالص (تومان)'],
    rows.map((r) => [WALLET_TX_LABELS[r.type] ?? r.type, r.count, r.netToman]),
  );
}

// ==================== Payments tab (9.10.4) ====================

function PaymentsContent({
  data,
  loading,
  error,
  retry,
}: {
  data?: { byStatus: Record<string, number>; successRate: number | null; total: number };
  loading: boolean;
  error: boolean;
  retry: () => void;
}) {
  if (loading) return <Skeleton className="h-64 rounded-2xl" />;
  if (error) return <ErrorState title="خطا در دریافت گزارش پرداخت‌ها" onRetry={retry} />;
  if (!data) return null;

  return (
    <div className="grid items-center gap-6 lg:grid-cols-3">
      <div className="flex justify-center">
        <RateRing rate={data.successRate} label="نرخ موفقیت پرداخت" />
      </div>
      <div className="lg:col-span-2">
        <BarList
          items={Object.entries(data.byStatus).map(([st, cnt]) => ({
            label: PAYMENT_STATUS_FA[st] ?? st,
            value: cnt,
          }))}
        />
        <p className="mt-3 text-[11px] text-gray-400">
          مجموع: {toPersianDigits(data.total)} پرداخت
        </p>
      </div>
    </div>
  );
}

function exportPayments(
  d: { byStatus: Record<string, number>; successRate: number | null; total: number },
  range: string,
) {
  downloadCsv(
    `payments-report-${range}`,
    ['وضعیت', 'تعداد'],
    [
      ...Object.entries(d.byStatus).map(([st, cnt]) => [PAYMENT_STATUS_FA[st] ?? st, cnt]),
      ['مجموع', d.total],
      ['نرخ موفقیت', `${d.successRate ?? 0}%`],
    ],
  );
}
