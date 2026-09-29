'use client';

import { apiClient } from '@/lib/api-client';
import type { RequestDto } from '@caffenet/shared';

/**
 * Operator API (Phase 8) — operator workspace endpoints.
 *  - Dashboard KPIs + take-next (8.2)
 *  - Queue / my-requests list (8.3 / 8.1.3)
 *  - Request detail actions: status, assign, costs, discount (8.4)
 *  - Personal activity + stats (8.5)
 *
 * NOTE: shared endpoints reused from the customer surface
 * (costs / cost-history / attachments / file URLs) live here too so the
 * operator pages have a single, cohesive API module.
 */

// ==================== Types ====================

export interface OperatorDashboardKpis {
  queue: { pending: number; reviewing: number; waitingForCustomer: number };
  assignedToMe: number;
  myActiveRequests: number;
  completedToday: number;
  revenueTodayToman: number;
  unreadChats: number;
}

export interface OperatorActivityItem {
  id: string;
  requestId: string;
  requestUuid?: string;
  trackingCode: string;
  serviceName: string;
  customerName: string;
  status: string;
  note?: string | null;
  active: boolean;
  createdAt: string;
}

export interface OperatorDashboard {
  kpis: OperatorDashboardKpis;
  recentActivity: OperatorActivityItem[];
}

export interface TakeNextResult {
  requestId: string;
  operatorId: string;
  operatorName?: string;
  assignmentId?: string;
  note?: string | null;
  trackingCode: string;
  serviceName: string;
}

export interface OperatorStats {
  totalHandled: number;
  completedTotal: number;
  avgCompletionHours: number | null;
}

export interface OperatorActivityFeedItem {
  id: string;
  requestId: string;
  trackingCode: string;
  serviceName: string;
  customerName: string;
  status: string;
  note?: string | null;
  active: boolean;
  assignedAt: string;
  unassignedAt: string | null;
  completedAt: string | null;
}

export interface OperatorActivity {
  stats: OperatorStats;
  items: OperatorActivityFeedItem[];
}

export interface OperatorRequestsPage {
  items: RequestDto[];
  meta: { page: number; perPage: number; total: number; totalPages: number };
}

export interface AllowedTransitions {
  requestId: string;
  status: string;
  allowed: string[];
}

export interface RequestStatusHistoryRow {
  id: string;
  requestId: string;
  previousStatus: string | null;
  newStatus: string;
  userId: string;
  userName?: string | null;
  note?: string | null;
  createdAt: string;
}

export interface CostBreakdown {
  requestId?: string;
  trackingCode?: string;
  laborFee: number;
  materialCost: number;
  additionalCost: number;
  discountAmount: number;
  finalTotal: number;
  currency?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CostHistoryEntry {
  id: string;
  requestCostId: string;
  requestId: string;
  changeType: string;
  previousAmount: number;
  newAmount: number;
  userId: string;
  reason: string | null;
  createdAt: string;
}

export interface CostHistory {
  requestId: string;
  trackingCode: string;
  entries: CostHistoryEntry[];
}

export interface OperatorAttachment {
  id: string;
  fileId: string;
  originalName?: string;
  mimeType?: string;
  sizeBytes?: number;
  visibility?: string;
  url?: string | null;
  createdAt: string;
}

export interface DiscountValidateResult {
  valid: boolean;
  code?: string;
  message: string;
  discount?: {
    id: string;
    code: string;
    type: string;
    value: number;
    minOrderAmount: number | null;
    maxDiscountAmount: number | null;
  };
  preview?: { subtotal: number; discountAmount: number; finalTotal: number };
}

export interface DiscountApplyResult {
  requestId: string;
  trackingCode?: string;
  discountCode?: string;
  discountAmount?: number;
}

// ==================== API ====================

export const operatorApi = {
  // ---------- 8.2 Dashboard ----------
  dashboard: () => apiClient.get<OperatorDashboard>('/operator/dashboard').then((r) => r.data),

  takeNext: () => apiClient.post<TakeNextResult>('/operator/queue/take-next').then((r) => r.data),

  // ---------- 8.5 Activity ----------
  activity: () => apiClient.get<OperatorActivity>('/operator/activity').then((r) => r.data),

  // ---------- 8.3 / 8.1.3 Lists ----------
  list: (params: {
    scope?: 'mine' | 'all';
    status?: string;
    search?: string;
    serviceId?: number;
    sortDir?: 'asc' | 'desc';
    page?: number;
    perPage?: number;
  }) => apiClient.get<OperatorRequestsPage>('/operator/requests', { params }).then((r) => r.data),

  // ---------- 8.4 Detail ----------
  get: (id: string) => apiClient.get<RequestDto>(`/operator/requests/${id}`).then((r) => r.data),

  allowedTransitions: (id: string) =>
    apiClient
      .get<AllowedTransitions>(`/operator/requests/${id}/allowed-transitions`)
      .then((r) => r.data),

  changeStatus: (id: string, data: { status: string; note?: string }) =>
    apiClient.patch<RequestDto>(`/operator/requests/${id}/status`, data).then((r) => r.data),

  assign: (id: string, data?: { operatorId?: number; note?: string }) =>
    apiClient
      .post<RequestDto | TakeNextResult>(`/operator/requests/${id}/assign`, data ?? {})
      .then((r) => r.data),

  unassign: (id: string, note?: string) =>
    apiClient.post<RequestDto>(`/operator/requests/${id}/unassign`, { note }).then((r) => r.data),

  timeline: (id: string) =>
    apiClient
      .get<import('@caffenet/shared').RequestTimelineEntryDto[]>(
        `/operator/requests/${id}/timeline`,
      )
      .then((r) => r.data),

  history: (id: string) =>
    apiClient
      .get<{ items: RequestStatusHistoryRow[] }>(`/operator/requests/${id}/history`)
      .then((r) => r.data),

  // ---------- Costs (5.2) ----------
  costs: (id: string) => apiClient.get<CostBreakdown>(`/requests/${id}/costs`).then((r) => r.data),

  costHistory: (id: string) =>
    apiClient.get<CostHistory>(`/requests/${id}/cost-history`).then((r) => r.data),

  updateCosts: (id: string, data: { materialCostToman?: number; additionalCostToman?: number }) =>
    apiClient.patch<CostBreakdown>(`/operator/requests/${id}/costs`, data).then((r) => r.data),

  // ---------- Discounts (5.3) ----------
  validateDiscount: (code: string, requestId?: string) =>
    apiClient
      .post<DiscountValidateResult>('/discounts/validate', {
        code: code.trim(),
        requestId: requestId !== undefined ? Number(requestId) : undefined,
      })
      .then((r) => r.data),

  applyDiscount: (code: string, requestId: string) =>
    apiClient
      .post<DiscountApplyResult>('/discounts/apply', {
        code: code.trim(),
        requestId: Number(requestId),
      })
      .then((r) => r.data),

  // ---------- Attachments / files ----------
  attachments: (requestId: string) =>
    apiClient
      .get<{ items: OperatorAttachment[] }>(`/requests/attachments/${requestId}`)
      .then((r) => r.data),

  fileUrl: (fileId: string) =>
    apiClient.get<{ url: string }>(`/files/${fileId}/url`).then((r) => r.data),
};
