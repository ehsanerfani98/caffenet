'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Bell,
  ClipboardList,
  Inbox,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { operatorApi } from '@/lib/api/operator';
import { useAuth } from '@/lib/hooks/use-auth';
import { useAuthStore } from '@/lib/stores/auth-store';
import { cn } from '@/lib/utils';
import { toPersianDigits } from '@/lib/format';

/**
 * OperatorShell (8.1) — operator console chrome.
 *  - Desktop: fixed right sidebar (RTL) with dark-green navigation
 *  - Mobile: sticky top bar + fixed bottom navigation (safe-area aware)
 *  - Top bar shows the assigned-to-me count badge (dashboard KPI), the
 *    notifications bell and the logout action.
 */

const NAV_ITEMS = [
  { href: '/operator', label: 'داشبورد', icon: LayoutDashboard },
  { href: '/operator/queue', label: 'صف درخواست‌ها', icon: Inbox },
  { href: '/operator/requests', label: 'درخواست‌های من', icon: ClipboardList },
  { href: '/operator/chat', label: 'چت', icon: MessageCircle },
  { href: '/operator/activity', label: 'فعالیت من', icon: Activity },
  { href: '/operator/profile', label: 'پروفایل', icon: User },
] as const;

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === '/operator') return pathname === '/operator';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function OperatorShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const { logout } = useAuth();

  // Same queryKey as the dashboard page → shared cache, no extra request there
  const dashboard = useQuery({
    queryKey: ['operator', 'dashboard'],
    queryFn: operatorApi.dashboard,
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 1,
  });
  const assignedToMe = dashboard.data?.kpis.assignedToMe;

  const displayName = user?.fullName ?? 'اپراتور کافی‌نت';
  const initial = displayName.trim().charAt(0) || 'ک';

  return (
    <div className="min-h-dvh bg-gray-50">
      {/* ===== Desktop sidebar (right side — RTL) ===== */}
      <aside className="bg-brand-900 fixed inset-y-0 right-0 z-40 hidden w-64 flex-col lg:flex">
        <div className="border-b border-white/10 px-5 py-5">
          <p className="text-sm font-extrabold text-white">کافی‌نت</p>
          <p className="text-brand-200/80 mt-0.5 text-[11px]">پنل اپراتور</p>
        </div>

        <nav aria-label="ناوبری اپراتور" className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                      active
                        ? 'bg-white/10 text-white'
                        : 'text-brand-100/70 hover:bg-white/5 hover:text-white',
                    )}
                    aria-current={active ? 'page' : undefined}
                  >
                    <Icon className="h-4.5 w-4.5 shrink-0" />
                    <span className="truncate">{item.label}</span>
                    {item.href === '/operator/requests' &&
                      typeof assignedToMe === 'number' &&
                      assignedToMe > 0 && (
                        <span className="bg-brand-500 mr-auto rounded-full px-2 py-0.5 text-[10px] font-bold text-white">
                          {toPersianDigits(assignedToMe)}
                        </span>
                      )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-white/10 px-3 py-4">
          <div className="mb-3 flex items-center gap-3 px-2">
            <span className="bg-brand-500/30 text-brand-100 flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold">
              {initial}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-white">{displayName}</p>
              <p dir="ltr" className="text-brand-200/70 truncate text-right text-[10px]">
                {user?.phone ?? ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="text-brand-100/80 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors hover:bg-white/5 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            خروج از حساب
          </button>
        </div>
      </aside>

      {/* ===== Content column ===== */}
      <div className="lg:mr-64">
        {/* Top bar */}
        <header className="bg-brand-900 safe-area-top sticky top-0 z-40 text-white shadow-sm">
          <div className="container-mobile flex h-14 items-center justify-between">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="hidden h-9 w-9 items-center justify-center rounded-xl bg-white/10 lg:flex">
                <LayoutDashboard className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-sm font-extrabold lg:text-base">
                  پنل اپراتور کافی‌نت
                </h1>
                <p className="text-brand-200/80 truncate text-[10px] lg:hidden">{displayName}</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {typeof assignedToMe === 'number' && (
                <Link
                  href="/operator/requests"
                  className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold transition-colors hover:bg-white/15"
                  aria-label={`درخواست‌های تخصیص‌یافته به شما: ${assignedToMe}`}
                >
                  <ClipboardList className="h-3.5 w-3.5" />
                  <span>تخصیص‌یافته: {toPersianDigits(assignedToMe)}</span>
                </Link>
              )}
              <Link
                href="/notifications"
                aria-label="اعلان‌ها"
                className="rounded-full p-2 transition-colors hover:bg-white/15"
              >
                <Bell className="h-5 w-5" />
              </Link>
              <button
                type="button"
                onClick={() => void logout()}
                aria-label="خروج از حساب"
                className="rounded-full p-2 transition-colors hover:bg-white/15 lg:hidden"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>

        <main className="container-mobile pb-bottom-nav pt-4 lg:min-h-[calc(100dvh-3.5rem)] lg:pb-10">
          {children}
        </main>
      </div>

      {/* ===== Mobile bottom navigation ===== */}
      <nav className="safe-area-bottom fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white lg:hidden">
        <ul className="h-mobile-bottom-nav flex items-stretch justify-around">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            const showBadge =
              item.href === '/operator/requests' &&
              typeof assignedToMe === 'number' &&
              assignedToMe > 0;
            return (
              <li key={item.href} className="flex flex-1 items-stretch">
                <Link
                  href={item.href}
                  className={cn(
                    'flex flex-1 flex-col items-center justify-center gap-0.5 px-0.5 py-2 text-[10px] font-medium transition-colors',
                    active ? 'text-brand-600' : 'text-gray-500 hover:text-gray-700',
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className="relative">
                    <Icon className="h-5 w-5" />
                    {showBadge && (
                      <span className="bg-brand-600 absolute -left-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white">
                        {toPersianDigits(assignedToMe ?? 0)}
                      </span>
                    )}
                  </span>
                  <span className="max-w-full truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
