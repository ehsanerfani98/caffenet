/**
 * Notification templates (Phase 11.2.2) — localized title/body per type.
 *
 * Persian (fa) is the primary locale of the platform; every user carries a
 * `preferredLocale` (default 'fa'). Templates receive the domain-event payload
 * data and render user-facing copy. Amounts arrive as Toman (major units) —
 * they are formatted with thousands separators here.
 */

import { NotificationType } from '@caffenet/shared';

export interface TemplateData {
  [key: string]: unknown;
}

export interface RenderedNotification {
  title: string;
  body: string | null;
  /** Deep-link path for the web client (relative to the app root). */
  link: string | null;
}

/** Format a Toman amount with thousands grouping. */
function fmtAmount(amount: unknown): string {
  const n = typeof amount === 'number' ? amount : Number(amount ?? 0);
  if (!Number.isFinite(n)) return String(amount ?? '');
  return new Intl.NumberFormat('en-US').format(n);
}

/** Format a tracking code like #A1B2C3 */
function fmtTracking(trackingCode: unknown): string {
  return trackingCode ? `#${String(trackingCode)}` : '';
}

type TemplateRenderer = (data: TemplateData) => { title: string; body: string; link?: string };

/**
 * fa templates keyed by NotificationType.
 *
 * `link` values are relative web paths — the customer app resolves them
 * directly; operator/admin recipients override the link in the listener
 * data payload when needed.
 */
const FA_TEMPLATES: Record<NotificationType, TemplateRenderer> = {
  [NotificationType.REQUEST_CREATED]: (d) => ({
    title: 'درخواست جدید ثبت شد',
    body: `درخواست ${fmtTracking(d.trackingCode)} برای سرویس «${String(d.serviceName ?? '')}» ثبت شد و در انتظار بررسی است.`,
    link: `/requests/${String(d.requestId ?? '')}`,
  }),

  [NotificationType.REQUEST_ASSIGNED]: (d) => ({
    title: 'اپراتور به درخواست شما اختصاص یافت',
    body: `درخواست ${fmtTracking(d.trackingCode)} به ${String(d.operatorName ?? 'اپراتور')} اختصاص یافت و بررسی آن آغاز شد.`,
    link: `/requests/${String(d.requestId ?? '')}`,
  }),

  [NotificationType.REQUEST_STATUS_CHANGED]: (d) => ({
    title: `وضعیت درخواست ${fmtTracking(d.trackingCode)} تغییر کرد`,
    body: `وضعیت جدید درخواست: ${String(d.statusFa ?? d.status ?? '')}${d.note ? ` — ${String(d.note)}` : ''}`,
    link: `/requests/${String(d.requestId ?? '')}`,
  }),

  [NotificationType.REQUEST_PRICE_CHANGED]: (d) => ({
    title: `مبلغ درخواست ${fmtTracking(d.trackingCode)} به‌روزرسانی شد`,
    body: `مبلغ جدید: ${fmtAmount(d.newTotal)} تومان${d.previousTotal != null ? ` (قبلی: ${fmtAmount(d.previousTotal)} تومان)` : ''}`,
    link: `/requests/${String(d.requestId ?? '')}`,
  }),

  [NotificationType.NEW_CHAT_MESSAGE]: (d) => ({
    title: 'پیام جدید در گفتگو',
    body: String(d.body ?? 'پیام جدیدی در گفتگوی شما دارید'),
    link: `/chat/${String(d.requestId ?? '')}`,
  }),

  [NotificationType.PAYMENT_SUCCESSFUL]: (d) => ({
    title: 'پرداخت با موفقیت انجام شد',
    body: d.requestId
      ? `پرداخت ${fmtAmount(d.amount)} تومان برای درخواست ${fmtTracking(d.trackingCode)} با موفقیت انجام شد.`
      : `پرداخت ${fmtAmount(d.amount)} تومان با موفقیت انجام شد و به کیف پول شما افزوده شد.`,
    link: d.requestId ? `/requests/${String(d.requestId)}` : '/wallet/transactions',
  }),

  [NotificationType.PAYMENT_FAILED]: (d) => ({
    title: 'پرداخت ناموفق بود',
    body: `پرداخت ${fmtAmount(d.amount)} تومان ناموفق بود${d.reason ? ` — ${String(d.reason)}` : ''}. در صورت کسر وجه، مبلغ حداکثر تا ۷۲ ساعت بازگردانده می‌شود.`,
    link: '/wallet',
  }),

  [NotificationType.WALLET_CHARGED]: (d) => ({
    title: 'کیف پول شما شارژ شد',
    body: `مبلغ ${fmtAmount(d.amount)} تومان به کیف پول شما افزوده شد${d.balance != null ? ` — موجودی جدید: ${fmtAmount(d.balance)} تومان` : ''}.`,
    link: '/wallet/transactions',
  }),

  [NotificationType.REFUND_ISSUED]: (d) => ({
    title: 'بازگشت وجه انجام شد',
    body: `مبلغ ${fmtAmount(d.amount)} تومان به کیف پول شما بازگردانده شد${d.balance != null ? ` — موجودی جدید: ${fmtAmount(d.balance)} تومان` : ''}${d.trackingCode ? ` (درخواست ${fmtTracking(d.trackingCode)})` : ''}.`,
    link: '/wallet/transactions',
  }),

  [NotificationType.REQUEST_COMPLETED]: (d) => ({
    title: 'درخواست شما تکمیل شد',
    body: `درخواست ${fmtTracking(d.trackingCode)} با موفقیت تکمیل شد. از همراهی شما سپاسگزاریم.`,
    link: `/requests/${String(d.requestId ?? '')}`,
  }),

  [NotificationType.REQUEST_CANCELLED]: (d) => ({
    title: 'درخواست شما لغو شد',
    body: `درخواست ${fmtTracking(d.trackingCode)} لغو شد${d.reason ? ` — دلیل: ${String(d.reason)}` : ''}.`,
    link: `/requests/${String(d.requestId ?? '')}`,
  }),
};

/** Fallback used for unknown/custom types (e.g. admin broadcast `system`). */
const SYSTEM_TEMPLATE: TemplateRenderer = (d) => ({
  title: String(d.title ?? 'اطلاعیه'),
  body: String(d.body ?? ''),
  link: d.link ? String(d.link) : undefined,
});

/**
 * Render localized title/body/link for a notification type.
 * `locale` is reserved for future locales — fa is the only shipped locale.
 */
export function renderNotification(
  type: string,
  data: TemplateData = {},
  locale = 'fa',
): RenderedNotification {
  void locale; // fa-only for now; see preferredLocale on User
  const known = Object.values(NotificationType) as string[];
  const renderer = known.includes(type) ? FA_TEMPLATES[type as NotificationType] : SYSTEM_TEMPLATE;
  const rendered = renderer(data);
  return {
    title: rendered.title,
    body: rendered.body || null,
    // Caller-provided link wins (e.g. operator dashboard deep-links)
    link: (data.link ? String(data.link) : rendered.link) ?? null,
  };
}

/**
 * Notification types considered critical for SMS (11.2.7) — money movement
 * with user impact. SMS is disabled by default for everything else.
 */
export const SMS_CRITICAL_TYPES: ReadonlySet<string> = new Set([
  NotificationType.PAYMENT_FAILED,
  NotificationType.REFUND_ISSUED,
]);
