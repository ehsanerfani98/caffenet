'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  Clock,
  Eye,
  Hourglass,
  Inbox,
  MailOpen,
  PackageCheck,
  UserPlus,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Skeleton } from '@/components/common/Skeleton';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { KpiCard } from '@/components/operator/KpiCard';
import { operatorApi } from '@/lib/api/operator';
import { formatRelative, formatToman } from '@/lib/format';
import { useAuthStore } from '@/lib/stores/auth-store';
import { OPERATOR_KEYS } from '@/components/operator/requests-cache';

/**
 * Operator Dashboard (8.2) — KPI cards, «برداشتن مورد بعدی از صف» and the
 * recent-activity feed. Shares the ['operator','dashboard'] cache with the
 * shell top bar.
 */
export default function OperatorDashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [queueEmpty, setQueueEmpty] = useState(false);

  const canAssign = user?.permissions.includes('requests.assign') ?? false;

  const dashboard = useQuery({
    queryKey: OPERATOR_KEYS.dashboard,
    queryFn: operatorApi.dashboard,
  });

  const takeNext = useMutation({
    mutationFn: () => operatorApi.takeNext(),
    onSuccess: (result) => {
      setQueueEmpty(false);
      toast({
        title: 'درخواست به شما تخصیص یافت',
        description: `${result.serviceName} — ${result.trackingCode}`,
      });
      void queryClient.invalidateQueries({ queryKey: OPERATOR_KEYS.dashboard });
      void queryClient.invalidateQueries({ queryKey: OPERATOR_KEYS.lists });
      router.push(`/operator/requests/${result.requestId}`);
    },
    onError: (e) => {
      const status = (e as { status?: number }).status;
      if (status === 404) {
        setQueueEmpty(true);
      } else {
        toast({
          title: 'خطا در برداشتن از صف',
          description: e instanceof Error ? e.message : 'لطفاً دوباره تلاش کنید',
        });
      }
    },
  });

  const k = dashboard.data?.kpis;
  const activity = dashboard.data?.recentActivity ?? [];

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold text-gray-900">
            سلام، {(user?.fullName ?? 'اپراتور').split(' ')[0]} 👋
          </h2>
          <p className="mt-0.5 text-xs text-gray-400">خلاصه وضعیت کاری امروز شما</p>
        </div>
        <Link
          href="/operator/queue"
          className="bg-brand-50 text-brand-700 hover:bg-brand-100 flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors"
        >
          <Inbox className="h-3.5 w-3.5" />
          صف درخواست‌ها
        </Link>
      </div>

      {dashboard.isLoading ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-[72px] w-full rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      ) : dashboard.isError || !k ? (
        <ErrorState title="خطا در دریافت داشبورد" onRetry={() => void dashboard.refetch()} />
      ) : (
        <>
          {/* KPI grid */}
          <section
            aria-label="شاخص‌های عملکرد"
            className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4"
          >
            <KpiCard
              label="در انتظار بررسی (صف)"
              value={k.queue.pending}
              icon={Clock}
              tone="amber"
              href="/operator/queue"
              loading={dashboard.isLoading}
            />
            <KpiCard
              label="در حال بررسی"
              value={k.queue.reviewing}
              icon={Eye}
              tone="sky"
              href="/operator/queue"
              loading={dashboard.isLoading}
            />
            <KpiCard
              label="در انتظار پاسخ مشتری"
              value={k.queue.waitingForCustomer}
              icon={Hourglass}
              tone="violet"
              href="/operator/queue"
              loading={dashboard.isLoading}
            />
            <KpiCard
              label="تخصیص‌یافته به من"
              value={k.assignedToMe}
              icon={UserPlus}
              tone="brand"
              href="/operator/requests"
              loading={dashboard.isLoading}
            />
            <KpiCard
              label="درخواست‌های فعال من"
              value={k.myActiveRequests}
              icon={Inbox}
              tone="brand"
              href="/operator/requests"
              loading={dashboard.isLoading}
            />
            <KpiCard
              label="تکمیل‌شده امروز"
              value={k.completedToday}
              icon={CheckCircle2}
              tone="emerald"
              loading={dashboard.isLoading}
            />
            <KpiCard
              label="درآمد امروز"
              value={formatToman(k.revenueTodayToman)}
              icon={Banknote}
              tone="emerald"
              loading={dashboard.isLoading}
            />
            <KpiCard
              label="چت‌های خوانده‌نشده"
              value={k.unreadChats}
              icon={MailOpen}
              tone="rose"
              href="/operator/chat"
              loading={dashboard.isLoading}
            />
          </section>

          {/* Take-next hero (8.2.2) */}
          <section className="border-brand-200 from-brand-700 to-brand-600 rounded-2xl border bg-gradient-to-l p-5 text-white shadow-md">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 className="flex items-center gap-2 text-base font-extrabold">
                  <Zap className="h-5 w-5" />
                  صف درخواست‌ها
                </h2>
                <p className="text-brand-100 mt-1 text-xs leading-relaxed">
                  با هر بار فشردن دکمه، قدیمی‌ترین درخواستِ بدون اپراتور به‌صورت خودکار به شما تخصیص
                  می‌یابد و صفحه جزئیات آن باز می‌شود.
                </p>
              </div>
              {canAssign ? (
                <Button
                  size="lg"
                  className="text-brand-800 hover:bg-brand-50 w-full shrink-0 gap-2 bg-white sm:w-auto"
                  disabled={takeNext.isPending}
                  onClick={() => takeNext.mutate()}
                >
                  <UserPlus className="h-5 w-5" />
                  {takeNext.isPending ? 'در حال تخصیص…' : 'برداشتن مورد بعدی از صف'}
                </Button>
              ) : (
                <span className="text-brand-100 rounded-xl bg-white/10 px-3 py-2 text-[11px]">
                  دسترسی تخصیص درخواست برای حساب شما فعال نیست.
                </span>
              )}
            </div>
            {queueEmpty && (
              <div className="mt-4 rounded-xl bg-white/95">
                <EmptyState
                  className="py-6"
                  icon={<Inbox className="h-7 w-7" />}
                  title="صف خالی است"
                  description="در حال حاضر درخواست بدون اپراتوری وجود ندارد — به‌محض ثبت درخواست جدید اینجا اطلاع می‌یابید."
                />
              </div>
            )}
          </section>

          {/* Recent activity (8.2.3) */}
          <section aria-label="فعالیت اخیر">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-800">فعالیت اخیر من</h2>
              <Link
                href="/operator/activity"
                className="text-brand-600 flex items-center gap-1 text-xs font-bold hover:underline"
              >
                مشاهده همه
                <ArrowLeft className="h-3.5 w-3.5" />
              </Link>
            </div>

            {activity.length === 0 ? (
              <EmptyState
                title="هنوز فعالیتی ثبت نشده"
                description="با برداشتن اولین درخواست از صف، سابقه کاری شما اینجا نمایش داده می‌شود."
              />
            ) : (
              <ul className="space-y-2.5">
                {activity.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/operator/requests/${a.requestId}`}
                      className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3.5 shadow-sm transition-shadow hover:shadow-md active:bg-gray-50"
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                          a.active ? 'bg-brand-50 text-brand-700' : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        <PackageCheck className="h-4.5 w-4.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-bold text-gray-900">
                            {a.serviceName}
                          </p>
                          <StatusBadge status={a.status} />
                        </div>
                        <p className="mt-0.5 truncate text-xs text-gray-500">
                          {a.customerName}
                          <span dir="ltr" className="mr-2 font-mono text-[10px] text-gray-400">
                            {a.trackingCode}
                          </span>
                        </p>
                        <p className="mt-0.5 text-[10px] text-gray-400">
                          {formatRelative(a.createdAt)}
                          {a.note ? ` — ${a.note}` : ''}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
