'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Monitor, Smartphone } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { MobileHeader } from '@/components/common/MobileHeader';
import { authApi } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/stores/auth-store';
import { formatJalaliDateTime, formatRelative } from '@/lib/format';
import { toPersianDigits } from '@/lib/format';

/**
 * Sessions list & revoke (7.9.4).
 */
export default function SessionsPage() {
  const queryClient = useQueryClient();
  const refreshToken = useAuthStore((s) => s.refreshToken);

  const sessions = useQuery({
    queryKey: ['sessions'],
    queryFn: () => authApi.listSessions(),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => authApi.revokeSession(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['sessions'] }),
  });

  const revokeAll = useMutation({
    mutationFn: () => authApi.revokeAllSessions(refreshToken ?? ''),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['sessions'] }),
  });

  const items = sessions.data?.sessions ?? [];

  return (
    <>
      <MobileHeader title="نشست‌های فعال" showBack showBell={false} />
      <div className="space-y-3 pt-3">
        {sessions.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-gray-200/80" />
            ))}
          </div>
        ) : sessions.isError ? (
          <ErrorState onRetry={() => sessions.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState title="نشستی یافت نشد" />
        ) : (
          <>
            <p className="text-xs text-gray-400">
              {toPersianDigits(items.length)} نشست فعال — دستگاه‌های واردشده به حساب شما
            </p>
            <ul className="space-y-2">
              {items.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
                >
                  <div className="bg-brand-50 text-brand-600 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                    {/mobile|android|iphone/i.test(s.userAgent ?? '') ? (
                      <Smartphone className="h-5 w-5" />
                    ) : (
                      <Monitor className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-gray-700" dir="ltr">
                      {s.userAgent ?? 'دستگاه ناشناس'}
                    </p>
                    <p className="mt-0.5 text-[11px] text-gray-400">
                      {s.ip ? <span dir="ltr">{s.ip}</span> : null} ·{' '}
                      {formatRelative(s.lastUsedAt ?? s.createdAt)}
                    </p>
                    <p className="text-[10px] text-gray-300">
                      انقضا: {formatJalaliDateTime(s.expiresAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => revoke.mutate(s.id)}
                    disabled={revoke.isPending}
                    className="shrink-0 rounded-full border border-red-100 px-3 py-1.5 text-[11px] font-bold text-red-500 active:bg-red-50"
                  >
                    باطل کن
                  </button>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => revokeAll.mutate()}
              disabled={revokeAll.isPending}
              className="mt-2 w-full rounded-2xl border border-red-100 bg-white p-3.5 text-sm font-bold text-red-500 active:bg-red-50 disabled:opacity-40"
            >
              باطل کردن همه نشست‌های دیگر
            </button>
          </>
        )}
      </div>
    </>
  );
}
