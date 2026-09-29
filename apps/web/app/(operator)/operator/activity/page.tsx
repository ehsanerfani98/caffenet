'use client';

import { useQuery } from '@tanstack/react-query';
import { Activity as ActivityIcon, CheckCircle2, Clock3, FolderCheck } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ListSkeleton } from '@/components/common/Skeleton';
import { KpiCard } from '@/components/operator/KpiCard';
import { operatorApi } from '@/lib/api/operator';
import { formatJalaliDateTime, toPersianDigits } from '@/lib/format';
import { OPERATOR_KEYS } from '@/components/operator/requests-cache';

/**
 * Operator Activity (8.5) — personal stats (handled / completed / avg
 * completion time) + the recent assignment feed with assigned/completed times.
 */
export default function OperatorActivityPage() {
  const activity = useQuery({
    queryKey: OPERATOR_KEYS.activity,
    queryFn: operatorApi.activity,
  });

  const stats = activity.data?.stats;
  const items = activity.data?.items ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-extrabold text-gray-900">فعالیت من</h2>
        <p className="mt-0.5 text-xs text-gray-400">سابقه رسیدگی شما به درخواست‌ها و آمار عملکرد</p>
      </div>

      {/* Stats (8.5.1) */}
      <section aria-label="آمار فعالیت" className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        <KpiCard
          label="کل درخواست‌های رسیدگی‌شده"
          value={stats ? stats.totalHandled : null}
          icon={FolderCheck}
          tone="brand"
          loading={activity.isLoading}
        />
        <KpiCard
          label="کل تکمیل‌شده‌ها"
          value={stats ? stats.completedTotal : null}
          icon={CheckCircle2}
          tone="emerald"
          loading={activity.isLoading}
        />
        <KpiCard
          label="میانگین زمان تکمیل"
          value={
            stats
              ? stats.avgCompletionHours === null
                ? '—'
                : `${toPersianDigits(stats.avgCompletionHours)} ساعت`
              : null
          }
          icon={Clock3}
          tone="sky"
          loading={activity.isLoading}
          className="col-span-2 xl:col-span-1"
        />
      </section>

      {/* Items (8.5.2) */}
      {activity.isLoading ? (
        <ListSkeleton rows={6} />
      ) : activity.isError ? (
        <ErrorState title="خطا در دریافت فعالیت‌ها" onRetry={() => void activity.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<ActivityIcon className="h-8 w-8" />}
          title="هنوز فعالیتی ثبت نشده"
          description="با تخصیص و رسیدگی به درخواست‌ها، سابقه کاری شما اینجا ساخته می‌شود."
        />
      ) : (
        <ul className="space-y-2.5">
          {items.map((a) => (
            <li key={a.id}>
              <Link
                href={`/operator/requests/${a.requestId}`}
                className="block rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md active:bg-gray-50"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-bold text-gray-900">{a.serviceName}</p>
                  <StatusBadge status={a.status} />
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
                  <span className="truncate">{a.customerName}</span>
                  <span dir="ltr" className="font-mono text-[10px] text-gray-400">
                    {a.trackingCode}
                  </span>
                  {a.active && (
                    <span className="bg-brand-50 text-brand-700 rounded-full px-2 py-0.5 text-[10px] font-bold">
                      فعال
                    </span>
                  )}
                </p>
                <dl className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <dt className="text-gray-400">زمان تخصیص</dt>
                    <dd className="mt-0.5 text-gray-700">{formatJalaliDateTime(a.assignedAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-400">زمان تکمیل</dt>
                    <dd className="mt-0.5 text-gray-700">
                      {a.completedAt ? formatJalaliDateTime(a.completedAt) : '—'}
                    </dd>
                  </div>
                </dl>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
