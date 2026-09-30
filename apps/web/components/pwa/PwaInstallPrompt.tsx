'use client';

import { Download, Share2, X, PlusSquare } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

/**
 * Custom PWA install prompt (Phase 12.3).
 *
 *  - 12.3.2 captures `beforeinstallprompt` and defers the native prompt.
 *  - 12.3.1 shows a branded bottom card instead of the raw browser dialog.
 *  - 12.3.3 dismissal sets a 7-day cooldown (localStorage).
 *  - 12.3.4 iOS Safari has no install API — shows «Share → Add to Home
 *    Screen» instructions instead.
 *
 * Hidden when: already installed (standalone / display-mode), already
 * installed (appinstalled), cooldown active, or logged-out landing pages.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'pwa_install_dismissed_at';
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 12.3.3 — one week

function isStandalone(): boolean {
  if (typeof window === 'undefined') return true;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  const iosLike = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ masquerades as macOS — detect touch-capable Macs
  const maxTouchPoints =
    (window.navigator as unknown as { maxTouchPoints?: number }).maxTouchPoints ?? 0;
  const iPadOs = /Macintosh/.test(ua) && maxTouchPoints > 1;
  return iosLike || iPadOs;
}

export function PwaInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    // Already installed → never show
    if (isStandalone()) return;

    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) ?? '0');
    const cooling = Boolean(dismissedAt) && Date.now() - dismissedAt < COOLDOWN_MS;
    if (cooling) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault(); // take over the native prompt (12.3.2)
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => {
      setVisible(false);
      setShowIosGuide(false);
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    // iOS: no beforeinstallprompt — show the manual guide on a slower delay
    let iosTimer: ReturnType<typeof setTimeout> | null = null;
    if (isIos() && !isStandalone()) {
      iosTimer = setTimeout(() => {
        if (!localStorage.getItem(DISMISS_KEY)) {
          setShowIosGuide(true);
          setVisible(true);
        }
      }, 4000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
      if (iosTimer) clearTimeout(iosTimer);
    };
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === 'accepted') {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    }
    setDeferred(null);
    setVisible(false);
  }, [deferred]);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-20 z-40 mx-auto w-[min(92%,26rem)] md:bottom-6">
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-lg shadow-black/10">
        <div className="flex items-start gap-3">
          {/* App icon */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-192.png"
            alt=""
            className="h-12 w-12 shrink-0 rounded-xl"
            width={48}
            height={48}
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold text-gray-900">نصب اپلیکیشن کافی‌نت</p>
            {showIosGuide ? (
              <div className="mt-1.5 space-y-1.5 text-xs leading-5 text-gray-600">
                <p className="flex items-center gap-1.5">
                  <Share2 className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                  روی دکمه «اشتراک‌گذاری» در سافاری بزنید
                </p>
                <p className="flex items-center gap-1.5">
                  <PlusSquare className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                  گزینه «Add to Home Screen» را انتخاب کنید
                </p>
                <p className="flex items-center gap-1.5">
                  <Download className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                  سپس «Add» را بزنید — اپ مثل بقیه اپ‌ها نصب می‌شود
                </p>
              </div>
            ) : (
              <p className="mt-1 text-xs leading-5 text-gray-500">
                با نصب اپ، به ثبت درخواست، چت و کیف پول سریع‌تر و حتی بدون اینترنت (صفحات دیده‌شده)
                دسترسی دارید.
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label="بستن"
            onClick={dismiss}
            className="shrink-0 rounded-lg p-1 text-gray-400 hover:bg-gray-50 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!showIosGuide && (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={install}
              className="bg-brand-500 hover:bg-brand-600 inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold text-white"
            >
              <Download className="h-4 w-4" />
              نصب
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="inline-flex items-center justify-center rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-50"
            >
              بعداً
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
