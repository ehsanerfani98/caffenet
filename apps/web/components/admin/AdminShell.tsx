'use client';

import {
  BarChart3,
  Bell,
  ClipboardList,
  FolderTree,
  LayoutDashboard,
  LogOut,
  Menu,
  MessagesSquare,
  Phone,
  ScrollText,
  Settings,
  ShieldCheck,
  TicketPercent,
  UserCog,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/hooks/use-auth';
import { cn } from '@/lib/utils';

/**
 * AdminShell (9.1) — dashboard chrome for the admin area.
 *  - Desktop: dark sidebar on the RIGHT (RTL) + sticky top bar
 *  - Mobile: hamburger → slide-in fixed sidebar (z-50)
 * Active item resolved via usePathname (prefix match so /admin/users/12 works).
 */

const NAV: Array<{ href: string; label: string; icon: typeof Users; exact?: boolean }> = [
  { href: '/admin', label: 'داشبورد', icon: LayoutDashboard, exact: true },
  { href: '/admin/users', label: 'کاربران', icon: Users },
  { href: '/admin/operators', label: 'اپراتورها', icon: UserCog },
  { href: '/admin/roles', label: 'نقش‌ها و مجوزها', icon: ShieldCheck },
  { href: '/admin/requests', label: 'درخواست‌ها', icon: ClipboardList },
  { href: '/admin/catalog', label: 'کاتالوگ خدمات', icon: FolderTree },
  { href: '/admin/finance', label: 'مالی', icon: Wallet },
  { href: '/admin/discounts', label: 'تخفیف‌ها', icon: TicketPercent },
  { href: '/admin/reports', label: 'گزارش‌ها', icon: BarChart3 },
  { href: '/admin/audit-logs', label: 'لاگ ممیزی', icon: ScrollText },
  { href: '/admin/contact-methods', label: 'روش‌های تماس', icon: Phone },
  { href: '/admin/notifications', label: 'اعلان‌ها', icon: Bell },
  { href: '/admin/chat', label: 'نظارت چت', icon: MessagesSquare },
  { href: '/admin/settings', label: 'تنظیمات', icon: Settings },
];

function isActive(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function pageTitleFor(pathname: string): string {
  const item = [...NAV].reverse().find((n) => isActive(pathname, n.href, n.exact));
  return item?.label ?? 'داشبورد';
}

function SidebarContent({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="ناوبری ادمین" className="flex-1 space-y-1 overflow-y-auto p-3">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href, item.exact);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
              active
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-gray-300 hover:bg-white/5 hover:text-white',
            )}
          >
            <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function BrandMark() {
  return (
    <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-4">
      <div className="bg-brand-500 flex h-9 w-9 items-center justify-center rounded-xl text-white">
        <LayoutDashboard className="h-5 w-5" aria-hidden />
      </div>
      <div>
        <p className="text-sm font-extrabold text-white">پنل مدیریت</p>
        <p className="text-[10px] text-gray-400">کافی‌نت</p>
      </div>
    </div>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const title = pageTitleFor(pathname);

  return (
    <div className="flex min-h-dvh bg-gray-50">
      {/* Desktop sidebar — first flex child in RTL → right side */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col bg-gray-900 lg:flex">
        <BrandMark />
        <SidebarContent pathname={pathname} />
        <div className="border-t border-white/10 p-3">
          <button
            type="button"
            onClick={() => void logout()}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:bg-red-500/10 hover:text-red-400"
          >
            <LogOut className="h-[18px] w-[18px]" aria-hidden />
            خروج از حساب
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="منوی پنل مدیریت"
        >
          <div
            className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 right-0 flex w-72 max-w-[85vw] flex-col bg-gray-900 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10">
              <div className="flex-1">
                <BrandMark />
              </div>
              <button
                type="button"
                aria-label="بستن منو"
                onClick={() => setMobileOpen(false)}
                className="ml-2 mr-1 flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarContent pathname={pathname} onNavigate={() => setMobileOpen(false)} />
            <div className="border-t border-white/10 p-3">
              <button
                type="button"
                onClick={() => void logout()}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:bg-red-500/10 hover:text-red-400"
              >
                <LogOut className="h-[18px] w-[18px]" aria-hidden />
                خروج از حساب
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-gray-200 bg-white/95 px-4 backdrop-blur">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              aria-label="باز کردن منو"
              onClick={() => setMobileOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="truncate text-sm font-extrabold text-gray-900 sm:text-base">{title}</h1>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/admin/notifications"
              aria-label="اعلان‌ها"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
            >
              <Bell className="h-[18px] w-[18px]" />
            </Link>
            <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white py-1 pl-3 pr-1">
              <div className="bg-brand-100 text-brand-700 flex h-7 w-7 items-center justify-center rounded-full text-xs font-extrabold">
                {(user?.fullName ?? user?.phone ?? 'A').trim().charAt(0)}
              </div>
              <span className="hidden max-w-[120px] truncate text-xs font-bold text-gray-700 sm:block">
                {user?.fullName ?? user?.phone ?? 'ادمین'}
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
