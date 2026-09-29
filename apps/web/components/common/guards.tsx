'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth-store';

/**
 * Auth route guards (7.3.6) — client-side guard used by layouts.
 * `PrivateGuard`: redirects unauthenticated users to /login?next=…
 * `PublicGuard`: redirects logged-in users away from auth pages to /home.
 */

export function PrivateGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { hydrated, accessToken } = useAuthStore();

  useEffect(() => {
    if (hydrated && !accessToken) {
      const next = encodeURIComponent(pathname ?? '/home');
      router.replace(`/login?next=${next}`);
    }
  }, [hydrated, accessToken, pathname, router]);

  if (!hydrated) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="border-brand-200 border-t-brand-600 h-10 w-10 animate-spin rounded-full border-4" />
          <p className="text-sm text-gray-400">در حال بارگذاری…</p>
        </div>
      </div>
    );
  }

  if (!accessToken) return null;

  return <>{children}</>;
}

export function PublicGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { hydrated, accessToken } = useAuthStore();

  useEffect(() => {
    if (hydrated && accessToken) {
      router.replace('/home');
    }
  }, [hydrated, accessToken, router]);

  if (!hydrated || accessToken) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gray-50">
        <div className="border-brand-200 border-t-brand-600 h-10 w-10 animate-spin rounded-full border-4" />
      </div>
    );
  }

  return <>{children}</>;
}
