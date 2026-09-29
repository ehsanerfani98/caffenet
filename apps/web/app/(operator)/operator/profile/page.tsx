'use client';

import { ChevronLeft, LogOut, ShieldCheck, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/use-auth';
import { useAuthStore } from '@/lib/stores/auth-store';
import { toPersianDigits } from '@/lib/format';

/**
 * Operator Profile (8.7) — lightweight identity card from the auth store
 * plus a bridge back to the full customer profile (/profile) and logout.
 */
export default function OperatorProfilePage() {
  const { user } = useAuthStore();
  const { logout } = useAuth();

  const fullName = user?.fullName ?? 'اپراتور کافی‌نت';
  const roles = user?.roles ?? [];
  const permissionCount = user?.permissions.length ?? 0;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-extrabold text-gray-900">پروفایل اپراتور</h2>
        <p className="mt-0.5 text-xs text-gray-400">اطلاعات حساب کاربری شما در کافی‌نت</p>
      </div>

      {/* Identity card */}
      <section className="from-brand-600 to-brand-500 shadow-brand-600/20 rounded-2xl bg-gradient-to-l p-5 text-white shadow-lg">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
            <UserRound className="h-8 w-8" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-extrabold">{fullName}</h3>
            <p dir="ltr" className="mt-0.5 text-right text-xs opacity-90">
              {user?.phone ?? '—'}
            </p>
            {user?.email && (
              <p dir="ltr" className="text-right text-[11px] opacity-75">
                {user.email}
              </p>
            )}
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2 backdrop-blur">
          <ShieldCheck className="h-4 w-4" />
          <span className="text-[11px]">
            نقش‌ها: {roles.join('، ') || '—'} — دسترسی‌ها: {toPersianDigits(permissionCount)} مورد
          </span>
        </div>
      </section>

      {/* Links */}
      <nav className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <Link
          href="/profile"
          className="flex items-center justify-between px-4 py-4 active:bg-gray-50"
        >
          <span className="flex items-center gap-3 text-sm font-medium text-gray-700">
            <UserRound className="text-brand-600 h-4.5 w-4.5" />
            پروفایل مشتری
            <span className="text-[10px] text-gray-400">ویرایش اطلاعات، نشست‌ها، کیف پول</span>
          </span>
          <ChevronLeft className="h-4 w-4 text-gray-300" />
        </Link>
      </nav>

      {/* Logout */}
      <button
        type="button"
        onClick={() => void logout()}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-100 bg-white p-4 text-sm font-bold text-red-500 active:bg-red-50"
      >
        <LogOut className="h-4.5 w-4.5" />
        خروج از حساب
      </button>
    </div>
  );
}
