'use client';

import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { CategoryCard } from '@/components/common/CategoryCard';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { MobileHeader } from '@/components/common/MobileHeader';
import { Skeleton } from '@/components/common/Skeleton';
import { catalogApi } from '@/lib/api/catalog';

/**
 * Categories grid page (7.5.1).
 */
export default function CategoriesPage() {
  const [search, setSearch] = useState('');
  const categories = useQuery({ queryKey: ['categories'], queryFn: catalogApi.categories });

  const items = (categories.data ?? []).filter((c) =>
    search.trim() ? c.name.includes(search.trim()) : true,
  );

  return (
    <>
      <MobileHeader title="خدمات" showBell />
      <div className="pt-3">
        <div className="relative mb-5">
          <Search className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            placeholder="جستجو در دسته‌بندی‌ها…"
            className="focus:border-brand-500 focus:ring-brand-100 w-full rounded-2xl border border-gray-100 bg-white py-3 pl-4 pr-10 text-sm shadow-sm focus:outline-none focus:ring-2"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {categories.isLoading ? (
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        ) : categories.isError ? (
          <ErrorState onRetry={() => categories.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            title="دسته‌بندی‌ای یافت نشد"
            description="همه دسته‌بندی‌های خدمات اینجا نمایش داده می‌شوند"
          />
        ) : (
          <div className="grid grid-cols-3 gap-x-3 gap-y-5">
            {items.map((c) => (
              <div key={c.id} className="flex justify-center">
                <CategoryCard category={c} />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
