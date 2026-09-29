'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, ChevronLeft, History, Receipt } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MobileHeader } from '@/components/common/MobileHeader';
import { WalletBalance } from '@/components/common/WalletBalance';
import { TransactionItem } from '@/components/common/TransactionItem';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { walletApi } from '@/lib/api/wallet';

/**
 * Wallet home (7.8.1) — balance + actions + recent transactions.
 */
export default function WalletPage() {
  const router = useRouter();
  const wallet = useQuery({ queryKey: ['wallet'], queryFn: walletApi.get });
  const transactions = useQuery({
    queryKey: ['wallet-transactions', 1],
    queryFn: () => walletApi.transactions({ page: 1, limit: 5 }),
  });

  return (
    <>
      <MobileHeader title="کیف پول" showBell={false} />
      <div className="space-y-5 pt-4">
        <WalletBalance
          wallet={wallet.data}
          loading={wallet.isLoading}
          onDepositClick={() => router.push('/wallet/deposit')}
        />

        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/wallet/deposit"
            className="bg-brand-600 shadow-brand-600/20 active:bg-brand-700 flex items-center justify-center gap-2 rounded-2xl p-4 text-sm font-bold text-white shadow-lg"
          >
            <ArrowUpRight className="h-4.5 w-4.5" />
            افزایش موجودی
          </Link>
          <Link
            href="/wallet/transactions"
            className="flex items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white p-4 text-sm font-bold text-gray-700 shadow-sm active:bg-gray-50"
          >
            <History className="h-4.5 w-4.5 text-brand-600" />
            تراکنش‌ها
          </Link>
        </div>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-800">تراکنش‌های اخیر</h2>
            <Link
              href="/wallet/transactions"
              className="text-brand-700 flex items-center text-xs font-medium"
            >
              همه
              <ChevronLeft className="h-3.5 w-3.5" />
            </Link>
          </div>

          {transactions.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-200/80" />
              ))}
            </div>
          ) : transactions.isError ? (
            <ErrorState onRetry={() => transactions.refetch()} />
          ) : (transactions.data?.items ?? []).length === 0 ? (
            <EmptyState
              title="تراکنشی ثبت نشده"
              description="با شارژ کیف پول یا پرداخت خدمت، تراکنش‌ها اینجا نمایش داده می‌شوند"
              icon={<Receipt className="h-8 w-8" />}
            />
          ) : (
            <div className="space-y-2">
              {(transactions.data?.items ?? []).map((tx) => (
                <TransactionItem key={tx.id} transaction={tx} />
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
