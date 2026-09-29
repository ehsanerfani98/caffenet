import { Wifi } from 'lucide-react';

/**
 * Auth layout (7.3) — centered mobile shell without bottom navigation.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="safe-area-top flex min-h-dvh flex-col bg-gray-50">
      <div className="container-mobile flex flex-1 flex-col justify-center py-10">
        {/* Brand */}
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="bg-brand-600 shadow-brand-600/20 flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg">
            <Wifi className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-extrabold text-gray-900">کافی‌نت</h1>
          <p className="text-xs text-gray-500">سامانه خدمات آنلاین کافی‌نت</p>
        </div>
        {children}
      </div>
    </div>
  );
}
