'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { History, Package, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PriceBreakdown } from '@/components/common/PriceBreakdown';
import { Skeleton } from '@/components/common/Skeleton';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { operatorApi, type CostBreakdown } from '@/lib/api/operator';
import { formatJalaliDateTime, formatToman, toPersianDigits } from '@/lib/format';
import { OPERATOR_KEYS } from './requests-cache';

/**
 * CostEditor (8.4.5 / 5.2) — set material + additional costs (Toman).
 * Final totals are computed SERVER-SIDE; this component only sends the two
 * editable components and re-renders the PriceBreakdown from the response.
 * Includes the cost audit trail (GET /requests/:id/cost-history).
 */

const COST_CHANGE_LABELS: Record<string, string> = {
  labor: 'دستمزد خدمت',
  material: 'هزینه مواد',
  additional: 'هزینه‌های تکمیلی',
  discount: 'تخفیف',
};

/** Persian/Arabic digits → latin digits, separators stripped. */
function normalizeDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

/** '' | invalid → null; else rounded non-negative integer (Toman). */
function parseTomanInput(raw: string): number | null {
  const cleaned = normalizeDigits(raw).replace(/[,\s٬]/g, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

interface CostEditorProps {
  requestId: string;
  /** `pricing.update` permission — hide the inputs for view-only roles */
  canEdit: boolean;
}

export function CostEditor({ requestId, canEdit }: CostEditorProps) {
  const queryClient = useQueryClient();
  const [material, setMaterial] = useState('');
  const [additional, setAdditional] = useState('');

  const costs = useQuery({
    queryKey: OPERATOR_KEYS.costs(requestId),
    queryFn: () => operatorApi.costs(requestId),
    retry: false,
  });

  const history = useQuery({
    queryKey: OPERATOR_KEYS.costHistory(requestId),
    queryFn: () => operatorApi.costHistory(requestId),
    retry: false,
  });

  // Prefill the inputs when the cost snapshot arrives
  useEffect(() => {
    if (costs.data) {
      setMaterial(String(costs.data.materialCost ?? 0));
      setAdditional(String(costs.data.additionalCost ?? 0));
    }
  }, [costs.data]);

  const mutation = useMutation({
    mutationFn: async () => {
      const data: { materialCostToman?: number; additionalCostToman?: number } = {};
      const m = parseTomanInput(material);
      const a = parseTomanInput(additional);
      if (m !== null && m !== (costs.data?.materialCost ?? 0)) data.materialCostToman = m;
      if (a !== null && a !== (costs.data?.additionalCost ?? 0)) data.additionalCostToman = a;
      if (Object.keys(data).length === 0) {
        throw new Error('تغییری برای ذخیره وجود ندارد');
      }
      return operatorApi.updateCosts(requestId, data);
    },
    onSuccess: (updated: CostBreakdown) => {
      toast({
        title: 'هزینه‌ها ذخیره شد',
        description: `مبلغ نهایی: ${formatToman(updated.finalTotal)}`,
      });
      void queryClient.invalidateQueries({ queryKey: OPERATOR_KEYS.costs(requestId) });
      void queryClient.invalidateQueries({ queryKey: OPERATOR_KEYS.costHistory(requestId) });
      void queryClient.invalidateQueries({ queryKey: OPERATOR_KEYS.request(requestId) });
      void queryClient.invalidateQueries({ queryKey: OPERATOR_KEYS.lists });
    },
    onError: (e) => {
      toast({
        title: 'خطا در ثبت هزینه‌ها',
        description: e instanceof Error ? e.message : 'لطفاً دوباره تلاش کنید',
      });
    },
  });

  const cost = costs.data;

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-800">
        <Package className="text-brand-600 h-4 w-4" />
        هزینه‌ها و قیمت نهایی
      </h2>

      {costs.isLoading ? (
        <Skeleton className="h-32 w-full rounded-xl" />
      ) : costs.isError || !cost ? (
        <p className="rounded-xl bg-gray-50 p-3 text-xs leading-relaxed text-gray-500">
          اطلاعاتی قیمت برای این درخواست یافت نشد.
        </p>
      ) : (
        <div className="space-y-4">
          {canEdit ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-gray-500">
                  هزینه مواد (تومان)
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  value={material}
                  onChange={(e) => setMaterial(e.target.value)}
                  className="focus:border-brand-500 focus:ring-brand-100 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm tabular-nums focus:outline-none focus:ring-2"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-gray-500">
                  هزینه‌های تکمیلی (تومان)
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  value={additional}
                  onChange={(e) => setAdditional(e.target.value)}
                  className="focus:border-brand-500 focus:ring-brand-100 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm tabular-nums focus:outline-none focus:ring-2"
                />
              </label>
              <div className="sm:col-span-2">
                <Button
                  className="w-full gap-2"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate()}
                >
                  <Save className="h-4 w-4" />
                  {mutation.isPending ? 'در حال ذخیره…' : 'ذخیره هزینه‌ها'}
                </Button>
              </div>
            </div>
          ) : (
            <p className="rounded-xl bg-gray-50 p-3 text-xs text-gray-500">
              شما اجازه ویرایش هزینه‌ها را ندارید — فقط مشاهده.
            </p>
          )}

          <PriceBreakdown
            laborFee={cost.laborFee ?? 0}
            materialCost={cost.materialCost ?? 0}
            additionalCost={cost.additionalCost ?? 0}
            discountAmount={cost.discountAmount ?? 0}
            finalTotal={cost.finalTotal ?? 0}
            compact={false}
          />
        </div>
      )}

      {/* Cost audit trail */}
      {history.data && history.data.entries.length > 0 && (
        <details className="mt-4 rounded-xl border border-gray-100 bg-gray-50/60 p-3">
          <summary className="flex cursor-pointer items-center gap-2 text-xs font-bold text-gray-600">
            <History className="h-3.5 w-3.5" />
            تاریخچه تغییرات قیمت
            <span className="text-gray-400">
              ({toPersianDigits(history.data.entries.length)} مورد)
            </span>
          </summary>
          <ul className="mt-3 max-h-56 space-y-2.5 overflow-y-auto pl-1">
            {history.data.entries.map((h) => (
              <li key={h.id} className="rounded-lg bg-white p-2.5 text-xs shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-gray-700">
                    {COST_CHANGE_LABELS[h.changeType] ?? h.changeType}
                  </span>
                  <span className="tabular-nums text-gray-500">
                    {formatToman(h.previousAmount)} → {formatToman(h.newAmount)}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-gray-400">
                  <span>{formatJalaliDateTime(h.createdAt)}</span>
                  {h.reason && <span className="truncate">دلیل: {h.reason}</span>}
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
