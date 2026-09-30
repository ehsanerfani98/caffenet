'use client';

import { WifiOff, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

/**
 * Offline fallback page (Phase 12.2.6) — served by the service worker for
 * navigations that fail (Workbox `fallbacks.document`). Prerendered as a
 * static page so the SW precaches it at install time.
 */
export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-gray-50 px-6 text-center">
      <div className="bg-brand-50 flex h-20 w-20 items-center justify-center rounded-3xl">
        <WifiOff className="text-brand-600 h-10 w-10" />
      </div>

      <h1 className="mt-6 text-xl font-extrabold text-gray-900">اتصال اینترنت قطع است</h1>
      <p className="mt-3 max-w-xs text-sm leading-6 text-gray-500">
        در حال حاضر نمی‌توانیم به سرور متصل شویم. صفحات قبلاً دیده‌شده و پیام‌های ارسال‌نشده چت، پس
        از وصل‌شدن دوباره اینترنت به‌صورت خودکار همگام‌سازی می‌شوند.
      </p>

      <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="bg-brand-500 hover:bg-brand-600 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white"
        >
          <RefreshCw className="h-4 w-4" />
          تلاش مجدد
        </button>
        <Link
          href="/"
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50"
        >
          <Home className="h-4 w-4" />
          بازگشت به خانه
        </Link>
      </div>
    </div>
  );
}
