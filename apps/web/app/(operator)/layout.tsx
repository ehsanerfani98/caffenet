'use client';

import { BottomSheet } from '@/components/common/BottomSheet';
import { OperatorShell } from '@/components/operator/OperatorShell';
import { PrivateGuard, RoleGuard } from '@/components/common/guards';

/**
 * Operator route group layout (8.1) — auth + role guards wrapped by the
 * operator console shell (sidebar / bottom nav / top bar).
 * The globally-controlled bottom sheet is mounted for confirm dialogs.
 */
export default function OperatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <PrivateGuard>
      <RoleGuard allow={['operator', 'admin']}>
        <OperatorShell>{children}</OperatorShell>
        <BottomSheet />
      </RoleGuard>
    </PrivateGuard>
  );
}
