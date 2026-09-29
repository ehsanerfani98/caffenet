'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { toPersianDigits } from '@/lib/format';

/**
 * Pagination (9.x) — قبلی/بعدی + «صفحه x از y». RTL arrows.
 */
export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="صفحه‌بندی" className="flex items-center justify-center gap-4 py-5">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronRight className="h-3.5 w-3.5" />
        قبلی
      </button>
      <span className="text-xs text-gray-500">
        صفحه {toPersianDigits(page)} از {toPersianDigits(totalPages)}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        بعدی
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>
    </nav>
  );
}
