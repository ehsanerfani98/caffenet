'use client';

/**
 * PriceBreakdown (Phase 5.2.7) — display a request's price components.
 *
 * Data source: GET /api/v1/requests/:id/costs (RequestCostDto from @caffenet/shared)
 *  FinalTotal = Labor + Material + Additional − Discount (computed SERVER-SIDE).
 *
 * Design notes:
 *  - RTL-first (Persian), pure presentational — no fetching, no side effects
 *  - Amounts arrive in Toman (major units) — formatted via Intl.NumberFormat('fa-IR')
 *  - Discount rows render with a destructive accent and a leading − sign
 */

import { cn } from '@/lib/utils';

interface PriceBreakdownProps {
  laborFee: number;
  materialCost: number;
  additionalCost: number;
  discountAmount: number;
  finalTotal: number;
  /** Currency label shown next to each amount (default: تومان) */
  unit?: string;
  /** Hide zero-value rows for a compact look (default: true) */
  compact?: boolean;
  className?: string;
}

function fa(amount: number): string {
  try {
    return new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 }).format(amount);
  } catch {
    return String(amount);
  }
}

export function PriceBreakdown({
  laborFee,
  materialCost,
  additionalCost,
  discountAmount,
  finalTotal,
  unit = 'تومان',
  compact = true,
  className,
}: PriceBreakdownProps) {
  const rows: Array<{ label: string; value: number; negative?: boolean }> = [
    { label: 'اجاره‌بها / دستمزد خدمت', value: laborFee },
    { label: 'هزینه مواد', value: materialCost },
    { label: 'هزینه‌های تکمیلی', value: additionalCost },
    { label: 'تخفیف', value: discountAmount, negative: true },
  ];
  const visible = compact
    ? rows.filter((r) => r.value > 0 || r.label === 'اجاره‌بها / دستمزد خدمت')
    : rows;

  return (
    <div
      className={cn(
        'divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white p-4 dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900',
        className,
      )}
      dir="rtl"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">تفکیک قیمت</h3>
        <span className="text-xs text-gray-400">محاسبه سمت سرور</span>
      </div>

      <dl className="space-y-2">
        {visible.map((r) => (
          <div key={r.label} className="flex items-center justify-between text-sm">
            <dt
              className={cn(
                'text-gray-600 dark:text-gray-400',
                r.negative && 'text-rose-600 dark:text-rose-400',
              )}
            >
              {r.label}
            </dt>
            <dd
              className={cn(
                'font-medium tabular-nums',
                r.negative
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-gray-900 dark:text-gray-100',
              )}
            >
              {r.negative && r.value > 0 ? '−' : ''}
              {fa(r.value)} <span className="text-xs text-gray-400">{unit}</span>
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-3 flex items-center justify-between rounded-lg bg-violet-50 px-3 py-2.5 dark:bg-violet-950/40">
        <span className="text-sm font-semibold text-violet-800 dark:text-violet-300">
          مبلغ نهایی
        </span>
        <span className="text-base font-bold tabular-nums text-violet-900 dark:text-violet-200">
          {fa(finalTotal)} <span className="text-xs font-normal">{unit}</span>
        </span>
      </div>
    </div>
  );
}
