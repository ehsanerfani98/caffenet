'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PublicGuard } from '@/components/common/guards';
import { useAuth } from '@/lib/hooks/use-auth';
import { destinationFor } from '@/lib/role-home';
import { useAuthStore } from '@/lib/stores/auth-store';

/**
 * Login page (7.3.1) — phone/email + password.
 * Pending-OTP users are routed to OTP verification.
 */
function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const { login, submitting, error } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const next = search.get('next') ?? '/home';

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await login(identifier.trim(), password);
    if (!result) return;
    if (result.requiresOtp) {
      router.push(
        `/verify-otp?phone=${encodeURIComponent(identifier.trim())}&type=login&next=${encodeURIComponent(next)}`,
      );
    } else {
      // Phase 8/9 — role-aware landing: operator/admin go to their dashboards
      const roles = useAuthStore.getState().user?.roles;
      router.replace(destinationFor(roles, search.get('next')));
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="identifier" className="mb-1.5 block text-sm font-medium text-gray-800">
          شماره موبایل یا ایمیل
        </label>
        <input
          id="identifier"
          dir="ltr"
          autoComplete="username"
          className="focus:border-brand-500 focus:ring-brand-100 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm focus:outline-none focus:ring-2"
          placeholder="09xxxxxxxxx یا email@example.com"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-800">
          رمز عبور
        </label>
        <div className="relative">
          <input
            id="password"
            dir="ltr"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            className="focus:border-brand-500 focus:ring-brand-100 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 pl-11 text-sm focus:outline-none focus:ring-2"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
          <button
            type="button"
            aria-label={showPassword ? 'پنهان کردن رمز' : 'نمایش رمز'}
            onClick={() => setShowPassword((s) => !s)}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <div className="flex justify-start">
        <Link
          href="/forgot-password"
          className="text-brand-700 text-xs font-medium hover:underline"
        >
          رمز عبور را فراموش کرده‌اید؟
        </Link>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-600">
          {error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting && <Loader2 className="ml-1.5 h-4 w-4 animate-spin" />}
        ورود
      </Button>

      <p className="pt-2 text-center text-sm text-gray-500">
        حساب کاربری ندارید؟{' '}
        <Link href="/register" className="text-brand-700 font-bold hover:underline">
          ثبت‌نام کنید
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <PublicGuard>
      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-lg font-extrabold text-gray-900">ورود به حساب</h2>
        <p className="mb-6 text-xs text-gray-500">
          برای پیگیری درخواست‌ها و استفاده از کیف پول وارد شوید
        </p>
        <LoginForm />
      </div>
    </PublicGuard>
  );
}
