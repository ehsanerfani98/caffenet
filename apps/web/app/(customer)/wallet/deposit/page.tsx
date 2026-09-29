'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { MobileHeader } from '@/components/common/MobileHeader';
import { paymentsApi } from '@/lib/api/wallet';
import { formatToman } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Deposit flow (7.8.2) — amount → gateway → redirect to gateway URL.
 * Callback returns to /wallet/payment/callback which verifies + redirects here.
 */

const PRESET_AMOUNTS = [50_000, 100_000, 200_000, 500_000];
const MAX_DEPOSIT = 500_000; // WALLET_CONFIG ceiling (Toman)

function DepositInner() {
  const search = useSearchParams();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [gateway, setGateway] = useState<'zarinpal' | 'zibal'>(
    (search.get('gateway') as 'zarinpal' | 'zibal') ?? 'zarinpal',
  );
  const [error, setError] = useState<string | null>(null);

  const amountNum = Number(amount.replace(/[^\d]/g, ''));

  const depositMutation = useMutation({
    mutationFn: () =>
      paymentsApi.create({ amountToman: amountNum, gateway, description: 'شارژ کیف پول' }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['wallet'] });
      // Full navigation to the gateway — not SPA routing
      window.location.href = result.redirectUrl;
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'ایجاد پرداخت ناموفق بود'),
  });

  // Post-callback return (payment verified)
  if (search.get('paid') === '1') {
    void queryClient.invalidateQueries({ queryKey: ['wallet'] });
    void queryClient.invalidateQueries({ queryKey: ['wallet-transactions'] });
  }

  return (
    <>
      <MobileHeader title="افزایش موجودی" showBack showBell={false} />
      <div className="space-y-5 pt-4">
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-gray-800">مبلغ شارژ (تومان)</h2>

          <input
            dir="ltr"
            inputMode="numeric"
            className={cn(
              'focus:border-brand-500 focus:ring-brand-100 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-center text-lg font-extrabold tracking-wider text-gray-900 focus:outline-none focus:ring-2',
              error && 'border-red-300',
            )}
            placeholder="0"
            value={amount ? amountNum.toLocaleString('en-US') : ''}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
          />

          <div className="mt-3 grid grid-cols-4 gap-2">
            {PRESET_AMOUNTS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setAmount(String(v))}
                className={cn(
                  'rounded-xl border px-1 py-2 text-[11px] font-bold transition-colors',
                  amountNum === v
                    ? 'border-brand-600 bg-brand-50 text-brand-700'
                    : 'border-gray-200 bg-white text-gray-500',
                )}
              >
                {v / 1000}k
              </button>
            ))}
          </div>

          {amountNum > MAX_DEPOSIT && (
            <p className="mt-2 text-xs font-medium text-red-500">
              حداکثر مبلغ شارژ {formatToman(MAX_DEPOSIT)} است
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-gray-800">درگاه پرداخت</h2>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                { key: 'zarinpal', label: 'زرین‌پال' },
                { key: 'zibal', label: 'زیبال' },
              ] as const
            ).map((g) => (
              <button
                key={g.key}
                type="button"
                onClick={() => setGateway(g.key)}
                className={cn(
                  'rounded-xl border-2 p-3.5 text-sm font-bold transition-colors',
                  gateway === g.key
                    ? 'border-brand-600 bg-brand-50 text-brand-800'
                    : 'border-gray-200 bg-white text-gray-600',
                )}
              >
                {g.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-gray-400">
            پس از زدن دکمه پرداخت به درگاه بانکی منتقل می‌شوید؛ وجه به‌محض تأیید به کیف پول اضافه
            می‌شود.
          </p>
        </section>

        {error && (
          <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-600">
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={!amountNum || amountNum > MAX_DEPOSIT || depositMutation.isPending}
          onClick={() => {
            setError(null);
            depositMutation.mutate();
          }}
          className="bg-brand-600 shadow-brand-600/25 active:bg-brand-700 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-extrabold text-white shadow-xl disabled:opacity-40"
        >
          {depositMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          پرداخت و شارژ کیف پول
        </button>
      </div>
    </>
  );
}

export default function DepositPage() {
  return (
    <Suspense
      fallback={
        <>
          <MobileHeader title="افزایش موجودی" showBack showBell={false} />
          <div className="flex justify-center py-16">
            <Loader2 className="text-brand-600 h-6 w-6 animate-spin" />
          </div>
        </>
      }
    >
      <DepositInner />
    </Suspense>
  );
}
