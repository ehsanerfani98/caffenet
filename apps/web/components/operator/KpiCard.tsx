'use client';

import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { Skeleton } from '@/components/common/Skeleton';
import { toPersianDigits } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * KpiCard (8.2.1) — operator dashboard metric tile.
 * Numbers are shown with Persian digits; money values should be pre-formatted
 * (e.g. via formatToman) and passed as strings.
 */

const TONES = {
  brand: 'bg-brand-50 text-brand-700',
  amber: 'bg-amber-50 text-amber-600',
  sky: 'bg-sky-50 text-sky-600',
  violet: 'bg-violet-50 text-violet-600',
  rose: 'bg-rose-50 text-rose-600',
  emerald: 'bg-emerald-50 text-emerald-600',
} as const;

export type KpiCardTone = keyof typeof TONES;

interface KpiCardProps {
  label: string;
  value: number | string | null | undefined;
  icon: LucideIcon;
  tone?: KpiCardTone;
  href?: string;
  loading?: boolean;
  className?: string;
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  tone = 'brand',
  href,
  loading = false,
  className,
}: KpiCardProps) {
  const display =
    loading || value === null || value === undefined
      ? null
      : typeof value === 'number'
        ? toPersianDigits(value)
        : value;

  const body = (
    <div
      className={cn(
        'flex h-full items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-shadow',
        href && 'hover:shadow-md active:bg-gray-50',
        className,
      )}
    >
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
          TONES[tone],
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium text-gray-400">{label}</p>
        {display === null ? (
          <Skeleton className="mt-1 h-5 w-14" />
        ) : (
          <p className="truncate text-lg font-extrabold tabular-nums text-gray-900">{display}</p>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full" aria-label={label}>
        {body}
      </Link>
    );
  }
  return body;
}
