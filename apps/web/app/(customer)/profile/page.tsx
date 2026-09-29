'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  ChevronLeft,
  Clock,
  LogOut,
  Moon,
  Pencil,
  ShieldCheck,
  Sun,
  User,
  Wallet,
  Wifi,
} from 'lucide-react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { MobileHeader } from '@/components/common/MobileHeader';
import { usersApi } from '@/lib/api/users';
import { useAuth } from '@/lib/hooks/use-auth';
import { useNotificationStore } from '@/lib/stores/notification-store';

/**
 * Profile page (7.9.1) — view + links to edit/password/sessions,
 * dark mode toggle (7.1.6), logout, notifications entry (7.10).
 */
export default function ProfilePage() {
  const { user, logout } = useAuth();
  const profile = useQuery({ queryKey: ['users', 'me'], queryFn: usersApi.me, retry: false });
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const p = profile.data ?? user;
  const fullName = p?.fullName ?? 'کاربر کافی‌نت';

  return (
    <>
      <MobileHeader title="پروفایل" showBell={false} />
      <div className="space-y-5 pt-4">
        {/* Identity card */}
        <section className="from-brand-600 to-brand-500 shadow-brand-600/20 rounded-2xl bg-gradient-to-l p-5 text-white shadow-lg">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
              <User className="h-8 w-8" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-extrabold">{fullName}</h1>
              <p dir="ltr" className="mt-0.5 text-right text-xs opacity-90">
                {p?.phone ?? '—'}
              </p>
              {p?.email && (
                <p dir="ltr" className="text-right text-[11px] opacity-75">
                  {p.email}
                </p>
              )}
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2 backdrop-blur">
            <ShieldCheck className="h-4 w-4" />
            <span className="text-[11px]">نقش‌ها: {(p?.roles ?? []).join('، ') || 'مشتری'}</span>
          </div>
        </section>

        {/* Menu */}
        <nav className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <MenuLink href="/profile/edit" icon={Pencil} label="ویرایش پروفایل" />
          <MenuLink href="/profile/change-password" icon={ShieldCheck} label="تغییر رمز عبور" />
          <MenuLink href="/profile/sessions" icon={Clock} label="نشست‌های فعال" />
          <MenuLink href="/wallet" icon={Wallet} label="کیف پول" />
          <MenuLink href="/notifications" icon={Bell} label="اعلان‌ها" />
        </nav>

        {/* Dark mode (7.1.6) */}
        <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <span className="flex items-center gap-2.5 text-sm font-medium text-gray-700">
            {mounted && theme === 'dark' ? (
              <Moon className="h-4.5 w-4.5" />
            ) : (
              <Sun className="h-4.5 w-4.5" />
            )}
            حالت شب
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={mounted && theme === 'dark'}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className={`relative h-6 w-11 rounded-full transition-colors ${
              mounted && theme === 'dark' ? 'bg-brand-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                mounted && theme === 'dark' ? 'right-0.5' : 'right-[22px]'
              }`}
            />
          </button>
        </div>

        {/* Notification preferences (7.9.5) */}
        <NotificationPrefsCard />

        {/* Logout */}
        <button
          type="button"
          onClick={() => void logout()}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-100 bg-white p-4 text-sm font-bold text-red-500 active:bg-red-50"
        >
          <LogOut className="h-4.5 w-4.5" />
          خروج از حساب
        </button>

        <p className="flex items-center justify-center gap-1.5 pb-4 text-[10px] text-gray-300">
          <Wifi className="h-3 w-3" />
          کافی‌نت — سامانه خدمات آنلاین
        </p>
      </div>
    </>
  );
}

function MenuLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between border-b border-gray-50 px-4 py-4 last:border-0 active:bg-gray-50"
    >
      <span className="flex items-center gap-3 text-sm font-medium text-gray-700">
        <Icon className="h-4.5 w-4.5 text-brand-600" />
        {label}
      </span>
      <ChevronLeft className="h-4 w-4 text-gray-300" />
    </Link>
  );
}

/**
 * Notification preferences (7.9.5) — per-type toggles + Web Push master
 * switch. Persisted locally now; synced to the server profile in Phase 11.
 */
function NotificationPrefsCard() {
  const { prefs, setPref } = useNotificationStore();

  const items: { key: keyof typeof prefs; label: string }[] = [
    { key: 'requests', label: 'تغییر وضعیت درخواست‌ها' },
    { key: 'wallet', label: 'کیف پول و صورت‌حساب‌ها' },
    { key: 'messages', label: 'پیام‌های چت' },
    { key: 'marketing', label: 'اخبار و تخفیف‌ها' },
    { key: 'pushEnabled', label: 'اعلان فوری (Web Push)' },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <p className="border-b border-gray-50 px-4 py-3 text-xs font-bold text-gray-400">
        تنظیمات اعلان‌ها
      </p>
      {items.map(({ key, label }) => (
        <div
          key={key}
          className="flex items-center justify-between border-b border-gray-50 px-4 py-3.5 last:border-0"
        >
          <span className="text-sm text-gray-700">{label}</span>
          <button
            type="button"
            role="switch"
            aria-checked={prefs[key]}
            aria-label={label}
            onClick={() => setPref(key, !prefs[key])}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
              prefs[key] ? 'bg-brand-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                prefs[key] ? 'right-0.5' : 'right-[22px]'
              }`}
            />
          </button>
        </div>
      ))}
    </div>
  );
}
