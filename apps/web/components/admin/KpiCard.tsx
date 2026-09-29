'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toPersianDigits } from '@/lib/format';

/**
 * KpiCard (9.2.1) — one dashboard metric. Counts render with Persian digits;
 * monetary values should be passed pre-formatted via `formatted`.
 */
export function KpiCard({
  icon: Icon,
  label,
  value,
  formatted,
  tone = 'default',
}: {
  icon: LucideIcon;
  label: string;
  value?: number;
  /** Pre-formatted value (e.g. formatToman output) — wins over `value` */
  formatted?: string;
  tone?: 'default' | 'green' | 'amber' | 'red' | 'gray';
}) {
  const tones: Record<string, string> = {
    default: 'bg-gray-100 text-gray-600',
    green: 'bg-brand-50 text-brand-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-500',
    gray: 'bg-gray-100 text-gray-500',
  };
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
          tones[tone],
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium text-gray-500">{label}</p>
        <p className="mt-0.5 text-lg font-extrabold leading-tight text-gray-900">
          {formatted ?? (value !== undefined ? toPersianDigits(value) : '—')}
        </p>
      </div>
    </div>
  );
}
