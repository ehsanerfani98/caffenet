import type { MetadataRoute } from 'next';

/**
 * Dynamic PWA manifest (Phase 12.1.1 / 12.1.4) — presentation values come
 * from the DATABASE settings via `GET /api/v1/settings/public`
 * (Admin → تنظیمات سایت → عمومی / PWA), with static fallbacks when the API
 * is unreachable (build-time / offline).
 *
 * The static public/manifest.webmanifest was removed in favour of this
 * route so admins can rebrand the installed app without a redeploy.
 */

export const dynamic = 'force-dynamic';

const FALLBACK = {
  name: 'کافی‌نت — سامانه خدمات آنلاین',
  shortName: 'کافی‌نت',
  description: 'سامانه مدیریت خدمات کافی‌نت — ثبت درخواست، چت real-time، کیف پول و پرداخت آنلاین',
  themeColor: '#16a34a',
  backgroundColor: '#ffffff',
};

async function loadSettings() {
  const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');
  if (!apiBase) return null;
  try {
    const res = await fetch(`${apiBase}/settings/public`, {
      cache: 'no-store',
      // next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return (await res.json()) as {
      system?: { nameFa?: string; description?: string };
      pwa?: {
        name?: string;
        shortName?: string;
        themeColor?: string;
        backgroundColor?: string;
        icon192?: string;
        icon512?: string;
      };
    };
  } catch {
    return null;
  }
}

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const s = await loadSettings();
  const name = s?.pwa?.name || FALLBACK.name;
  const shortName = s?.pwa?.shortName || FALLBACK.shortName;
  const description = s?.system?.description || FALLBACK.description;
  const themeColor = s?.pwa?.themeColor || FALLBACK.themeColor;
  const backgroundColor = s?.pwa?.backgroundColor || FALLBACK.backgroundColor;
  const icon192 = s?.pwa?.icon192 || '/icons/icon-192.png';
  const icon512 = s?.pwa?.icon512 || '/icons/icon-512.png';

  return {
    name,
    short_name: shortName,
    description,
    lang: 'fa',
    dir: 'rtl',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    theme_color: themeColor,
    background_color: backgroundColor,
    categories: ['business', 'productivity', 'finance'],
    icons: [
      { src: icon192, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-256.png', sizes: '256x256', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-384.png', sizes: '384x384', type: 'image/png', purpose: 'any' },
      { src: icon512, sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-192-maskable.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    // 12.1.4 — app shortcuts (Home is implicit via start_url)
    shortcuts: [
      {
        name: 'درخواست‌های من',
        short_name: 'درخواست‌ها',
        url: '/requests',
        icons: [{ src: icon192, sizes: '192x192' }],
      },
      {
        name: 'کیف پول',
        short_name: 'کیف پول',
        url: '/wallet',
        icons: [{ src: icon192, sizes: '192x192' }],
      },
      {
        name: 'چت',
        short_name: 'چت',
        url: '/chat',
        icons: [{ src: icon192, sizes: '192x192' }],
      },
    ],
  };
}
