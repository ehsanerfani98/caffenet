'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PublicGuard } from '@/components/common/guards';
import { useAuth } from '@/lib/hooks/use-auth';

/**
 * Register page (7.3.2) — creates a pending_otp user and routes to OTP.
 */
function RegisterForm() {
  const router = useRouter();
  const { register, submitting, error } = useAuth();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await register({
      phone: phone.trim(),
      password,
      fullName: fullName.trim() || undefined,
      email: email.trim() || undefined,
    });
    if (result) {
      router.push(`/verify-otp?phone=${encodeURIComponent(phone.trim())}&type=register`);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="fullName" className="mb-1.5 block text-sm font-medium text-gray-800">
          نام و نام خانوادگی <span className="text-gray-400">(اختیاری)</span>
        </label>
        <input
          id="fullName"
          className="focus:border-brand-500 focus:ring-brand-100 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm focus:outline-none focus:ring-2"
          placeholder="علی رضایی"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-gray-800">
          شماره موبایل <span className="text-red-500">*</span>
        </label>
        <input
          id="phone"
          dir="ltr"
          inputMode="numeric"
          className="focus:border-brand-500 focus:ring-brand-100 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm focus:outline-none focus:ring-2"
          placeholder="09xxxxxxxxx"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          pattern="09[0-9]{9}"
        />
      </div>

      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-800">
          ایمیل <span className="text-gray-400">(اختیاری)</span>
        </label>
        <input
          id="email"
          dir="ltr"
          type="email"
          className="focus:border-brand-500 focus:ring-brand-100 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm focus:outline-none focus:ring-2"
          placeholder="email@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-800">
          رمز عبور <span className="text-red-500">*</span>
        </label>
        <input
          id="password"
          dir="ltr"
          type="password"
          autoComplete="new-password"
          className="focus:border-brand-500 focus:ring-brand-100 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm focus:outline-none focus:ring-2"
          placeholder="حداقل ۸ کاراکتر"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
        ثبت‌نام
      </Button>

      <p className="pt-2 text-center text-sm text-gray-500">
        قبلاً ثبت‌نام کرده‌اید؟{' '}
        <Link href="/login" className="text-brand-700 font-bold hover:underline">
          وارد شوید
        </Link>
      </p>
    </form>
  );
}

export default function RegisterPage() {
  return (
    <PublicGuard>
      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-lg font-extrabold text-gray-900">ساخت حساب جدید</h2>
        <p className="mb-6 text-xs text-gray-500">
          با شماره موبایل ثبت‌نام کنید و کد تأیید را وارد نمایید
        </p>
        <RegisterForm />
      </div>
    </PublicGuard>
  );
}
