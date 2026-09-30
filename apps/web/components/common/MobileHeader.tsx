'use client';

import { ArrowRight, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { formatToman } from '@/lib/format';
import { NotificationBell } from '@/components/common/NotificationBell';

/**
 * MobileHeader (7.2.2) — sticky top bar with back button, title,
 * notification bell and wallet balance shortcut.
 */

interface MobileHeaderProps {
  title: string;
  showBack?: boolean;
  showBell?: boolean;
  showWallet?: boolean;
  walletBalance?: number | null;
  className?: string;
}

export function MobileHeader({
  title,
  showBack = false,
  showBell = true,
  showWallet = false,
  walletBalance,
  className,
}: MobileHeaderProps) {
  const router = useRouter();

  return (
    <header
      className={cn(
        'safe-area-top sticky top-0 z-40 border-b border-gray-100 bg-white/95 backdrop-blur',
        className,
      )}
    >
      <div className="container-mobile flex h-14 items-center justify-between">
        <div className="flex min-w-0 items-center gap-2">
          {showBack && (
            <button
              type="button"
              aria-label="بازگشت"
              onClick={() => router.back()}
              className="-mr-2 rounded-full p-2 text-gray-700 active:bg-gray-100"
            >
              <ArrowRight className="h-5 w-5" />
            </button>
          )}
          <h1 className="truncate text-base font-bold text-gray-900">{title}</h1>
        </div>

        <div className="flex items-center gap-1">
          {showWallet && (
            <Link
              href="/wallet"
              className="bg-brand-50 text-brand-700 active:bg-brand-100 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
            >
              <Wallet className="h-4 w-4" />
              <span>
                {walletBalance !== null && walletBalance !== undefined
                  ? formatToman(walletBalance)
                  : 'کیف پول'}
              </span>
            </Link>
          )}
          {showBell && <NotificationBell variant="sheet" />}
        </div>
      </div>
    </header>
  );
}
