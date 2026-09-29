/**
 * Formatting helpers — Persian locale display (7.4+).
 * Currency is Toman (major units); dates render as Jalali via Intl.
 */

const faDigitMap = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function toPersianDigits(input: string | number): string {
  return String(input).replace(/\d/g, (d) => faDigitMap[Number(d)] ?? d);
}

/** 125000 → "۱۲۵٬۰۰۰ تومان" */
export function formatToman(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—';
  const formatted = new Intl.NumberFormat('fa-IR').format(Math.round(amount));
  return `${formatted} تومان`;
}

/** Signed amount for transaction rows: "+۵۰٬۰۰۰" / "−۱۲٬۵۰۰" */
export function formatSignedToman(amount: number): string {
  const abs = new Intl.NumberFormat('fa-IR').format(Math.abs(Math.round(amount)));
  return amount >= 0 ? `+${abs}` : `−${abs}`;
}

/** ISO date → Jalali Persian date, e.g. "۱۴۰۴/۰۷/۰۷" */
export function formatJalaliDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat('fa-IR-u-nu-arabext', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'Asia/Tehran',
    }).format(d);
  } catch {
    return '—';
  }
}

/** ISO date → Jalali date + time, e.g. "۱۴۰۴/۰۷/۰۷ ۱۴:۳۰" */
export function formatJalaliDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const date = new Intl.DateTimeFormat('fa-IR-u-nu-arabext', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'Asia/Tehran',
    }).format(d);
    const time = new Intl.DateTimeFormat('fa-IR-u-nu-arabext', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Tehran',
    }).format(d);
    return `${date} ${time}`;
  } catch {
    return '—';
  }
}

export function hasPersianDigits(s: string): boolean {
  for (const ch of s) if (faDigitMap.includes(ch)) return true;
  return false;
}

/** Relative time in Persian — "۳ ساعت پیش" */
export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '—';
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return 'همین حالا';
  if (min < 60) return `${toPersianDigits(min)} دقیقه پیش`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${toPersianDigits(hours)} ساعت پیش`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${toPersianDigits(days)} روز پیش`;
  return formatJalaliDate(iso);
}

/** Bytes → "۲٫۴ مگابایت" */
export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes && bytes !== 0) return '—';
  if (bytes < 1024) return `${toPersianDigits(bytes)} بایت`;
  if (bytes < 1024 * 1024) return `${toPersianDigits((bytes / 1024).toFixed(1))} کیلوبایت`;
  return `${toPersianDigits((bytes / (1024 * 1024)).toFixed(1))} مگابایت`;
}
