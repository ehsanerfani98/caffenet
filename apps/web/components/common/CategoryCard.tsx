'use client';

import Link from 'next/link';
import type { CategoryDto } from '@/lib/api/catalog';
import { toPersianDigits } from '@/lib/format';

/**
 * CategoryCard (7.5.5) — circular icon tile for horizontal scroll on home,
 * and grid tile on the categories page.
 */
export function CategoryCard({
  category,
  size = 'md',
}: {
  category: CategoryDto;
  size?: 'sm' | 'md';
}) {
  const box = size === 'sm' ? 'h-16 w-16' : 'h-20 w-20';
  return (
    <Link
      href={`/services/${category.slug}`}
      className="flex w-20 shrink-0 flex-col items-center gap-2"
    >
      <div
        className={`${box} active:bg-brand-50 flex items-center justify-center rounded-2xl border border-gray-100 bg-white text-2xl shadow-sm transition-colors`}
      >
        {category.icon ? <span aria-hidden>{category.icon}</span> : <span aria-hidden>🗂️</span>}
      </div>
      <span className="line-clamp-2 text-center text-[11px] font-medium leading-tight text-gray-700">
        {category.name}
      </span>
      {typeof category.servicesCount === 'number' && category.servicesCount > 0 ? (
        <span className="text-[10px] text-gray-400">
          {toPersianDigits(category.servicesCount)} خدمت
        </span>
      ) : null}
    </Link>
  );
}
