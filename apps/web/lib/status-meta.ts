import { formatToman } from '@/lib/format';

/**
 * Request status → Persian label + badge color (7.7).
 */
export const REQUEST_STATUS_LABELS: Record<string, string> = {
  pending: 'در انتظار بررسی',
  reviewing: 'در حال بررسی',
  waiting_for_customer: 'در انتظار پاسخ شما',
  in_progress: 'در حال انجام',
  waiting_for_payment: 'در انتظار پرداخت',
  paid: 'پرداخت شده',
  completed: 'تکمیل شده',
  cancelled: 'لغو شده',
  rejected: 'رد شده',
};

export const REQUEST_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  reviewing: 'bg-blue-50 text-blue-700 border-blue-200',
  waiting_for_customer: 'bg-purple-50 text-purple-700 border-purple-200',
  in_progress: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  waiting_for_payment: 'bg-orange-50 text-orange-700 border-orange-200',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: 'پرداخت نشده',
  partially_paid: 'پرداخت جزئی',
  paid: 'پرداخت شده',
  refunded: 'بازگشت داده شده',
};

export const WALLET_TX_LABELS: Record<string, string> = {
  deposit: 'شارژ کیف پول',
  withdrawal: 'برداشت',
  service_payment: 'پرداخت خدمت',
  refund: 'بازگشت وجه',
  discount: 'تخفیف',
  bonus: 'هدیه',
  manual_adjustment: 'اصلاح دستی',
  payment_reversal: 'برگشت پرداخت',
};

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: 'پیش‌نویس',
  issued: 'صادر شده',
  paid: 'پرداخت شده',
  void: 'باطل شده',
};

export function requestStatusLabel(status: string): string {
  return REQUEST_STATUS_LABELS[status] ?? status;
}

export function statusColorClass(status: string): string {
  return REQUEST_STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600 border-gray-200';
}

/**
 * UX order for customer-visible timeline progression (7.4.5 progress).
 */
export const STATUS_ORDER: string[] = [
  'pending',
  'reviewing',
  'in_progress',
  'waiting_for_payment',
  'paid',
  'completed',
];

export function statusProgress(status: string): number {
  const idx = STATUS_ORDER.indexOf(status);
  if (idx < 0) return status === 'cancelled' || status === 'rejected' ? 0 : 0;
  return Math.round(((idx + 1) / STATUS_ORDER.length) * 100);
}

export function priceLabel(amount: number | null | undefined): string {
  return formatToman(amount);
}
