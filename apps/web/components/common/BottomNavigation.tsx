'use client';

import { Home, LayoutGrid, ClipboardList, MessageCircle, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'خانه', icon: Home },
  { href: '/services', label: 'خدمات', icon: LayoutGrid },
  { href: '/requests', label: 'درخواست‌ها', icon: ClipboardList },
  { href: '/chat', label: 'چت', icon: MessageCircle },
  { href: '/profile', label: 'پروفایل', icon: User },
];

export function BottomNavigation() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-gray-200 safe-area-bottom">
      <div className="container-mobile">
        <ul className="flex items-center justify-around h-mobile-bottom-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs transition-colors',
                    active ? 'text-brand-600' : 'text-gray-500 hover:text-gray-700',
                  )}
                >
                  <Icon className="w-5 h-5" />
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
