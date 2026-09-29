'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { authApi } from '@/lib/api/auth';
import { useAuthStore, persistTokenMirror } from '@/lib/stores/auth-store';
import { destinationFor } from '@/lib/role-home';
import { toPersianDigits } from '@/lib/format';

/**
 * OTP verification page (7.3.3) — 6-digit code, auto-focus, resend timer.
 * On register/login success the account activates and tokens are issued.
 */
function VerifyOtpForm() {
  const router = useRouter();
  const search = useSearchParams();
  const setTokens = useAuthStore((s) => s.setTokens);
  const setUser = useAuthStore((s) => s.setUser);

  const phone = search.get('phone') ?? '';
  const type = (search.get('type') ?? 'register') as 'register' | 'login';
  const next = search.get('next') ?? '/home';

  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(90);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const code = digits.join('');

  const setDigit = (index: number, value: string) => {
    const clean = value.replace(/\D/g, '').slice(-1);
    const nextDigits = [...digits];
    nextDigits[index] = clean;
    setDigits(nextDigits);
    if (clean && index < 5) inputsRef.current[index + 1]?.focus();
  };

  const submit = async (finalCode?: string) => {
    const c = finalCode ?? code;
    if (c.length !== 6 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await authApi.verifyOtp({ phone, code: c, type });
      setTokens({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn,
      });
      setUser(result.user);
      persistTokenMirror(result.accessToken);
      // Phase 8/9 — role-aware landing
      router.replace(destinationFor(result.user?.roles, next));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'کد وارد شده نامعتبر است');
      setDigits(Array(6).fill(''));
      inputsRef.current[0]?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    if (resendIn > 0) return;
    try {
      await authApi.resendOtp({ phone, type });
      setResendIn(90);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ارسال مجدد ناموفق بود');
    }
  };

  return (
    <div className="space-y-5">
      <p className="text-center text-sm text-gray-600">
        کد ۶ رقمی پیامک‌شده به شماره
        <span dir="ltr" className="mx-1 font-bold text-gray-900">
          {toPersianDigits(phone)}
        </span>
        را وارد کنید
      </p>

      <div dir="ltr" className="flex justify-center gap-2">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              inputsRef.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            aria-label={`رقم ${i + 1}`}
            className="focus:border-brand-500 focus:ring-brand-100 h-12 w-11 rounded-xl border border-gray-200 bg-white text-center text-lg font-bold text-gray-900 focus:outline-none focus:ring-2"
            value={d ? toPersianDigits(d) : ''}
            onChange={(e) => setDigit(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Backspace' && !digits[i] && i > 0) inputsRef.current[i - 1]?.focus();
            }}
            onPaste={(e) => {
              e.preventDefault();
              const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
              if (pasted.length) {
                const nextDigits = Array(6)
                  .fill('')
                  .map((_, idx) => pasted[idx] ?? '');
                setDigits(nextDigits);
                inputsRef.current[Math.min(pasted.length, 5)]?.focus();
                if (pasted.length === 6) void submit(pasted);
              }
            }}
          />
        ))}
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-center text-xs font-medium text-red-600">
          {error}
        </p>
      )}

      <Button
        className="w-full"
        disabled={submitting || code.length !== 6}
        onClick={() => void submit()}
      >
        {submitting && <Loader2 className="ml-1.5 h-4 w-4 animate-spin" />}
        تأیید
      </Button>

      <p className="text-center text-xs text-gray-500">
        {resendIn > 0 ? (
          <>ارسال مجدد کد تا {toPersianDigits(resendIn)} ثانیه دیگر</>
        ) : (
          <button
            type="button"
            onClick={() => void resend()}
            className="text-brand-700 font-bold hover:underline"
          >
            ارسال مجدد کد
          </button>
        )}
      </p>
    </div>
  );
}

export default function VerifyOtpPage() {
  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
      <h2 className="mb-5 text-center text-lg font-extrabold text-gray-900">کد تأیید</h2>
      <Suspense fallback={<Loader2 className="text-brand-600 mx-auto h-6 w-6 animate-spin" />}>
        <VerifyOtpForm />
      </Suspense>
    </div>
  );
}
