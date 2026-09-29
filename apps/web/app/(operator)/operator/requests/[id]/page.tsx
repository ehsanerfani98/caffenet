'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  Link2,
  Loader2,
  Phone,
  UserMinus,
  UserPlus,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { DetailSkeleton } from '@/components/common/Skeleton';
import { ErrorState } from '@/components/common/ErrorState';
import { RequestTimeline } from '@/components/common/RequestTimeline';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { CostEditor } from '@/components/operator/CostEditor';
import { DiscountApplier } from '@/components/operator/DiscountApplier';
import { StatusChanger } from '@/components/operator/StatusChanger';
import { OPERATOR_KEYS, invalidateRequestCache } from '@/components/operator/requests-cache';
import { operatorApi, type OperatorAttachment } from '@/lib/api/operator';
import { formatFileSize, formatJalaliDateTime, formatToman, toPersianDigits } from '@/lib/format';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useUiStore } from '@/lib/stores/ui-store';
import { PAYMENT_STATUS_LABELS, REQUEST_STATUS_LABELS } from '@/lib/status-meta';

/**
 * Operator Request Detail (8.4) — customer panel, submitted form data,
 * attachments + download, status changer (state machine), cost editor,
 * discount applier, assign/unassign, payment link box, mark-complete and
 * the timeline + status-history audit view.
 */
export default function OperatorRequestDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const canAssign = user?.permissions.includes('requests.assign') ?? false;
  const canUpdateCosts = user?.permissions.includes('pricing.update') ?? false;
  const canApplyDiscount = user?.permissions.includes('discounts.apply') ?? false;

  // ---------- Data ----------
  const request = useQuery({
    queryKey: OPERATOR_KEYS.request(id ?? ''),
    queryFn: () => operatorApi.get(id as string),
    enabled: Boolean(id),
  });

  const transitions = useQuery({
    queryKey: OPERATOR_KEYS.transitions(id ?? ''),
    queryFn: () => operatorApi.allowedTransitions(id as string),
    enabled: Boolean(id),
  });

  const timeline = useQuery({
    queryKey: OPERATOR_KEYS.timeline(id ?? ''),
    queryFn: () => operatorApi.timeline(id as string),
    enabled: Boolean(id),
  });

  const history = useQuery({
    queryKey: OPERATOR_KEYS.history(id ?? ''),
    queryFn: () => operatorApi.history(id as string),
    enabled: Boolean(id),
  });

  const attachments = useQuery({
    queryKey: OPERATOR_KEYS.attachments(id ?? ''),
    queryFn: () => operatorApi.attachments(id as string),
    enabled: Boolean(id),
    retry: false,
  });

  // ---------- Mutations ----------
  const assign = useMutation({
    mutationFn: () => operatorApi.assign(id as string, user ? { operatorId: Number(user.id) } : {}),
    onSuccess: () => {
      toast({ title: 'درخواست به شما تخصیص یافت' });
      invalidateRequestCache(queryClient, id as string);
    },
    onError: (e) =>
      toast({
        title: 'خطا در تخصیص',
        description: e instanceof Error ? e.message : 'لطفاً دوباره تلاش کنید',
      }),
  });

  const unassign = useMutation({
    mutationFn: () => operatorApi.unassign(id as string),
    onSuccess: () => {
      toast({ title: 'تخصیص درخواست رفع شد' });
      invalidateRequestCache(queryClient, id as string);
    },
    onError: (e) =>
      toast({
        title: 'خطا در رفع تخصیص',
        description: e instanceof Error ? e.message : 'لطفاً دوباره تلاش کنید',
      }),
  });

  const complete = useMutation({
    mutationFn: () => operatorApi.changeStatus(id as string, { status: 'completed' }),
    onSuccess: () => {
      toast({ title: 'درخواست تکمیل شد', description: 'کارها را نچسبانید — آفرین!' });
      invalidateRequestCache(queryClient, id as string);
    },
    onError: (e) =>
      toast({
        title: 'خطا در تکمیل درخواست',
        description: e instanceof Error ? e.message : 'لطفاً دوباره تلاش کنید',
      }),
  });

  const showCompleteSheet = () => {
    useUiStore.getState().openSheet(
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-gray-600">
          آیا از تکمیل این درخواست مطمئن هستید؟ پس از تکمیل، وضعیت دیگر قابل تغییر نیست.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => useUiStore.getState().closeSheet()}
            className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-600"
          >
            انصراف
          </button>
          <button
            type="button"
            onClick={() => {
              complete.mutate();
              useUiStore.getState().closeSheet();
            }}
            className="bg-brand-600 rounded-xl px-4 py-2.5 text-sm font-bold text-white"
          >
            تکمیل درخواست
          </button>
        </div>
      </div>,
      'تکمیل درخواست',
    );
  };

  // ---------- Loading / error ----------
  if (request.isLoading) {
    return <DetailSkeleton />;
  }

  if (request.isError || !request.data || !id) {
    return (
      <ErrorState
        title="درخواست یافت نشد"
        description="ممکن است این درخواست به شما تخصیص نیافته یا حذف شده باشد."
        onRetry={() => void request.refetch()}
      />
    );
  }

  const r = request.data;
  const status = String(r.status);
  const allowed = transitions.data?.allowed ?? [];
  const canComplete = allowed.includes('completed');
  const assignedToMe =
    r.assignedOperatorId != null &&
    user != null &&
    String(r.assignedOperatorId) === String(user.id);
  const historyItems = history.data?.items ?? [];

  return (
    <div className="space-y-5">
      {/* ===== Header ===== */}
      <div className="flex items-center gap-2">
        <Link
          href="/operator/requests"
          aria-label="بازگشت به درخواست‌های من"
          className="rounded-full p-2 text-gray-600 active:bg-gray-100"
        >
          <ArrowRight className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-extrabold text-gray-900">
            {r.service?.name ?? 'درخواست'}
          </h2>
          <p dir="ltr" className="text-right font-mono text-xs text-gray-400">
            {r.trackingCode}
          </p>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* ===== Summary ===== */}
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <dl className="space-y-2.5 text-sm">
          <Row label="مبلغ نهایی">
            <span className="font-extrabold text-gray-900">{formatToman(r.finalTotal)}</span>
          </Row>
          <Row label="وضعیت پرداخت">
            <span className="text-gray-700">
              {PAYMENT_STATUS_LABELS[r.paymentStatus] ?? r.paymentStatus}
            </span>
          </Row>
          <Row label="اپراتور">
            <span className="text-gray-700">
              {r.assignedOperator?.fullName ?? r.assignedOperator?.phone ?? 'تخصیص نیافته'}
            </span>
          </Row>
          <Row label="تاریخ ثبت">
            <span className="text-gray-700">{formatJalaliDateTime(r.createdAt)}</span>
          </Row>
          {r.completedAt && (
            <Row label="تاریخ تکمیل">
              <span className="text-gray-700">{formatJalaliDateTime(r.completedAt)}</span>
            </Row>
          )}
        </dl>

        {r.description && (
          <p className="mt-4 rounded-xl bg-gray-50 p-3 text-xs leading-relaxed text-gray-600">
            {r.description}
          </p>
        )}
      </section>

      {/* ===== Customer panel (8.4.1) ===== */}
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-800">
          <UserRound className="text-brand-600 h-4 w-4" />
          اطلاعات مشتری
        </h2>
        <dl className="space-y-2.5 text-sm">
          <Row label="نام">
            <span className="font-bold text-gray-800">{r.customer?.fullName ?? '—'}</span>
          </Row>
          <Row label="شماره تماس">
            {r.customer?.phone ? (
              <a
                href={`tel:${r.customer.phone}`}
                dir="ltr"
                className="text-brand-600 flex items-center gap-1.5 font-bold hover:underline"
              >
                <Phone className="h-3.5 w-3.5" />
                {r.customer.phone}
              </a>
            ) : (
              '—'
            )}
          </Row>
          <Row label="روش تماس / شناسه">
            <span className="text-gray-700">{r.contactValue ?? '—'}</span>
          </Row>
        </dl>
      </section>

      {/* ===== Submitted form data (8.4.2) ===== */}
      {r.fieldValues && r.fieldValues.length > 0 && (
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-800">
            <FileText className="text-brand-600 h-4 w-4" />
            اطلاعات فرم ثبت‌شده
          </h2>
          <dl className="space-y-2 text-xs">
            {r.fieldValues.map((fv) => (
              <div
                key={fv.id}
                className="flex items-start justify-between gap-3 border-b border-gray-50 pb-2 last:border-0 last:pb-0"
              >
                <dt className="shrink-0 text-gray-400">{fv.fieldLabel ?? fv.fieldName}</dt>
                <dd className="text-left font-medium text-gray-700">{fv.value ?? '—'}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* ===== Attachments (8.4.3) ===== */}
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-gray-800">پیوست‌ها</h2>
        {attachments.isLoading ? (
          <p className="py-2 text-xs text-gray-400">در حال دریافت پیوست‌ها…</p>
        ) : attachments.isError ? (
          <p className="py-2 text-xs text-gray-500">خطا در دریافت پیوست‌ها.</p>
        ) : (attachments.data?.items ?? []).length === 0 ? (
          <p className="rounded-xl bg-gray-50 p-3 text-xs text-gray-500">
            پیوستی برای این درخواست ثبت نشده است.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {(attachments.data?.items ?? []).map((a) => (
              <AttachmentRow key={a.id} attachment={a} />
            ))}
          </ul>
        )}
      </section>

      {/* ===== Status changer (8.4.4) ===== */}
      <StatusChanger requestId={id} currentStatus={status} />

      {/* ===== Mark complete ===== */}
      {canComplete && status !== 'completed' && (
        <button
          type="button"
          onClick={showCompleteSheet}
          className="border-brand-200 bg-brand-50 text-brand-700 active:bg-brand-100 flex w-full items-center justify-center gap-2 rounded-2xl border p-4 text-sm font-bold transition-colors"
        >
          <CheckCircle2 className="h-4.5 w-4.5" />
          علامت‌گذاری به‌عنوان تکمیل‌شده
        </button>
      )}

      {/* ===== Assign / reassign (8.4.7) ===== */}
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-gray-800">تخصیص اپراتور</h2>
        <p className="mb-3 text-xs text-gray-500">
          {r.assignedOperator
            ? `این درخواست به «${r.assignedOperator.fullName ?? r.assignedOperator.phone}» تخصیص یافته است.`
            : 'این درخواست هنوز به هیچ اپراتوری تخصیص نیافته است.'}
        </p>
        {canAssign ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {!assignedToMe && (
              <Button
                variant="outline"
                className="gap-2"
                disabled={assign.isPending}
                onClick={() => assign.mutate()}
              >
                <UserPlus className="text-brand-600 h-4 w-4" />
                {assign.isPending ? 'در حال تخصیص…' : 'تخصیص به من'}
              </Button>
            )}
            {r.assignedOperatorId && (
              <Button
                variant="outline"
                className="gap-2 border-red-200 text-red-600 hover:bg-red-50"
                disabled={unassign.isPending}
                onClick={() => unassign.mutate()}
              >
                <UserMinus className="h-4 w-4" />
                {unassign.isPending ? 'در حال رفع…' : 'رفع تخصیص'}
              </Button>
            )}
          </div>
        ) : (
          <p className="rounded-xl bg-gray-50 p-2.5 text-[11px] text-gray-400">
            دسترسی تخصیص درخواست برای حساب شما فعال نیست.
          </p>
        )}
      </section>

      {/* ===== Costs (8.4.5) ===== */}
      <CostEditor requestId={id} canEdit={canUpdateCosts} />

      {/* ===== Discount (8.4.6) ===== */}
      <DiscountApplier requestId={id} canApply={canApplyDiscount} />

      {/* ===== Payment link box (8.4.8) ===== */}
      <PaymentLinkBox requestId={id} />

      {/* ===== Timeline + history audit (8.4.9) ===== */}
      <section aria-label="روند درخواست">
        <h2 className="mb-3 text-sm font-bold text-gray-800">روند درخواست</h2>
        {timeline.isLoading ? (
          <p className="py-2 text-xs text-gray-400">در حال دریافت روند…</p>
        ) : timeline.isError ? (
          <ErrorState title="خطا در دریافت روند" onRetry={() => void timeline.refetch()} />
        ) : (
          <RequestTimeline entries={timeline.data ?? []} />
        )}

        {historyItems.length > 0 && (
          <details className="mt-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <summary className="cursor-pointer text-xs font-bold text-gray-600">
              تاریخچه ممیزی وضعیت‌ها ({toPersianDigits(historyItems.length)} رکورد)
            </summary>
            <ul className="mt-3 space-y-2.5">
              {historyItems.map((h) => (
                <li key={h.id} className="rounded-xl bg-gray-50 p-3 text-xs">
                  <p className="font-bold text-gray-700">
                    {h.previousStatus
                      ? `${REQUEST_STATUS_LABELS[h.previousStatus] ?? h.previousStatus} ← `
                      : ''}
                    {REQUEST_STATUS_LABELS[h.newStatus] ?? h.newStatus}
                  </p>
                  <p className="mt-1 text-[10px] text-gray-400">
                    {formatJalaliDateTime(h.createdAt)}
                    {h.userName ? ` — توسط ${h.userName}` : ''}
                  </p>
                  {h.note && <p className="mt-1 text-[11px] text-gray-500">{h.note}</p>}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
    </div>
  );
}

// ==================== Local pieces ====================

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="shrink-0 text-gray-400">{label}</dt>
      <dd className="min-w-0 text-left">{children}</dd>
    </div>
  );
}

/** One attachment row with a signed-URL download button. */
function AttachmentRow({ attachment: a }: { attachment: OperatorAttachment }) {
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    setDownloading(true);
    try {
      if (a.url) {
        window.open(a.url, '_blank', 'noopener');
      } else {
        const { url } = await operatorApi.fileUrl(a.fileId);
        window.open(url, '_blank', 'noopener');
      }
    } catch {
      toast({ title: 'خطا در دریافت فایل', description: 'دوباره تلاش کنید' });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <li className="flex items-center gap-3 rounded-xl border border-gray-100 p-3">
      <span className="bg-brand-50 text-brand-700 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
        <FileText className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold text-gray-800" dir="auto">
          {a.originalName ?? 'فایل پیوست'}
        </p>
        <p className="mt-0.5 text-[10px] text-gray-400">
          {a.sizeBytes != null ? formatFileSize(a.sizeBytes) : ''}
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0 gap-1.5"
        onClick={() => void download()}
        disabled={downloading}
      >
        {downloading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Download className="h-3.5 w-3.5" />
        )}
        دانلود
      </Button>
    </li>
  );
}

/** Readonly shareable payment link + copy-to-clipboard. */
function PaymentLinkBox({ requestId }: { requestId: string }) {
  const [origin, setOrigin] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const link = `${origin}/requests/${requestId}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast({ title: 'لینک پرداخت کپی شد' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: 'کپی ناموفق بود',
        description: 'لینک را به‌صورت دستی انتخاب و کپی کنید',
      });
    }
  };

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-800">
        <Link2 className="text-brand-600 h-4 w-4" />
        لینک پرداخت مشتری
      </h2>
      <div className="flex gap-2">
        <input
          readOnly
          dir="ltr"
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 font-mono text-xs text-gray-600"
          aria-label="لینک پرداخت درخواست"
        />
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5"
          onClick={() => void copy()}
        >
          <Copy className="h-3.5 w-3.5" />
          {copied ? 'کپی شد' : 'کپی'}
        </Button>
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-gray-400">
        این لینک را برای مشتری ارسال کنید تا صفحه درخواست و پرداخت را در مرورگر خود ببیند.
      </p>
    </section>
  );
}
