'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { authApi } from '@/lib/api/auth';

/**
 * Reset password page (7.3.5) — OTP + new password.
 */
function ResetPasswordForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [identifier, setIdentifier] = useState(search.get('identifier') ?? '');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      // Identifier may be phone or email — reset endpoint expects phone
      await authApi.resetPassword({
        phone: identifier.trim(),
        code: code.trim(),
        newPassword,
      });
      setDone(true);
      setTimeout(() => router.replace('/login'), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'بازیابی رمز ناموفق بود');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="py-6 text-center">
        <p className="text-brand-700 text-sm font-bold">رمز عبور با موفقیت تغییر کرد ✓</p>
        <p className="mt-2 text-xs text-gray-500">در حال انتقال به صفحه ورود…</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="identifier" className="mb-1.5 block text-sm font-medium text-gray-800">
          شماره موبایل
        </label>
        <input
          id="identifier"
          dir="ltr"
          className="focus:border-brand-500 focus:ring-brand-100 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm focus:outline-none focus:ring-2"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
        />
      </div>

      <div>
        <label htmlFor="code" className="mb-1.5 block text-sm font-medium text-gray-800">
          کد ۶ رقمی پیامک‌شده
        </label>
        <input
          id="code"
          dir="ltr"
          inputMode="numeric"
          maxLength={6}
          className="focus:border-brand-500 focus:ring-brand-100 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-center text-lg font-bold tracking-[0.5em] focus:outline-none focus:ring-2"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
        />
      </div>

      <div>
        <label htmlFor="newPassword" className="mb-1.5 block text-sm font-medium text-gray-800">
          رمز عبور جدید
        </label>
        <input
          id="newPassword"
          dir="ltr"
          type="password"
          autoComplete="new-password"
          className="focus:border-brand-500 focus:ring-brand-100 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm focus:outline-none focus:ring-2"
          placeholder="حداقل ۸ کاراکتر"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={8}
        />
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-600">
          {error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting && <Loader2 className="ml-1.5 h-4 w-4 animate-spin" />}
        تغییر رمز عبور
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-lg font-extrabold text-gray-900">بازیابی رمز عبور</h2>
      <p className="mb-6 text-xs text-gray-500">کد پیامک‌شده و رمز جدید خود را وارد کنید</p>
      <Suspense fallback={<Loader2 className="text-brand-600 mx-auto h-6 w-6 animate-spin" />}>
        <ResetPasswordForm />
      </Suspense>
      <p className="pt-4 text-center text-sm">
        <Link href="/login" className="text-brand-700 font-bold hover:underline">
          بازگشت به ورود
        </Link>
      </p>
    </div>
  );
}
