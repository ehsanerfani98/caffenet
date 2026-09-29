'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCcw } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { operatorApi } from '@/lib/api/operator';
import { REQUEST_STATUS_LABELS } from '@/lib/status-meta';
import { invalidateRequestCache, OPERATOR_KEYS } from './requests-cache';

/**
 * StatusChanger (8.4.4) — dropdown of server-allowed next statuses
 * (state machine via GET /operator/requests/:id/allowed-transitions)
 * + optional note + confirm → PATCH /operator/requests/:id/status.
 */

interface StatusChangerProps {
  requestId: string;
  currentStatus: string;
}

export function StatusChanger({ requestId, currentStatus }: StatusChangerProps) {
  const queryClient = useQueryClient();
  const [nextStatus, setNextStatus] = useState('');
  const [note, setNote] = useState('');

  const transitions = useQuery({
    queryKey: OPERATOR_KEYS.transitions(requestId),
    queryFn: () => operatorApi.allowedTransitions(requestId),
  });

  const mutation = useMutation({
    mutationFn: () =>
      operatorApi.changeStatus(requestId, {
        status: nextStatus,
        note: note.trim() ? note.trim() : undefined,
      }),
    onSuccess: (updated) => {
      toast({
        title: 'وضعیت به‌روزرسانی شد',
        description: `وضعیت جدید: ${REQUEST_STATUS_LABELS[String(updated.status)] ?? String(updated.status)}`,
      });
      setNextStatus('');
      setNote('');
      invalidateRequestCache(queryClient, requestId);
    },
    onError: (e) => {
      toast({
        title: 'خطا در تغییر وضعیت',
        description: e instanceof Error ? e.message : 'لطفاً دوباره تلاش کنید',
      });
    },
  });

  const allowed = transitions.data?.allowed ?? [];
  const canSubmit = nextStatus !== '' && !mutation.isPending;

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-gray-800">تغییر وضعیت</h2>
        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-semibold text-gray-600">
          وضعیت فعلی: {REQUEST_STATUS_LABELS[currentStatus] ?? currentStatus}
        </span>
      </div>

      {transitions.isLoading ? (
        <div className="flex items-center gap-2 py-4 text-xs text-gray-400">
          <RefreshCcw className="h-4 w-4 animate-spin" />
          در حال دریافت وضعیت‌های مجاز…
        </div>
      ) : transitions.isError ? (
        <div className="py-4">
          <Button variant="outline" size="sm" onClick={() => void transitions.refetch()}>
            تلاش مجدد
          </Button>
        </div>
      ) : allowed.length === 0 ? (
        <p className="rounded-xl bg-gray-50 p-3 text-xs leading-relaxed text-gray-500">
          این درخواست در وضعیت پایانی است و امکان تغییر وضعیت وجود ندارد.
        </p>
      ) : (
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-gray-500">وضعیت جدید</span>
            <select
              value={nextStatus}
              onChange={(e) => setNextStatus(e.target.value)}
              className="focus:border-brand-500 focus:ring-brand-100 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2"
            >
              <option value="">انتخاب کنید…</option>
              {allowed.map((s) => (
                <option key={s} value={s}>
                  {REQUEST_STATUS_LABELS[s] ?? s}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-gray-500">
              یادداشت (اختیاری — در تاریخچه ثبت می‌شود)
            </span>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={2000}
              placeholder="مثلاً دلیل رد یا توضیح تغییر وضعیت"
              className="focus:border-brand-500 focus:ring-brand-100 w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2"
            />
          </label>

          <Button className="w-full" disabled={!canSubmit} onClick={() => mutation.mutate()}>
            {mutation.isPending ? 'در حال ثبت…' : 'ثبت تغییر وضعیت'}
          </Button>
        </div>
      )}
    </section>
  );
}
