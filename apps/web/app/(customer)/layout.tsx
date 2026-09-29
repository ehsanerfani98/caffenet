'use client';

import { BottomSheet } from '@/components/common/BottomSheet';
import { PrivateGuard } from '@/components/common/guards';

/**
 * Customer layout (7.2) — guarded shell with bottom navigation
 * and the globally-mounted bottom sheet.
 */
export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <PrivateGuard>
      <main className="container-mobile pb-bottom-nav min-h-dvh">{children}</main>
      <BottomSheet />
    </PrivateGuard>
  );
}
