'use client';

import { PrivateGuard, RoleGuard } from '@/components/common/guards';
import { AdminShell } from '@/components/admin/AdminShell';

/**
 * (admin) route group layout (9.1) — auth + role gated shell.
 * URLs under this group: /admin/*
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <PrivateGuard>
      <RoleGuard allow={['admin']}>
        <AdminShell>{children}</AdminShell>
      </RoleGuard>
    </PrivateGuard>
  );
}
