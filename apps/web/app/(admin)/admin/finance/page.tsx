'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCcw, Scale, Search, Wallet } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { DataTable, type DataTableColumn } from '@/components/admin/DataTable';
import { PageHeader } from '@/components/admin/PageHeader';
import { Pagination } from '@/components/admin/Pagination';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { toast } from '@/components/ui/use-toast';
import {
  adjustUserWallet,
  adminUsersApi,
  adminWalletApi,
  type AdminPaymentDto,
  type WalletRowDto,
} from '@/lib/api/admin';
import { formatJalaliDateTime, formatToman } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Finance admin (9.8.1–9.8.5) — three tabs:
 *  - کیف پول‌ها: all user wallets with balances + search        (9.8.1)
 *  - پرداخت‌ها: gateway payments w/ status-gateway filter +
 *    refund per successful row (amount + reason dialog)         (9.8.4 / 9.8.3)
 *  - تعدیل دستی: user search → amount + reason + confirm →
 *    POST /wallet/users/:userId/adjust                          (9.8.5)
 */

type Tab = 'wallets' | 'payments' | 'adjust';

const PAYMENT_STATUS_FA: Record<string, string> = {
  pending: 'در انتظار',
  verifying: 'در حال تأیید',
  successful: 'موفق',
  failed: 'ناموفق',
  cancelled: 'لغوشده',
  refunded: 'بازگشت‌شده',
};

const PAYMENT_STATUS_CLASS: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  verifying: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  successful: 'bg-brand-50 text-brand-700 border-brand-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
  refunded: 'bg-purple-50 text-purple-700 border-purple-200',
};

const GATEWAY_FA: Record<string, string> = {
  zarinpal: 'زرین‌پال',
  zibal: 'زیبال',
};

export default function AdminFinancePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl">
          <PageHeader title="مالی" description="کیف پول‌ها، پرداخت‌ها و تعدیل دستی موجودی" />
          <div className="h-64 animate-pulse rounded-2xl bg-gray-200/70" />
        </div>
      }
    >
      <FinanceInner />
    </Suspense>
  );
}

function FinanceInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const presetUser = searchParams.get('adjustUserId');
  const [tab, setTab] = useState<Tab>(presetUser ? 'adjust' : 'wallets');

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="مالی" description="کیف پول‌ها، پرداخت‌ها و تعدیل دستی موجودی" />

      <div className="mb-4 flex gap-2" role="tablist" aria-label="بخش‌های مالی">
        {(
          [
            { key: 'wallets', label: 'کیف پول‌ها', icon: Wallet },
            { key: 'payments', label: 'پرداخت‌ها', icon: RefreshCcw },
            { key: 'adjust', label: 'تعدیل دستی', icon: Scale },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => {
              setTab(t.key);
              if (t.key !== 'adjust') router.replace('/admin/finance');
            }}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold transition-colors',
              tab === t.key
                ? 'bg-brand-600 text-white shadow-sm'
                : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'wallets' && <WalletsTab />}
      {tab === 'payments' && <PaymentsTab />}
      {tab === 'adjust' && <AdjustTab presetUserId={presetUser} />}
    </div>
  );
}

// ===========================================================================
// Wallets tab (9.8.1)
// ===========================================================================

function WalletsTab() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const wallets = useQuery({
    queryKey: ['admin-wallets', page, search],
    queryFn: () => adminWalletApi.wallets({ page, perPage: 20, search: search || undefined }),
  });

  const columns: Array<DataTableColumn<WalletRowDto>> = [
    {
      key: 'fullName',
      header: 'کاربر',
      render: (w) => (
        <div className="min-w-0">
          <p className="truncate font-bold text-gray-900">{w.fullName ?? '—'}</p>
          <p dir="ltr" className="text-right text-[11px] text-gray-400">
            {w.phone}
          </p>
        </div>
      ),
    },
    {
      key: 'balanceToman',
      header: 'موجودی',
      render: (w) => (
        <span className="font-extrabold text-gray-900">{formatToman(w.balanceToman)}</span>
      ),
    },
    {
      key: 'status',
      header: 'وضعیت کیف پول',
      render: (w) => (
        <span className="text-xs font-medium text-gray-600">
          {w.status === 'active' ? 'فعال' : w.status === 'frozen' ? 'مسدود' : 'بسته'}
        </span>
      ),
    },
    {
      key: 'userStatus',
      header: 'وضعیت کاربر',
      render: (w) => (
        <span className="text-xs text-gray-500">
          {w.userStatus === 'active'
            ? 'فعال'
            : w.userStatus === 'banned'
              ? 'مسدود'
              : w.userStatus === 'suspended'
                ? 'تعلیق'
                : 'در انتظار تأیید'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 sm:max-w-sm">
          <Search
            className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            aria-hidden
          />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setPage(1);
                setSearch(searchInput.trim());
              }
            }}
            placeholder="جستجوی نام یا شماره…"
            aria-label="جستجوی کیف پول"
            className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-3 pr-9 text-sm outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setPage(1);
            setSearch(searchInput.trim());
          }}
          className="shrink-0 rounded-xl bg-gray-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-gray-800"
        >
          جستجو
        </button>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        {wallets.isError ? (
          <ErrorState title="خطا در دریافت کیف پول‌ها" onRetry={() => wallets.refetch()} />
        ) : !wallets.isLoading && (wallets.data?.items ?? []).length === 0 ? (
          <EmptyState title="کیف پولی یافت نشد" description="عبارت جستجو را تغییر دهید" />
        ) : (
          <DataTable
            columns={columns}
            rows={wallets.data?.items ?? []}
            loading={wallets.isLoading}
            emptyText="کیف پولی یافت نشد"
          />
        )}
        <Pagination
          page={page}
          totalPages={wallets.data?.meta?.totalPages ?? 1}
          onChange={setPage}
        />
      </div>
    </div>
  );
}

// ===========================================================================
// Payments tab (9.8.4) + refund dialog (9.8.3)
// ===========================================================================

function PaymentsTab() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [gateway, setGateway] = useState('');
  const [refundTarget, setRefundTarget] = useState<AdminPaymentDto | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');

  const payments = useQuery({
    queryKey: ['admin-payments', page, status, gateway],
    queryFn: () =>
      adminWalletApi.payments({
        page,
        perPage: 20,
        status: status || undefined,
        gateway: gateway || undefined,
      }),
  });

  const refundMutation = useMutation({
    mutationFn: () => {
      const amount = refundAmount.trim() ? Number(refundAmount) : undefined;
      return adminWalletApi.refund(refundTarget!.id, {
        amountToman:
          amount && amount > 0 && amount < refundTarget!.amountToman ? amount : undefined,
        reason: refundReason.trim(),
      });
    },
    onSuccess: (res) => {
      toast({
        title: res.full ? 'بازگشت کامل وجه انجام شد' : 'بازگشت جزئی وجه انجام شد',
        description: `${formatToman(res.amountToman)} به کیف پول مشتری واریز شد`,
      });
      setRefundTarget(null);
      setRefundAmount('');
      setRefundReason('');
      void queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-wallets'] });
    },
    onError: (e) => toast({ title: 'بازگشت وجه ناموفق بود', description: e.message }),
  });

  const columns: Array<DataTableColumn<AdminPaymentDto>> = [
    {
      key: 'userFullName',
      header: 'پرداخت‌کننده',
      render: (p) => (
        <div className="min-w-0">
          <p className="truncate font-bold text-gray-900">{p.userFullName ?? '—'}</p>
          <p dir="ltr" className="text-right text-[11px] text-gray-400">
            {p.userPhone}
          </p>
        </div>
      ),
    },
    {
      key: 'amountToman',
      header: 'مبلغ',
      render: (p) => (
        <span className="font-extrabold text-gray-900">{formatToman(p.amountToman)}</span>
      ),
    },
    { key: 'gateway', header: 'درگاه', render: (p) => GATEWAY_FA[p.gateway] ?? p.gateway },
    {
      key: 'status',
      header: 'وضعیت',
      render: (p) => (
        <span
          className={cn(
            'inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
            PAYMENT_STATUS_CLASS[p.status] ?? 'border-gray-200 bg-gray-100 text-gray-600',
          )}
        >
          {PAYMENT_STATUS_FA[p.status] ?? p.status}
        </span>
      ),
    },
    {
      key: 'referenceNumber',
      header: 'شماره پیگیری',
      render: (p) => (
        <span dir="ltr" className="block text-right font-mono text-[11px] text-gray-500">
          {p.referenceNumber ?? '—'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'تاریخ',
      render: (p) => (
        <span className="text-xs text-gray-500">{formatJalaliDateTime(p.createdAt)}</span>
      ),
    },
    {
      key: 'actions',
      header: 'عملیات',
      render: (p) =>
        p.status === 'successful' || p.status === 'refunded' ? (
          <button
            type="button"
            disabled={p.status === 'refunded'}
            onClick={(e) => {
              e.stopPropagation();
              setRefundTarget(p);
              setRefundAmount(String(p.amountToman));
            }}
            className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-bold text-amber-700 hover:bg-amber-100 disabled:opacity-40"
          >
            {p.status === 'refunded' ? 'بازگشت‌شده' : 'بازگشت وجه'}
          </button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          aria-label="فیلتر وضعیت پرداخت"
          className="focus:border-brand-400 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-xs font-medium text-gray-700 outline-none"
        >
          <option value="">همه وضعیت‌ها</option>
          {Object.entries(PAYMENT_STATUS_FA).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          value={gateway}
          onChange={(e) => {
            setGateway(e.target.value);
            setPage(1);
          }}
          aria-label="فیلتر درگاه"
          className="focus:border-brand-400 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-xs font-medium text-gray-700 outline-none"
        >
          <option value="">همه درگاه‌ها</option>
          <option value="zarinpal">زرین‌پال</option>
          <option value="zibal">زیبال</option>
        </select>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        {payments.isError ? (
          <ErrorState title="خطا در دریافت پرداخت‌ها" onRetry={() => payments.refetch()} />
        ) : !payments.isLoading && (payments.data?.items ?? []).length === 0 ? (
          <EmptyState title="پرداختی یافت نشد" description="فیلترها را تغییر دهید" />
        ) : (
          <DataTable
            columns={columns}
            rows={payments.data?.items ?? []}
            loading={payments.isLoading}
            emptyText="پرداختی یافت نشد"
          />
        )}
        <Pagination
          page={page}
          totalPages={payments.data?.meta?.totalPages ?? 1}
          onChange={setPage}
        />
      </div>

      <ConfirmDialog
        open={refundTarget !== null}
        title="بازگشت وجه به کیف پول"
        description={`بازگشت وجه پرداخت ${refundTarget?.referenceNumber ?? ''} به کیف پول مشتری. این عملیات در لاگ ممیزی ثبت می‌شود.`}
        confirmLabel="ثبت بازگشت وجه"
        pending={refundMutation.isPending}
        onConfirm={() => refundMutation.mutate()}
        onCancel={() => setRefundTarget(null)}
      >
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-500">
              مبلغ (تومان) — خالی = بازگشت کامل{' '}
              {refundTarget ? `(${formatToman(refundTarget.amountToman)})` : ''}
            </span>
            <input
              dir="ltr"
              type="number"
              min={1}
              max={refundTarget?.amountToman}
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:bg-white"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-500">دلیل *</span>
            <textarea
              rows={2}
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="مثلاً انصراف مشتری از سرویس…"
              className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:bg-white"
            />
          </label>
        </div>
      </ConfirmDialog>
    </div>
  );
}

// ===========================================================================
// Adjust tab (9.8.5)
// ===========================================================================

function AdjustTab({ presetUserId }: { presetUserId: string | null }) {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<{ id: string; label: string } | null>(
    presetUserId ? { id: presetUserId, label: `کاربر #${presetUserId}` } : null,
  );
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const results = useQuery({
    queryKey: ['admin-user-search', search],
    queryFn: () => adminUsersApi.list({ search, perPage: 8 }),
    enabled: search.length >= 2,
  });

  const adjustMutation = useMutation({
    mutationFn: () =>
      adjustUserWallet(selectedUser!.id, {
        amountToman: Number(amount),
        reason: reason.trim(),
      }),
    onSuccess: () => {
      toast({ title: 'تعدیل موجودی ثبت شد' });
      setConfirmOpen(false);
      setAmount('');
      setReason('');
      void queryClient.invalidateQueries({ queryKey: ['admin-wallets'] });
    },
    onError: (e) => {
      toast({ title: 'تعدیل ناموفق بود', description: e.message });
      setConfirmOpen(false);
    },
  });

  const amountNum = Number(amount);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-extrabold text-gray-800">تعدیل دستی موجودی (9.8.5)</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-gray-400">
          مبلغ مثبت = شارژ کیف پول، مبلغ منفی = برداشت. هر تعدیل با دلیل و در لاگ ممیزی ثبت می‌شود.
        </p>

        {/* User picker */}
        <div className="mt-4">
          <span className="mb-1 block text-xs font-medium text-gray-500">انتخاب کاربر *</span>
          {selectedUser ? (
            <div className="border-brand-200 bg-brand-50 flex items-center justify-between rounded-xl border px-3 py-2.5">
              <span className="text-brand-800 text-xs font-bold">{selectedUser.label}</span>
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="text-[11px] font-bold text-gray-500 hover:text-red-500"
              >
                تغییر
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search
                  className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                  aria-hidden
                />
                <input
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && setSearch(searchInput.trim())}
                  placeholder="نام یا شماره کاربر (حداقل ۲ نویسه)…"
                  aria-label="جستجوی کاربر برای تعدیل"
                  className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-3 pr-9 text-sm outline-none focus:bg-white"
                />
              </div>
              <button
                type="button"
                onClick={() => setSearch(searchInput.trim())}
                className="shrink-0 rounded-xl bg-gray-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-gray-800"
              >
                جستجو
              </button>
            </div>
          )}
        </div>

        {/* Results */}
        {!selectedUser && search.length >= 2 && (
          <div className="mt-2 overflow-hidden rounded-xl border border-gray-100">
            {results.isLoading ? (
              <p className="px-3 py-3 text-xs text-gray-400">در حال جستجو…</p>
            ) : (results.data?.items ?? []).length === 0 ? (
              <p className="px-3 py-3 text-xs text-gray-400">کاربری یافت نشد</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {results.data!.items.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUser({
                          id: u.id,
                          label: `${u.fullName ?? u.phone} (${u.phone})`,
                        });
                        setSearchInput('');
                        setSearch('');
                      }}
                      className="hover:bg-brand-50/50 flex w-full items-center justify-between px-3 py-2.5 text-right"
                    >
                      <span className="text-xs font-bold text-gray-800">{u.fullName ?? '—'}</span>
                      <span dir="ltr" className="text-[11px] text-gray-400">
                        {u.phone}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Amount + reason */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-500">
              مبلغ (تومان، منفی برای برداشت) *
            </span>
            <input
              dir="ltr"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="-50000"
              className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:bg-white"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-500">
              دلیل * (حداقل ۳ نویسه)
            </span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="جبران خسارت سفارش…"
              className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:bg-white"
            />
          </label>
        </div>

        <button
          type="button"
          disabled={
            !selectedUser ||
            !amount ||
            Number.isNaN(amountNum) ||
            amountNum === 0 ||
            reason.trim().length < 3
          }
          onClick={() => setConfirmOpen(true)}
          className="bg-brand-500 hover:bg-brand-600 mt-4 rounded-xl px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40"
        >
          ثبت تعدیل
        </button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="تأیید تعدیل موجودی"
        description={`${selectedUser?.label ?? ''} — مبلغ ${formatToman(amountNum)} (${amountNum >= 0 ? 'شارژ' : 'برداشت'}). این عملیات قابل بازگشت خودکار نیست.`}
        confirmLabel="ثبت تعدیل"
        pending={adjustMutation.isPending}
        onConfirm={() => adjustMutation.mutate()}
        onCancel={() => setConfirmOpen(false)}
      >
        <p className="rounded-xl bg-gray-50 px-3 py-2 text-[11px] text-gray-500">
          دلیل ثبت‌شده: <span className="font-bold text-gray-700">{reason}</span>
        </p>
      </ConfirmDialog>
    </div>
  );
}
