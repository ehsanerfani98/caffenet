'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Search } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { CategoryCard } from '@/components/common/CategoryCard';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { MobileHeader } from '@/components/common/MobileHeader';
import { PullToRefresh } from '@/components/common/PullToRefresh';
import { RequestCard } from '@/components/common/RequestCard';
import { ServiceCard } from '@/components/common/ServiceCard';
import { catalogApi } from '@/lib/api/catalog';
import { requestsApi } from '@/lib/api/requests';
import { walletApi } from '@/lib/api/wallet';
import { useDebounce } from '@/lib/hooks/use-debounce';
import { useAuthStore } from '@/lib/stores/auth-store';
import { statusProgress } from '@/lib/status-meta';
import { formatToman, toPersianDigits } from '@/lib/format';

/**
 * Home page (7.4) — greeting + wallet, search, categories, popular services,
 * active request card, recent requests.
 */
export default function CustomerHomePage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);

  // 7.4.2 — debounced search navigates to services list
  const searchActive = debouncedSearch.trim().length >= 2;
  const searchResults = useQuery({
    queryKey: ['services', 'search', debouncedSearch],
    queryFn: () => catalogApi.services({ search: debouncedSearch.trim(), limit: 6 }),
    enabled: searchActive,
  });

  const wallet = useQuery({ queryKey: ['wallet'], queryFn: walletApi.get });
  const categories = useQuery({ queryKey: ['categories'], queryFn: catalogApi.categories });
  const popular = useQuery({
    queryKey: ['services', 'popular'],
    queryFn: () => catalogApi.services({ page: 1, limit: 5 }),
  });
  const myRequests = useQuery({
    queryKey: ['requests', 'home'],
    queryFn: () => requestsApi.list({ page: 1, limit: 10 }),
  });

  const invalidateAll = async () => {
    void queryClient.invalidateQueries({ queryKey: ['wallet'] });
    void queryClient.invalidateQueries({ queryKey: ['categories'] });
    void queryClient.invalidateQueries({ queryKey: ['services'] });
    void queryClient.invalidateQueries({ queryKey: ['requests'] });
  };

  const requests = myRequests.data?.items ?? [];
  const activeRequest =
    requests.find(
      (r) => !['completed', 'cancelled', 'rejected', 'paid'].includes(String(r.status)),
    ) ?? null;
  const recentRequests = requests.slice(0, 3);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'صبح بخیر';
    if (h < 18) return 'ظهر بخیر';
    return 'عصر بخیر';
  })();

  return (
    <>
      <MobileHeader title="" walletBalance={wallet.data?.balance} showBell />

      <PullToRefresh onRefresh={invalidateAll} className="pt-2">
        {/* 7.4.1 — greeting + wallet card */}
        <section className="from-brand-600 to-brand-500 shadow-brand-600/20 mb-6 rounded-2xl bg-gradient-to-l p-5 text-white shadow-lg">
          <p className="text-xs opacity-90">{greeting} 👋</p>
          <h1 className="mt-0.5 text-lg font-extrabold">{user?.fullName ?? 'کاربر عزیز'}</h1>
          <Link
            href="/wallet"
            className="mt-4 flex items-center justify-between rounded-xl bg-white/15 px-4 py-3 backdrop-blur active:bg-white/25"
          >
            <span className="flex items-center gap-1.5 text-xs opacity-90">موجودی کیف پول</span>
            <span className="text-sm font-extrabold">
              {wallet.isLoading ? '…' : formatToman(wallet.data?.balance ?? 0)}
            </span>
          </Link>
        </section>

        {/* 7.4.2 — search bar */}
        <div className="relative mb-6">
          <Search className="h-4.5 w-4.5 absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            placeholder="جستجوی خدمات…"
            className="focus:border-brand-500 focus:ring-brand-100 w-full rounded-2xl border border-gray-100 bg-white py-3 pl-4 pr-10 text-sm shadow-sm focus:outline-none focus:ring-2"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {searchActive && (
          <section className="mb-6 space-y-3">
            <h2 className="text-sm font-bold text-gray-800">نتایج جستجو</h2>
            {searchResults.isLoading && <p className="text-xs text-gray-400">…</p>}
            {searchResults.data && (searchResults.data.items ?? []).length === 0 && (
              <p className="text-xs text-gray-400">موردی یافت نشد</p>
            )}
            {(searchResults.data?.items ?? []).map((s) => (
              <ServiceCard key={s.id} service={s} />
            ))}
          </section>
        )}

        {/* 7.4.3 — categories horizontal scroll */}
        <section className="mb-6">
          <h2 className="mb-3 text-sm font-bold text-gray-800">دسته‌بندی‌ها</h2>
          {categories.isLoading ? (
            <div className="flex gap-3 overflow-hidden">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 w-20 animate-pulse rounded-2xl bg-gray-200/80" />
              ))}
            </div>
          ) : categories.isError ? (
            <ErrorState title="خطا در دریافت دسته‌بندی‌ها" onRetry={() => categories.refetch()} />
          ) : (categories.data ?? []).length === 0 ? (
            <EmptyState title="هنوز دسته‌بندی ثبت نشده" />
          ) : (
            <div className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 pb-1">
              {(categories.data ?? []).map((c) => (
                <CategoryCard key={c.id} category={c} size="sm" />
              ))}
            </div>
          )}
        </section>

        {/* 7.4.5 — active request card */}
        {activeRequest && (
          <section className="mb-6">
            <h2 className="mb-3 text-sm font-bold text-gray-800">درخواست فعال</h2>
            <Link
              href={`/requests/${activeRequest.id}`}
              className="border-brand-100 bg-brand-50/60 active:bg-brand-50 block rounded-2xl border p-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900">
                  {activeRequest.service?.name ?? 'درخواست'}
                </h3>
                <span className="text-brand-700 text-xs font-bold">
                  {statusProgress(String(activeRequest.status))}٪
                </span>
              </div>
              <div className="bg-brand-100 mt-3 h-2 overflow-hidden rounded-full">
                <div
                  className="bg-brand-600 h-full rounded-full transition-all"
                  style={{ width: `${statusProgress(String(activeRequest.status))}%` }}
                />
              </div>
              <span className="text-brand-700 mt-3 flex items-center gap-1 text-[11px]">
                مشاهده وضعیت
                <ChevronLeft className="h-3.5 w-3.5" />
              </span>
            </Link>
          </section>
        )}

        {/* 7.4.6 — recent requests */}
        <section className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-800">درخواست‌های اخیر</h2>
            <Link href="/requests" className="text-brand-700 flex items-center text-xs font-medium">
              همه
              <ChevronLeft className="h-3.5 w-3.5" />
            </Link>
          </div>
          {myRequests.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-2xl bg-gray-200/80" />
              ))}
            </div>
          ) : recentRequests.length === 0 ? (
            <EmptyState
              title="هنوز درخواستی ثبت نکرده‌اید"
              description="از میان خدمات موجود، اولین درخواست خود را ثبت کنید"
              action={
                <Link
                  href="/services"
                  className="bg-brand-600 active:bg-brand-700 rounded-full px-5 py-2.5 text-xs font-bold text-white"
                >
                  مشاهده خدمات
                </Link>
              }
            />
          ) : (
            <div className="space-y-3">
              {recentRequests.map((r) => (
                <RequestCard key={r.id} request={r} />
              ))}
            </div>
          )}
        </section>

        {/* 7.4.4 — popular services */}
        <section className="mb-4">
          <h2 className="mb-3 text-sm font-bold text-gray-800">خدمات پرطرفدار</h2>
          {popular.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-2xl bg-gray-200/80" />
              ))}
            </div>
          ) : (popular.data?.items ?? []).length === 0 ? (
            <EmptyState title="هنوز خدمتی ثبت نشده" />
          ) : (
            <div className="space-y-3">
              {(popular.data?.items ?? []).slice(0, 5).map((s) => (
                <ServiceCard key={s.id} service={s} />
              ))}
            </div>
          )}
        </section>

        <p className="pb-4 pt-2 text-center text-[10px] text-gray-300">
          نسخه {toPersianDigits('1.0.0')} — کافی‌نت
        </p>
      </PullToRefresh>
    </>
  );
}
