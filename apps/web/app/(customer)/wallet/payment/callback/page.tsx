'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { MobileHeader } from '@/components/common/MobileHeader';
import { paymentsApi } from '@/lib/api/wallet';

/**
 * Payment result page — lands here from the gateway when
 * ZARINPAL_CALLBACK_URL points at this SPA route (deployment recommends it).
 * Verifies server-side (idempotent) and shows the outcome.
 */
function PaymentCallbackInner() {
  const search = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const paymentId = search.get('paymentId') ?? '';
  const gatewayStatus = search.get('Status'); // zarinpal: OK / NOK

  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [manualVerifyDone, setManualVerifyDone] = useState(false);

  const payment = useQuery({
    queryKey: ['payment', paymentId],
    queryFn: () => paymentsApi.get(paymentId),
    enabled: Boolean(paymentId),
    retry: 1,
  });

  // If still pending and gateway said OK, trigger manual verify (7.8.2 fallback)
  useEffect(() => {
    if (!payment.data || manualVerifyDone) return;
    const p = payment.data;
    if (p.status === 'pending' && (!gatewayStatus || gatewayStatus === 'OK')) {
      paymentsApi
        .verify(p.id)
        .then(() => {
          setManualVerifyDone(true);
          void queryClient.invalidateQueries({ queryKey: ['payment', paymentId] });
          void queryClient.invalidateQueries({ queryKey: ['wallet'] });
          void queryClient.invalidateQueries({ queryKey: ['wallet-transactions'] });
        })
        .catch((e: Error) => setVerifyError(e.message));
    }
  }, [payment.data, gatewayStatus, manualVerifyDone, paymentId, queryClient]);

  const status = payment.data?.status;
  const requestId = payment.data?.requestId;

  if (!paymentId) {
    return (
      <div className="py-16 text-center">
        <XCircle className="mx-auto h-12 w-12 text-red-400" />
        <p className="mt-4 text-sm text-gray-600">اطلاعات پرداخت یافت نشد</p>
        <Link href="/wallet" className="text-brand-700 mt-4 inline-block text-xs font-bold">
          بازگشت به کیف پول
        </Link>
      </div>
    );
  }

  if (payment.isLoading || (status === 'pending' && !verifyError)) {
    return (
      <div className="py-16 text-center">
        <Loader2 className="text-brand-600 mx-auto h-10 w-10 animate-spin" />
        <p className="mt-4 text-sm text-gray-600">در حال بررسی نتیجه پرداخت…</p>
      </div>
    );
  }

  const success = status === 'completed' || status === 'paid';

  return (
    <div className="flex flex-col items-center py-14 text-center">
      {success ? (
        <>
          <div className="bg-brand-100 flex h-20 w-20 items-center justify-center rounded-full">
            <CheckCircle2 className="text-brand-700 h-10 w-10" />
          </div>
          <h2 className="mt-4 text-lg font-extrabold text-gray-900">پرداخت با موفقیت انجام شد</h2>
        </>
      ) : (
        <>
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-50">
            <XCircle className="h-10 w-10 text-red-500" />
          </div>
          <h2 className="mt-4 text-lg font-extrabold text-gray-900">پرداخت ناموفق بود</h2>
          <p className="mt-2 text-xs text-gray-500">
            در صورت کسر وجه، مبلغ حداکثر تا ۷۲ ساعت بازمی‌گردد
          </p>
        </>
      )}

      {verifyError && (
        <p className="mt-3 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs text-amber-700">
          {verifyError}
        </p>
      )}

      <div className="mt-8 flex w-full flex-col gap-2 px-6">
        {requestId ? (
          <Link
            href={`/requests/${requestId}`}
            className="bg-brand-600 rounded-xl py-3 text-sm font-bold text-white"
          >
            مشاهده درخواست
          </Link>
        ) : (
          <Link
            href="/wallet"
            className="bg-brand-600 rounded-xl py-3 text-sm font-bold text-white"
          >
            مشاهده کیف پول
          </Link>
        )}
        <button
          type="button"
          onClick={() => router.push('/home')}
          className="rounded-xl border border-gray-200 bg-white py-3 text-sm font-bold text-gray-600"
        >
          بازگشت به خانه
        </button>
      </div>
    </div>
  );
}

export default function PaymentCallbackPage() {
  return (
    <>
      <MobileHeader title="نتیجه پرداخت" showBell={false} />
      <Suspense
        fallback={<Loader2 className="text-brand-600 mx-auto mt-16 h-8 w-8 animate-spin" />}
      >
        <PaymentCallbackInner />
      </Suspense>
    </>
  );
}
