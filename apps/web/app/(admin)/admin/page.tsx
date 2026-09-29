'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Banknote,
  CheckCircle2,
  ClipboardList,
  FolderTree,
  MessageCircleWarning,
  ScanBarcode,
  TrendingUp,
  UserCheck,
  UserCog,
  Users,
  Wallet,
  XCircle,
  Activity,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { BarList, DonutChart, RateRing, TrendChart } from '@/components/admin/charts';
import { KpiCard } from '@/components/admin/KpiCard';
import { PageHeader } from '@/components/admin/PageHeader';
import { ErrorState } from '@/components/common/ErrorState';
import { Skeleton } from '@/components/common/Skeleton';
import { adminDashboardApi } from '@/lib/api/admin';
import { formatJalaliDateTime, formatRelative, formatToman, toPersianDigits } from '@/lib/format';
import { requestStatusLabel } from '@/lib/status-meta';
import { cn } from '@/lib/utils';

/**
 * Admin dashboard (9.2) — 13 KPI cards, revenue trend with granularity +
 * range presets, requests-by-status donut, top services, payment success rate,
 * and a recent-activity feed from the audit trail.
 */

const RANGE_PRESETS = [
  { days: 7, label: '۷ روز' },
  { days: 30, label: '۳۰ روز' },
  { days: 90, label: '۹۰ روز' },
] as const;

function isoDaysAgo(days: number): string {
  const d = new Date(Date.now() - days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

const ACTIVITY_ACTION_LABELS: Record<string, string> = {
  login: 'ورود',
  logout: 'خروج',
  create: 'ایجاد',
  update: 'به‌روزرسانی',
  delete: 'حذف',
  assign: 'تخصیص',
  revoke: 'سلب دسترسی',
  price_change: 'تغییر قیمت',
  status_change: 'تغییر وضعیت',
  wallet_adjust: 'تعدیل کیف پول',
  refund_issue: 'بازگشت وجه',
  permission_change: 'تغییر مجوز',
  role_change: 'تغییر نقش',
  setting_change: 'تغییر تنظیمات',
};

const ENTITY_LABELS: Record<string, string> = {
  user: 'کاربر',
  request: 'درخواست',
  payment: 'پرداخت',
  role: 'نقش',
  settings: 'تنظیمات',
  notification: 'اعلان',
  contact_method: 'روش تماس',
  category: 'دسته‌بندی',
  service: 'خدمت',
  discount: 'کد تخفیف',
  wallet: 'کیف پول',
};

export default function AdminDashboardPage() {
  const [rangeDays, setRangeDays] = useState<number>(30);
  const [granularity, setGranularity] = useState<'day' | 'month'>('day');

  const dashboard = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: adminDashboardApi.get,
    refetchInterval: 60_000,
  });

  const charts = useQuery({
    queryKey: ['admin-dashboard-charts', rangeDays, granularity],
    queryFn: () =>
      adminDashboardApi.charts({
        from: isoDaysAgo(rangeDays),
        granularity,
      }),
  });

  const k = dashboard.data?.kpis;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="داشبورد مدیریت"
        description="نمای کلی وضعیت سامانه — به‌روزرسانی خودکار هر دقیقه"
      />

      {dashboard.isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-[76px] rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      ) : dashboard.isError ? (
        <ErrorState title="خطا در دریافت داشبورد" onRetry={() => dashboard.refetch()} />
      ) : (
        <div className="space-y-6">
          {/* ============ KPI grid (9.2.1) ============ */}
          <section aria-label="شاخص‌های کلیدی">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
              <KpiCard
                icon={ClipboardList}
                label="درخواست‌های جدید"
                value={k?.requestsNew}
                tone="amber"
              />
              <KpiCard
                icon={Activity}
                label="درخواست‌های فعال"
                value={k?.requestsActive}
                tone="green"
              />
              <KpiCard icon={CheckCircle2} label="تکمیل‌شده" value={k?.requestsCompleted} />
              <KpiCard icon={XCircle} label="لغو/رد شده" value={k?.requestsCancelled} tone="red" />
              <KpiCard
                icon={Banknote}
                label="درآمد امروز"
                formatted={formatToman(k?.revenueTodayToman ?? 0)}
                tone="green"
              />
              <KpiCard
                icon={Wallet}
                label="تراکنش کیف پول امروز"
                value={k?.walletTransactionsToday}
              />
              <KpiCard icon={ScanBarcode} label="پرداخت‌های امروز" value={k?.paymentsToday} />
              <KpiCard
                icon={MessageCircleWarning}
                label="چت‌های خوانده‌نشده"
                value={k?.unreadChats}
                tone="amber"
              />
              <KpiCard icon={Users} label="کل کاربران" value={k?.usersTotal} />
              <KpiCard icon={UserCheck} label="مشتریان" value={k?.customers} />
              <KpiCard icon={UserCog} label="اپراتورها" value={k?.operators} />
              <KpiCard
                icon={FolderTree}
                label="خدمات / دسته‌ها"
                formatted={`${toPersianDigits(k?.servicesTotal ?? 0)} / ${toPersianDigits(k?.categoriesTotal ?? 0)}`}
              />
            </div>
          </section>

          {/* ============ Charts row (9.2.2) ============ */}
          <section aria-label="نمودارها" className="space-y-4">
            {/* Revenue trend */}
            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-sm font-extrabold text-gray-800">
                  <TrendingUp className="text-brand-600 h-4 w-4" />
                  روند درآمد
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  {RANGE_PRESETS.map((p) => (
                    <button
                      key={p.days}
                      type="button"
                      onClick={() => setRangeDays(p.days)}
                      className={cn(
                        'rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors',
                        rangeDays === p.days
                          ? 'bg-brand-600 text-white'
                          : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                  <span className="mx-1 hidden h-5 w-px bg-gray-200 sm:block" />
                  {(
                    [
                      { key: 'day', label: 'روزانه' },
                      { key: 'month', label: 'ماهانه' },
                    ] as const
                  ).map((g) => (
                    <button
                      key={g.key}
                      type="button"
                      onClick={() => setGranularity(g.key)}
                      className={cn(
                        'rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors',
                        granularity === g.key
                          ? 'bg-gray-900 text-white'
                          : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
                      )}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>
              {charts.isLoading ? (
                <Skeleton className="h-44 rounded-xl" />
              ) : charts.isError ? (
                <ErrorState title="خطا در دریافت نمودار" onRetry={() => charts.refetch()} />
              ) : (
                <TrendChart
                  series={charts.data?.revenue.series ?? []}
                  valueFormatter={(v) => formatToman(v)}
                />
              )}
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {/* By status donut */}
              <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
                <h2 className="mb-4 text-sm font-extrabold text-gray-800">
                  درخواست‌ها بر اساس وضعیت
                </h2>
                {charts.isLoading ? (
                  <Skeleton className="h-44 rounded-xl" />
                ) : (
                  <DonutChart
                    segments={(charts.data?.byStatus ?? []).map((s) => ({
                      label: requestStatusLabel(s.status),
                      value: s.count,
                    }))}
                  />
                )}
              </div>

              {/* Top services */}
              <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
                <h2 className="mb-4 text-sm font-extrabold text-gray-800">خدمات پرفروش</h2>
                {charts.isLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-8 rounded-lg" />
                    ))}
                  </div>
                ) : (
                  <BarList
                    items={(charts.data?.topServices ?? []).map((s) => ({
                      label: s.serviceName,
                      value: s.revenueToman,
                      hint: `${toPersianDigits(s.requests)} درخواست`,
                    }))}
                    valueFormatter={(v) => formatToman(v)}
                  />
                )}
              </div>

              {/* Payment success */}
              <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
                <h2 className="mb-4 text-sm font-extrabold text-gray-800">پرداخت‌ها</h2>
                {charts.isLoading ? (
                  <Skeleton className="h-40 rounded-xl" />
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <RateRing rate={charts.data?.payments.successRate ?? null} />
                    <BarList
                      items={Object.entries(charts.data?.payments.byStatus ?? {}).map(
                        ([st, cnt]) => ({
                          label: PAYMENT_STATUS_FA[st] ?? st,
                          value: cnt,
                        }),
                      )}
                    />
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ============ Recent activity (9.2.3) ============ */}
          <section className="rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 sm:px-5">
              <h2 className="text-sm font-extrabold text-gray-800">فعالیت‌های اخیر</h2>
              <Link
                href="/admin/audit-logs"
                className="text-brand-600 text-xs font-bold hover:underline"
              >
                مشاهده کامل لاگ ممیزی
              </Link>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {(dashboard.data?.recentActivity ?? []).length === 0 ? (
                <p className="px-5 py-10 text-center text-xs text-gray-400">فعالیتی ثبت نشده است</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {(dashboard.data?.recentActivity ?? []).map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-gray-800">
                          {ACTIVITY_ACTION_LABELS[a.action] ?? a.action}
                          <span className="mr-1.5 font-normal text-gray-500">
                            — {ENTITY_LABELS[a.entity] ?? a.entity}
                            {a.entityId ? ` (#${a.entityId})` : ''}
                          </span>
                        </p>
                        <p className="mt-0.5 text-[11px] text-gray-400">توسط {a.actorName}</p>
                      </div>
                      <time
                        className="shrink-0 text-[11px] text-gray-400"
                        dateTime={a.createdAt}
                        title={formatJalaliDateTime(a.createdAt)}
                      >
                        {formatRelative(a.createdAt)}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

const PAYMENT_STATUS_FA: Record<string, string> = {
  pending: 'در انتظار',
  verifying: 'در حال تأیید',
  successful: 'موفق',
  failed: 'ناموفق',
  cancelled: 'لغوشده',
  refunded: 'بازگشت‌شده',
};
