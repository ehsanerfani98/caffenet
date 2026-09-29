'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { MobileHeader } from '@/components/common/MobileHeader';
import { authApi } from '@/lib/api/auth';

/**
 * Change password (7.9.2).
 */
export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirm) {
      setError('رمز جدید و تکرار آن یکسان نیستند');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await authApi.changePassword({ currentPassword, newPassword });
      setDone(true);
      setTimeout(() => router.push('/profile'), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تغییر رمز ناموفق بود');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <MobileHeader title="تغییر رمز عبور" showBack showBell={false} />
      <div className="pt-4">
        {done ? (
          <p className="bg-brand-50 text-brand-700 mt-6 rounded-xl px-4 py-3 text-center text-sm font-bold">
            رمز عبور با موفقیت تغییر کرد ✓
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <section className="space-y-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div>
                <label htmlFor="current" className="mb-1.5 block text-sm font-medium text-gray-800">
                  رمز عبور فعلی
                </label>
                <input
                  id="current"
                  dir="ltr"
                  type="password"
                  autoComplete="current-password"
                  className="focus:border-brand-500 focus:ring-brand-100 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm focus:outline-none focus:ring-2"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div>
                <label htmlFor="new" className="mb-1.5 block text-sm font-medium text-gray-800">
                  رمز عبور جدید
                </label>
                <input
                  id="new"
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
              <div>
                <label htmlFor="confirm" className="mb-1.5 block text-sm font-medium text-gray-800">
                  تکرار رمز جدید
                </label>
                <input
                  id="confirm"
                  dir="ltr"
                  type="password"
                  autoComplete="new-password"
                  className="focus:border-brand-500 focus:ring-brand-100 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm focus:outline-none focus:ring-2"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
            </section>

            {error && (
              <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-600">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="bg-brand-600 shadow-brand-600/25 active:bg-brand-700 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-extrabold text-white shadow-xl disabled:opacity-40"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              تغییر رمز عبور
            </button>
          </form>
        )}
      </div>
    </>
  );
}
