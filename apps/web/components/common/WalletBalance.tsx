'use client';

/**
 * WalletBalance (Phase 6.1.5) — compact wallet summary card.
 *
 * Data source: WalletDto from @caffenet/shared (GET /api/v1/wallet).
 *
 * Design notes:
 *  - RTL-first (Persian), purely presentational — data fetching belongs to the page
 *  - Amount arrives in Toman (major units), formatted via Intl.NumberFormat('fa-IR')
 *  - Status mirrors WalletStatus: active / frozen / closed
 *  - Optional refresh hook so pages can re-fetch after a payment completes
 */

import { cn } from '@/lib/utils';
import type { WalletDto } from '@caffenet/shared';

interface WalletBalanceProps {
  wallet: WalletDto | null | undefined;
  loading?: boolean;
  onDepositClick?: () => void;
  onTransactionsClick?: () => void;
  className?: string;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  active: { label: 'فعال', cls: 'bg-emerald-100 text-emerald-800' },
  frozen: { label: 'مسدود', cls: 'bg-amber-100 text-amber-800' },
  closed: { label: 'بسته', cls: 'bg-rose-100 text-rose-800' },
};

function fa(amount: number): string {
  try {
    return new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 }).format(amount);
  } catch {
    return String(amount);
  }
}

export function WalletBalance({
  wallet,
  loading,
  onDepositClick,
  onTransactionsClick,
  className,
}: WalletBalanceProps) {
  if (loading || !wallet) {
    return (
      <div
        className={cn('animate-pulse rounded-2xl bg-gray-100 p-5 text-right', className)}
        aria-busy="true"
      >
        <div className="h-4 w-24 rounded bg-gray-200" />
        <div className="mt-3 h-8 w-40 rounded bg-gray-200" />
      </div>
    );
  }

  const status = STATUS_BADGE[wallet.status] ?? {
    label: wallet.status,
    cls: 'bg-gray-100 text-gray-700',
  };

  return (
    <section
      dir="rtl"
      className={cn(
        'rounded-2xl border border-gray-200 bg-white p-5 text-right shadow-sm',
        className,
      )}
      aria-label="کیف پول"
    >
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl" aria-hidden>
            👛
          </span>
          <h2 className="text-sm font-bold text-gray-700">کیف پول</h2>
          <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', status.cls)}>
            {status.label}
          </span>
        </div>
        {onTransactionsClick && (
          <button
            type="button"
            onClick={onTransactionsClick}
            className="text-xs font-bold text-violet-700 underline-offset-4 hover:underline"
          >
            تراکنش‌ها
          </button>
        )}
      </header>

      <p className="mt-4 flex items-baseline justify-end gap-2" dir="rtl">
        <span className="text-3xl font-extrabold tracking-tight text-gray-900">
          {fa(wallet.balance)}
        </span>
        <span className="text-sm font-bold text-gray-500">تومان</span>
      </p>

      {onDepositClick && (
        <button
          type="button"
          onClick={onDepositClick}
          className="mt-4 w-full rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-violet-700 active:bg-violet-800"
        >
          افزایش موجودی
        </button>
      )}
    </section>
  );
}
