import type { QueryClient } from '@tanstack/react-query';

/**
 * Shared query-key helpers for the operator workspace.
 * Keeps invalidation consistent across StatusChanger / CostEditor /
 * DiscountApplier and the detail page.
 */

export const OPERATOR_KEYS = {
  dashboard: ['operator', 'dashboard'] as const,
  activity: ['operator', 'activity'] as const,
  lists: ['operator', 'requests'] as const,
  request: (id: string) => ['operator', 'request', id] as const,
  transitions: (id: string) => ['operator', 'request-transitions', id] as const,
  timeline: (id: string) => ['operator', 'request-timeline', id] as const,
  history: (id: string) => ['operator', 'request-history', id] as const,
  costs: (id: string) => ['operator', 'request-costs', id] as const,
  costHistory: (id: string) => ['operator', 'request-cost-history', id] as const,
  attachments: (id: string) => ['operator', 'attachments', id] as const,
};

/**
 * Invalidate everything affected by a request-level mutation
 * (status change / assign / unassign / complete).
 */
export function invalidateRequestCache(queryClient: QueryClient, requestId: string): void {
  void queryClient.invalidateQueries({ queryKey: OPERATOR_KEYS.request(requestId) });
  void queryClient.invalidateQueries({ queryKey: OPERATOR_KEYS.transitions(requestId) });
  void queryClient.invalidateQueries({ queryKey: OPERATOR_KEYS.timeline(requestId) });
  void queryClient.invalidateQueries({ queryKey: OPERATOR_KEYS.history(requestId) });
  void queryClient.invalidateQueries({ queryKey: OPERATOR_KEYS.lists });
  void queryClient.invalidateQueries({ queryKey: OPERATOR_KEYS.dashboard });
  void queryClient.invalidateQueries({ queryKey: OPERATOR_KEYS.activity });
}
