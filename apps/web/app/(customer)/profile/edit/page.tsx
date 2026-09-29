'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { MobileHeader } from '@/components/common/MobileHeader';
import { usersApi } from '@/lib/api/users';
import { useAuthStore } from '@/lib/stores/auth-store';

/**
 * Profile edit (7.9.1 + 7.9.3) — update fullName / email.
 */
export default function EditProfilePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const profile = useQuery({ queryKey: ['users', 'me'], queryFn: usersApi.me, retry: false });

  useEffect(() => {
    if (profile.data) {
      setFullName(profile.data.fullName ?? '');
      setEmail(profile.data.email ?? '');
    }
  }, [profile.data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      usersApi.updateMe({
        fullName: fullName.trim() || undefined,
        email: email.trim() || undefined,
      }),
    onSuccess: (updated) => {
      setUser(updated);
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      setSaved(true);
      setTimeout(() => router.push('/profile'), 800);
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'ذخیره ناموفق بود'),
  });

  return (
    <>
      <MobileHeader title="ویرایش پروفایل" showBack showBell={false} />
      <div className="space-y-4 pt-4">
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="space-y-4">
            <div>
              <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-gray-800">
                شماره موبایل
              </label>
              <input
                id="phone"
                dir="ltr"
                disabled
                className="w-full cursor-not-allowed rounded-xl border border-gray-100 bg-gray-50 px-3.5 py-3 text-sm text-gray-400"
                value={profile.data?.phone ?? ''}
              />
              <p className="mt-1 text-[11px] text-gray-400">شماره موبایل قابل تغییر نیست</p>
            </div>

            <div>
              <label htmlFor="fullName" className="mb-1.5 block text-sm font-medium text-gray-800">
                نام و نام خانوادگی
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
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-800">
                ایمیل
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
          </div>
        </section>

        {error && (
          <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-600">
            {error}
          </p>
        )}
        {saved && (
          <p className="bg-brand-50 text-brand-700 rounded-xl px-3.5 py-2.5 text-xs font-bold">
            تغییرات ذخیره شد ✓
          </p>
        )}

        <button
          type="button"
          onClick={() => {
            setError(null);
            saveMutation.mutate();
          }}
          disabled={saveMutation.isPending}
          className="bg-brand-600 shadow-brand-600/25 active:bg-brand-700 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-extrabold text-white shadow-xl disabled:opacity-40"
        >
          {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          ذخیره تغییرات
        </button>
      </div>
    </>
  );
}
