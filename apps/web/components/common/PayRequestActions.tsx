'use client';

/**
 * PayRequestActions (Phase 6.5) — method chooser for paying a request that
 * reached waiting_for_payment.
 *
 * Flow:
 *  - «کیف پول» → POST /api/v1/requests/:id/pay { method: 'wallet' }
 *  - «پرداخت آنلاین» → POST /api/v1/requests/:id/pay { method: 'online' }
 *    then redirect the browser to the returned gateway URL.
 *
 * Purely presentational — the page supplies the request id and an apiClient.
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface PayRequestActionsProps {
  requestId: string;
  /** Toman (major units) — shown on the confirm buttons */
  amountToman: number;
  /** Performs POST /requests/:id/pay and returns the JSON result */
  onPay: (
    requestId: string,
    method: 'wallet' | 'online',
    gateway?: 'zarinpal' | 'zibal',
  ) => Promise<{ redirectUrl?: string; walletBalance?: number }>;
  onPaid?: () => void;
  disabled?: boolean;
  className?: string;
}

function fa(amount: number): string {
  try {
    return new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 }).format(amount);
  } catch {
    return String(amount);
  }
}

export function PayRequestActions({
  requestId,
  amountToman,
  onPay,
  onPaid,
  disabled,
  className,
}: PayRequestActionsProps) {
  const [busy, setBusy] = useState<'wallet' | 'online' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePay(method: 'wallet' | 'online') {
    setError(null);
    setBusy(method);
    try {
      const result = await onPay(requestId, method, method === 'online' ? 'zarinpal' : undefined);
      if (method === 'online' && result.redirectUrl) {
        // Gateway redirect — full navigation, not SPA routing
        window.location.href = result.redirectUrl;
        return;
      }
      onPaid?.();
    } catch (e) {
      setError((e as Error).message || 'پرداخت ناموفق بود');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div dir="rtl" className={cn('space-y-3', className)}>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={disabled || busy !== null}
          onClick={() => handlePay('wallet')}
          className="rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
        >
          {busy === 'wallet' ? 'در حال پردازش…' : 'پرداخت از کیف پول'}
        </button>
        <button
          type="button"
          disabled={disabled || busy !== null}
          onClick={() => handlePay('online')}
          className="rounded-xl border-2 border-violet-600 bg-white px-4 py-3 text-sm font-bold text-violet-700 transition-colors hover:bg-violet-50 disabled:opacity-50"
        >
          {busy === 'online' ? 'در حال انتقال…' : 'پرداخت آنلاین'}
        </button>
      </div>
      <p className="text-center text-xs text-gray-500">
        مبلغ قابل پرداخت: <b className="tabular-nums">{fa(amountToman)}</b> تومان
      </p>
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-rose-50 px-3 py-2 text-center text-xs font-bold text-rose-700"
        >
          {error}
        </p>
      )}
    </div>
  );
}
