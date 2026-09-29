'use client';

/**
 * Role-aware destination helper (Phase 8/9).
 * After login (and on '/'), operators land on the operator dashboard and
 * admins on the admin dashboard; customers stay in the customer app.
 */

export function roleHome(roles: string[] | undefined | null): string {
  const rs = roles ?? [];
  if (rs.includes('admin')) return '/admin';
  if (rs.includes('operator')) return '/operator';
  return '/home';
}

/** Returns `next` when explicitly provided, else the role-aware home. */
export function destinationFor(roles: string[] | undefined | null, next?: string | null): string {
  return next && next.startsWith('/') ? next : roleHome(roles);
}
