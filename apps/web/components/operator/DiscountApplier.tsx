'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BadgePercent, CheckCircle2, ScanSearch, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { operatorApi, type DiscountValidateResult } from '@/lib/api/operator';
import { formatToman } from '@/lib/format';
import { OPERATOR_KEYS } from './requests-cache';

/**
 * DiscountApplier (8.4.6 / 5.3) — validate a discount code against the request
 * (preview) then apply it. Applying is permission-gated (`discounts.apply`);
 * validation is available to any operator (requests.view).
 */

interface DiscountApplierProps {
  requestId: string;
  /** `discounts.apply` permission — hide the apply action without it */
  canApply: boolean;
}

export function DiscountApplier({ requestId, canApply }: DiscountApplierProps) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<DiscountValidateResult | null>(null);

  const validate = useMutation({
    mutationFn: () => operatorApi.validateDiscount(code, requestId),
    onSuccess: (result) => {
      setPreview(result);
      if (!result.valid) {
        toast({ title: 'کد نامعتبر است', description: result.message });
      }
    },
    onError: (e) => {
      setPreview(null);
      toast({
        title: 'خطا در بررسی کد',
        description: e instanceof Error ? e.message : 'لطفاً دوباره تلاش کنید',
      });
    },
  });

  const apply = useMutation({
    mutationFn: () => operatorApi.applyDiscount(code, requestId),
    onSuccess: (result) => {
      toast({
        title: 'کد تخفیف اعمال شد',
        description:
          typeof result.discountAmount === 'number'
            ? `مبلغ تخفیف: ${formatToman(result.discountAmount)}`
            : 'تخفیف روی این درخواست ثبت شد',
      });
      setCode('');
      setPreview(null);
      void queryClient.invalidateQueries({ queryKey: OPERATOR_KEYS.costs(requestId) });
      void queryClient.invalidateQueries({ queryKey: OPERATOR_KEYS.costHistory(requestId) });
      void queryClient.invalidateQueries({ queryKey: OPERATOR_KEYS.request(requestId) });
    },
    onError: (e) => {
      toast({
        title: 'خطا در اعمال کد',
        description: e instanceof Error ? e.message : 'لطفاً دوباره تلاش کنید',
      });
    },
  });

  const codeTrimmed = code.trim();
  const canValidate = codeTrimmed.length >= 3 && !validate.isPending;
  const canSubmitApply = canApply && preview?.valid === true && !apply.isPending;

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-bold text-gray-800">
        <BadgePercent className="text-brand-600 h-4 w-4" />
        کد تخفیف
      </h2>
      <p className="mb-3 text-[11px] leading-relaxed text-gray-400">
        ابتدا کد را اعتبارسنجی کنید، سپس در صورت معتبر بودن آن را روی درخواست اعمال کنید.
      </p>

      <div className="flex gap-2">
        <input
          type="text"
          dir="ltr"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setPreview(null);
          }}
          placeholder="DISCOUNT-CODE"
          className="focus:border-brand-500 focus:ring-brand-100 min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
        />
        <Button
          variant="outline"
          className="shrink-0 gap-1.5"
          disabled={!canValidate}
          onClick={() => validate.mutate()}
        >
          <ScanSearch className="h-4 w-4" />
          {validate.isPending ? '…' : 'بررسی'}
        </Button>
      </div>

      {/* Validation preview */}
      {preview && (
        <div
          className={`mt-3 rounded-xl border p-3 text-xs leading-relaxed ${
            preview.valid
              ? 'border-brand-200 bg-brand-50 text-brand-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          <p className="flex items-center gap-1.5 font-bold">
            {preview.valid ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {preview.message}
          </p>
          {preview.valid && preview.discount && (
            <p className="mt-1">
              نوع: {preview.discount.type === 'percent' ? 'درصدی' : 'مبلغ ثابت'} — مقدار:{' '}
              {preview.discount.type === 'percent'
                ? `${preview.discount.value}٪`
                : formatToman(preview.discount.value)}
            </p>
          )}
          {preview.valid && preview.preview && (
            <p className="mt-1 tabular-nums">
              تخفیف: {formatToman(preview.preview.discountAmount)} — مبلغ نهایی پس از تخفیف:{' '}
              {formatToman(preview.preview.finalTotal)}
            </p>
          )}
        </div>
      )}

      {canApply ? (
        <Button className="mt-3 w-full" disabled={!canSubmitApply} onClick={() => apply.mutate()}>
          {apply.isPending ? 'در حال اعمال…' : 'اعمال کد روی درخواست'}
        </Button>
      ) : (
        <p className="mt-3 rounded-xl bg-gray-50 p-2.5 text-center text-[11px] text-gray-400">
          اعمال کد تخفیف برای حساب شما فعال نیست.
        </p>
      )}
    </section>
  );
}
