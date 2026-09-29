'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth-store';
import { roleHome } from '@/lib/role-home';

/**
 * Root — role-aware entry (Phase 8/9).
 * Admins → /admin, operators → /operator, customers → /home.
 * Client-side because roles live in the persisted (localStorage) auth store.
 */
export default function RootPage() {
  const router = useRouter();
  const { hydrated, accessToken, user } = useAuthStore();
  const roles = user?.roles ?? [];

  useEffect(() => {
    if (!hydrated) return;
    router.replace(accessToken ? roleHome(roles) : '/home');
  }, [hydrated, accessToken, roles, router]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gray-50">
      <div className="border-brand-200 border-t-brand-600 h-10 w-10 animate-spin rounded-full border-4" />
    </div>
  );
}
