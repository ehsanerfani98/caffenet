import type { Metadata } from 'next';
import { BottomNavigation } from '@/components/common/BottomNavigation';

export const metadata: Metadata = {
  title: { default: 'کافی‌نت', template: '%s | کافی‌نت' },
};

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className="container-mobile pb-bottom-nav min-h-dvh">{children}</main>
      <BottomNavigation />
    </>
  );
}
