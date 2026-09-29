'use client';

/**
 * TransactionItem (Phase 6.2.5) — single ledger row of the wallet history.
 *
 * Data source: WalletTransactionDto from @caffenet/shared
 *  (GET /api/v1/wallet/transactions).
 *
 * Design notes:
 *  - RTL-first (Persian), purely presentational
 *  - Credit rows (amount > 0) show an emerald + badge; debit rows show a
 *    rose − badge; balances are shown after each row for full transparency
 *  - Type labels mirror WalletTransactionType from the shared package
 */

import { cn } from '@/lib/utils';
import type { WalletTransactionDto } from '@caffenet/shared';

interface TransactionItemProps {
  transaction: WalletTransactionDto;
  className?: string;
}

const TYPE_META: Record<string, { label: string; icon: string }> = {
  deposit: { label: 'شارژ کیف پول', icon: '⬇️' },
  withdrawal: { label: 'برداشت', icon: '⬆️' },
  service_payment: { label: 'پرداخت خدمت', icon: '🧾' },
  refund: { label: 'بازگشت وجه', icon: '↩️' },
  discount: { label: 'تخفیف', icon: '🎁' },
  bonus: { label: 'هدیه', icon: '🎉' },
  manual_adjustment: { label: 'تعدیل دستی', icon: '🛠️' },
  payment_reversal: { label: 'ابطال پرداخت', icon: '⟲' },
};

function fa(amount: number): string {
  try {
    return new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 }).format(amount);
  } catch {
    return String(amount);
  }
}

function faDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function TransactionItem({ transaction, className }: TransactionItemProps) {
  const meta = TYPE_META[transaction.type] ?? { label: transaction.type, icon: '•' };
  const isCredit = transaction.amount > 0;

  return (
    <article
      dir="rtl"
      className={cn(
        'flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-white p-4 text-right',
        className,
      )}
      aria-label={meta.label}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={cn(
            'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm',
            isCredit ? 'bg-emerald-50' : 'bg-rose-50',
          )}
          aria-hidden
        >
          {meta.icon}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-gray-900">{meta.label}</p>
          <p className="mt-0.5 truncate text-xs text-gray-500">{transaction.description || '—'}</p>
          <p className="mt-1 text-[11px] text-gray-400">
            {faDate(transaction.createdAt)}
            {transaction.referenceType === 'request' && transaction.referenceId
              ? ` · درخواست #${transaction.referenceId}`
              : ''}
          </p>
        </div>
      </div>

      <div className="shrink-0 text-left">
        <p
          className={cn(
            'text-sm font-extrabold tabular-nums',
            isCredit ? 'text-emerald-600' : 'text-rose-600',
          )}
        >
          {isCredit ? '+' : '−'}
          {fa(Math.abs(transaction.amount))}{' '}
          <span className="text-[10px] font-bold text-gray-400">تومان</span>
        </p>
        <p className="mt-1 text-[11px] tabular-nums text-gray-400">
          موجودی: {fa(transaction.balanceAfter)}
        </p>
      </div>
    </article>
  );
}
