'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { authApi } from '@/lib/api/auth';

/**
 * Forgot password page (7.3.4) — sends an OTP to the account phone.
 */
export default function ForgotPasswordPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await authApi.forgotPassword({ identifier: identifier.trim() });
      router.push(`/reset-password?identifier=${encodeURIComponent(identifier.trim())}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ارسال کد ناموفق بود');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-lg font-extrabold text-gray-900">فراموشی رمز عبور</h2>
      <p className="mb-6 text-xs text-gray-500">
        شماره موبایل یا ایمیل حساب خود را وارد کنید تا کد بازیابی ارسال شود
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="identifier" className="mb-1.5 block text-sm font-medium text-gray-800">
            شماره موبایل یا ایمیل
          </label>
          <input
            id="identifier"
            dir="ltr"
            className="focus:border-brand-500 focus:ring-brand-100 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm focus:outline-none focus:ring-2"
            placeholder="09xxxxxxxxx"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
          />
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-600">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting && <Loader2 className="ml-1.5 h-4 w-4 animate-spin" />}
          ارسال کد بازیابی
        </Button>
      </form>

      <p className="pt-4 text-center text-sm">
        <Link href="/login" className="text-brand-700 font-bold hover:underline">
          بازگشت به ورود
        </Link>
      </p>
    </div>
  );
}
