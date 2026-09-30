import type { NextConfig } from 'next';
import withPWAInit from 'next-pwa';
import createNextIntlPlugin from 'next-intl/plugin';

// next-intl App Router setup — config file path relative to app root
const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // PWA standalone output for shared hosting deployment
  output: process.env.DEPLOYMENT_PROFILE === 'shared' ? 'standalone' : undefined,
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-dialog'],
  },
  i18n: undefined, // using next-intl App Router approach instead
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
    minimumCacheTTL: 60,
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/push-sw.js',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }],
      },
      {
        source: '/manifest.webmanifest',
        headers: [{ key: 'Content-Type', value: 'application/manifest+json' }],
      },
    ];
  },
};

// PWA configuration (Phase 12.2) — caching strategies per TASKS.md:
//   12.2.2 app shell (navigations): NetworkFirst + offline document fallback
//   12.2.3 static assets:           StaleWhileRevalidate (hashed _next/static)
//   12.2.4 API (public GET):        NetworkFirst + cache fallback
//   12.2.5 images/fonts:            CacheFirst + expiration
//   12.2.6 offline fallback page:   /offline (prerendered)
//   12.2.8/12.2.9 push + click:     push-sw.js (importScripts, Phase 11.4.8)
const withPWA = withPWAInit({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  // Phase 11.4 — Web Push display handlers (imported into the generated SW)
  importScripts: ['/push-sw.js'],
  // 12.2.6 — navigations that miss network AND cache → /offline
  fallbacks: {
    document: '/offline',
  },
  runtimeCaching: [
    // Never intercept the service workers / manifest themselves
    {
      urlPattern: /\/(sw\.js|push-sw\.js|workbox-.*\.js|manifest\.webmanifest)$/,
      handler: 'NetworkOnly',
      options: { cacheName: 'no-cache' },
    },
    // 12.2.5 — images: cache-first with 30d expiration
    {
      urlPattern: /\.(?:png|jpg|jpeg|gif|webp|avif|ico|svg)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'images-cache',
        expiration: { maxEntries: 120, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },
    // 12.2.5 — fonts: cache-first, long-lived
    {
      urlPattern: /\.(?:woff2?|ttf|otf)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'fonts-cache',
        expiration: { maxEntries: 20, maxAgeSeconds: 365 * 24 * 60 * 60 },
      },
    },
    // 12.2.3 — hashed build assets: stale-while-revalidate
    {
      urlPattern: /\/_next\/static\/.*/,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-resources',
        expiration: { maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 },
      },
    },
    // 12.2.4 — public catalog GETs (services/categories): network-first
    {
      urlPattern: /\/api\/v1\/(catalog|services|categories|contact-methods)(\/|$)/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-catalog-cache',
        networkTimeoutSeconds: 5,
        expiration: { maxEntries: 60, maxAgeSeconds: 24 * 60 * 60 },
      },
    },
    // 12.2.2 — app shell navigations: network-first (HTML), offline fallback
    {
      urlPattern: ({ request }: { request: Request }) => request.mode === 'navigate',
      handler: 'NetworkFirst',
      options: {
        cacheName: 'app-shell-cache',
        networkTimeoutSeconds: 5,
        expiration: { maxEntries: 50, maxAgeSeconds: 24 * 60 * 60 },
      },
    },
    // General same-origin fallback (GET only) — keeps recently-seen pages usable
    {
      urlPattern: /^https?.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'offline-cache',
        networkTimeoutSeconds: 8,
        expiration: { maxEntries: 200, maxAgeSeconds: 24 * 60 * 60 },
      },
    },
  ],
});

export default withNextIntl(withPWA(nextConfig));
