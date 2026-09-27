import type { Metadata, Viewport } from 'next';
import { Vazirmatn } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { Toaster } from '@/components/ui/toaster';
import { Providers } from '@/lib/providers';
import './globals.css';

const vazirmatn = Vazirmatn({
  subsets: ['arabic', 'latin'],
  variable: '--font-vazirmatn',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'کافی‌نت — خدمات آنلاین کافی‌نت',
    template: '%s | کافی‌نت',
  },
  description: 'سامانه مدیریت خدمات کافی‌نت — ثبت درخواست، چت real-time، کیف پول و پرداخت آنلاین',
  applicationName: 'کافی‌نت',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'کافی‌نت',
  },
  formatDetection: { telephone: false },
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#16a34a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" className={vazirmatn.variable}>
      <body className="font-sans antialiased bg-gray-50 text-gray-900 min-h-dvh">
        <NextIntlClientProvider locale="fa" messages={{}}>
          <Providers>
            {children}
            <Toaster />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
