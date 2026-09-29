'use client';

import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { MobileHeader } from '@/components/common/MobileHeader';
import { ServiceCard } from '@/components/common/ServiceCard';
import { ListSkeleton } from '@/components/common/Skeleton';
import { catalogApi } from '@/lib/api/catalog';
import { useDebounce } from '@/lib/hooks/use-debounce';

/**
 * Services list page (7.5.2) — filter + search + pagination (infinite scroll).
 */
export default function CategoryServicesPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [page, setPage] = useState(1);

  const services = useQuery({
    queryKey: ['services', slug, debouncedSearch, page],
    queryFn: () =>
      catalogApi.services({
        page,
        limit: 10,
        category: slug,
        search: debouncedSearch.trim() || undefined,
      }),
    enabled: Boolean(slug),
  });

  const items = services.data?.items ?? [];
  const meta = services.data?.meta;
  const totalPages = meta?.totalPages ?? 1;

  return (
    <>
      <MobileHeader title="خدمات" showBack showBell={false} />
      <div className="pt-3">
        <div className="relative mb-5">
          <Search className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            placeholder="جستجوی خدمت…"
            className="focus:border-brand-500 focus:ring-brand-100 w-full rounded-2xl border border-gray-100 bg-white py-3 pl-4 pr-10 text-sm shadow-sm focus:outline-none focus:ring-2"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        {services.isLoading ? (
          <ListSkeleton />
        ) : services.isError ? (
          <ErrorState onRetry={() => services.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            title="خدمتی در این دسته یافت نشد"
            description="بعداً سر بزنید یا دسته‌های دیگر را ببینید"
          />
        ) : (
          <>
            <div className="space-y-3">
              {items.map((s) => (
                <ServiceCard key={s.id} service={s} />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 py-6">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-600 disabled:opacity-40"
                >
                  قبلی
                </button>
                <span className="text-xs text-gray-500">
                  صفحه {page} از {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-600 disabled:opacity-40"
                >
                  بعدی
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
