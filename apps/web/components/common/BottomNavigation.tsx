'use client';

import { Home, LayoutGrid, ClipboardList, MessageCircle, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/home', label: 'خانه', icon: Home },
  { href: '/services', label: 'خدمات', icon: LayoutGrid },
  { href: '/requests', label: 'درخواست‌ها', icon: ClipboardList },
  { href: '/chat', label: 'چت', icon: MessageCircle },
  { href: '/profile', label: 'پروفایل', icon: User },
];

export function BottomNavigation() {
  const pathname = usePathname();

  return (
    <nav className="safe-area-bottom fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white">
      <div className="container-mobile">
        <ul className="h-mobile-bottom-nav flex items-center justify-around">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-xs transition-colors',
                    active ? 'text-brand-600' : 'text-gray-500 hover:text-gray-700',
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
