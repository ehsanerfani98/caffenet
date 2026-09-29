'use client';

import { apiClient } from '@/lib/api-client';
import type { RequestDto, RequestTimelineEntryDto } from '@caffenet/shared';

/**
 * Admin API (Phase 9) — endpoints of modules/admin + admin variants of
 * catalog/discounts/requests controllers. All amounts are Toman (major units).
 */

// ==================== Shared shapes ====================

export interface PageMeta {
  page: number;
  perPage?: number;
  limit?: number;
  total: number;
  totalPages: number;
}

export interface RoleDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

export interface AdminUserDto {
  id: string;
  uuid: string;
  phone: string;
  email: string | null;
  fullName: string | null;
  status: string;
  preferredLocale: string;
  lastLoginAt: string | null;
  createdAt: string;
  roles: RoleDto[];
}

export interface AdminUsersPage {
  items: AdminUserDto[];
  meta: PageMeta;
}

export interface AdminUserDetail {
  user: AdminUserDto;
  requestStats: Record<string, number>;
  wallet: { balanceToman: number; status: string } | null;
  activeSessions: number;
}

export interface OperatorDto extends AdminUserDto {
  stats: {
    currentlyAssigned: number;
    completedTotal: number;
    avgCompletionHours: number | null;
  };
}

export interface AdminRoleDto {
  id: string;
  uuid: string;
  name: string;
  slug: string;
  description: string | null;
  isSystem: boolean;
  usersCount: number;
  permissions: string[];
}

export interface PermissionDto {
  id: string;
  slug: string;
  name: string;
  description: string | null;
}

export interface PermissionGroupDto {
  group: string;
  permissions: PermissionDto[];
}

export interface ContactMethodDto {
  id: string;
  uuid: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  active: boolean;
  sortOrder: number;
  isSystem: boolean;
}

export interface SettingEntryDto {
  key: string;
  type: string;
  isSecret: boolean;
  description: string | null;
  updatedAt: string | null;
  value: string | null;
  valueJson: unknown;
  hasValue: boolean;
}

export type SettingsSections = Record<string, SettingEntryDto[]>;

export interface WalletRowDto {
  id: string;
  userId: string;
  userUuid: string;
  phone: string;
  fullName: string | null;
  userStatus: string;
  balanceToman: number;
  status: string;
}

export interface AdminPaymentDto {
  id: string;
  uuid: string;
  userPhone: string;
  userFullName: string | null;
  amountToman: number;
  gateway: string;
  status: string;
  referenceNumber: string | null;
  paidAt: string | null;
  refundedAt: string | null;
  createdAt: string;
}

export interface DiscountDto {
  id: string;
  uuid: string;
  code: string;
  type: 'percent' | 'fixed' | string;
  value: number;
  currency: string;
  minOrderAmount: number | null;
  maxDiscountAmount: number | null;
  usageLimit: number | null;
  usageLimitPerUser: number | null;
  usedCount: number;
  startsAt: string;
  expiresAt: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DiscountUsageDto {
  id: string;
  discountId: string;
  requestId: string;
  userId: string;
  amountSaved: number;
  usedAt: string;
}

export interface BroadcastItemDto {
  id: string;
  title: string;
  audience: string;
  recipients: number;
  actorName: string;
  createdAt: string;
}

export interface AuditLogItemDto {
  id: string;
  uuid?: string;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
  createdAt: string;
  user: { id: string; phone: string; fullName: string | null; uuid: string } | null;
}

export interface CategoryDto {
  id: string;
  uuid: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  imageUrl: string | null;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  servicesCount?: number;
}

export interface ServiceDto {
  id: string;
  uuid: string;
  categoryId: string;
  category?: { id: string; name: string; slug: string; icon: string | null } | null;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  icon: string | null;
  /** Toman */
  laborFee: number;
  /** Toman */
  defaultMaterialCost: number;
  /** Toman */
  minMaterialCost: number;
  /** Toman | null */
  maxMaterialCost: number | null;
  estimatedDurationMin: number | null;
  active: boolean;
  requiresFile: boolean;
  requiresCustomerInfo: boolean;
  fieldsCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceFieldOptionDto {
  value: string;
  label: string;
  isDefault?: boolean;
}

export interface ServiceFieldDto {
  id: string;
  uuid: string;
  label: string;
  name: string;
  type: string;
  placeholder: string | null;
  helpText: string | null;
  required: boolean;
  validationRules?: Array<{
    type: string;
    params?: Record<string, unknown>;
    message?: string;
  }> | null;
  defaultValue: string | null;
  sortOrder: number;
  options: ServiceFieldOptionDto[] | null;
  active: boolean;
}

// ==================== Dashboard (9.2) ====================

export interface DashboardData {
  kpis: {
    requestsNew: number;
    requestsActive: number;
    requestsCompleted: number;
    requestsCancelled: number;
    byStatus: Record<string, number>;
    revenueTodayToman: number;
    walletTransactionsToday: number;
    paymentsToday: number;
    usersTotal: number;
    customers: number;
    operators: number;
    servicesTotal: number;
    categoriesTotal: number;
    unreadChats: number;
  };
  recentActivity: Array<{
    id: string;
    action: string;
    entity: string;
    entityId: string | null;
    actorName: string;
    createdAt: string;
    metadata?: Record<string, unknown>;
  }>;
}

export interface DashboardCharts {
  revenue: {
    granularity: 'day' | 'month' | string;
    series: Array<{ bucket: string; revenueToman: number }>;
  };
  byStatus: Array<{ status: string; count: number }>;
  topServices: Array<{
    serviceId: string;
    serviceName: string;
    requests: number;
    revenueToman: number;
  }>;
  payments: { byStatus: Record<string, number>; successRate: number | null; total: number };
}

export const adminDashboardApi = {
  get: () => apiClient.get<DashboardData>('/admin/dashboard').then((r) => r.data),
  charts: (params: { from?: string; to?: string; granularity?: 'day' | 'month' }) =>
    apiClient.get<DashboardCharts>('/admin/dashboard/charts', { params }).then((r) => r.data),
};

// ==================== Users (9.3) ====================

export const adminUsersApi = {
  list: (params: {
    page?: number;
    perPage?: number;
    search?: string;
    role?: string;
    status?: string;
  }) => apiClient.get<AdminUsersPage>('/admin/users', { params }).then((r) => r.data),

  detail: (id: string) => apiClient.get<AdminUserDetail>(`/admin/users/${id}`).then((r) => r.data),

  update: (id: string, data: { fullName?: string; email?: string; status?: string }) =>
    apiClient.patch<AdminUserDto>(`/admin/users/${id}`, data).then((r) => r.data),

  assignRole: (id: string, roleId: string) =>
    apiClient.post<{ ok: boolean }>(`/admin/users/${id}/roles`, { roleId }).then((r) => r.data),

  revokeRole: (id: string, roleId: string) =>
    apiClient.delete<{ ok: boolean }>(`/admin/users/${id}/roles/${roleId}`).then((r) => r.data),

  resetPassword: (id: string, newPassword: string) =>
    apiClient
      .post<{ ok: boolean }>(`/admin/users/${id}/reset-password`, { newPassword })
      .then((r) => r.data),
};

// ==================== Operators (9.4) ====================

export interface OperatorsPage {
  items: OperatorDto[];
  meta: PageMeta;
}

export const adminOperatorsApi = {
  list: (params: { search?: string; status?: string; page?: number }) =>
    apiClient.get<OperatorsPage>('/admin/operators', { params }).then((r) => r.data),

  create: (data: { phone: string; password: string; fullName?: string; email?: string }) =>
    apiClient.post<AdminUserDto>('/admin/operators', data).then((r) => r.data),

  setStatus: (id: string, status: 'active' | 'suspended') =>
    apiClient
      .patch<{ ok: boolean }>(`/admin/operators/${id}/status`, { status })
      .then((r) => r.data),
};

// ==================== Roles & permissions (9.5) ====================

export const adminRolesApi = {
  list: () => apiClient.get<AdminRoleDto[]>('/admin/roles').then((r) => r.data),

  permissions: () =>
    apiClient.get<PermissionGroupDto[]>('/admin/roles/permissions').then((r) => r.data),

  create: (data: { name: string; slug: string; description?: string; permissionSlugs: string[] }) =>
    apiClient.post<{ ok: boolean; id: string }>('/admin/roles', data).then((r) => r.data),

  updatePermissions: (id: string, permissionSlugs: string[]) =>
    apiClient
      .patch<{ ok: boolean }>(`/admin/roles/${id}/permissions`, { permissionSlugs })
      .then((r) => r.data),

  remove: (id: string) =>
    apiClient.delete<{ ok: boolean }>(`/admin/roles/${id}`).then((r) => r.data),
};

// ==================== Contact methods (9.9.1) ====================

export const adminContactMethodsApi = {
  list: () => apiClient.get<ContactMethodDto[]>('/admin/contact-methods').then((r) => r.data),

  create: (data: {
    name: string;
    slug: string;
    description?: string;
    icon?: string;
    active?: boolean;
    sortOrder?: number;
  }) =>
    apiClient.post<{ ok: boolean; id: string }>('/admin/contact-methods', data).then((r) => r.data),

  update: (
    id: string,
    data: {
      name?: string;
      description?: string;
      icon?: string;
      active?: boolean;
      sortOrder?: number;
    },
  ) =>
    apiClient
      .patch<{ ok: boolean; id: string }>(`/admin/contact-methods/${id}`, data)
      .then((r) => r.data),

  reorder: (orderedIds: string[]) =>
    apiClient
      .patch<{ ok: boolean }>('/admin/contact-methods/reorder', { orderedIds })
      .then((r) => r.data),
};

// ==================== Settings (9.12) ====================

export const adminSettingsApi = {
  get: () => apiClient.get<SettingsSections>('/admin/settings').then((r) => r.data),

  update: (entries: Array<{ key: string; value?: string; valueJson?: unknown }>) =>
    apiClient.patch<{ ok: boolean }>('/admin/settings', { entries }).then((r) => r.data),
};

// ==================== Wallets / payments / refund (9.8) ====================

export const adminWalletApi = {
  wallets: (params: { search?: string; page?: number; perPage?: number }) =>
    apiClient
      .get<{ items: WalletRowDto[]; meta: PageMeta }>('/admin/wallets', { params })
      .then((r) => r.data),

  payments: (params: { status?: string; gateway?: string; page?: number; perPage?: number }) =>
    apiClient
      .get<{ items: AdminPaymentDto[]; meta: PageMeta }>('/admin/payments', { params })
      .then((r) => r.data),

  /** 9.8.3 — refund a successful gateway payment into the customer's wallet */
  refund: (paymentId: string, data: { amountToman?: number; reason: string }) =>
    apiClient
      .post<{ ok: boolean; amountToman: number; full: boolean }>(
        `/admin/payments/${paymentId}/refund`,
        data,
      )
      .then((r) => r.data),
};

/** 9.8.5 — manual balance adjustment (lives in the wallet module, admin-gated). */
export function adjustUserWallet(
  userId: string,
  data: { amountToman: number; reason: string },
): Promise<Record<string, unknown>> {
  return apiClient.post(`/wallet/users/${userId}/adjust`, data).then((r) => r.data);
}

// ==================== Reports (9.10) ====================

export interface FinancialReportDto {
  from: string;
  to: string;
  revenueToman: number;
  laborToman: number;
  paidRequests: number;
  discountsToman: number;
  discountsCount: number;
  refundsToman: number;
  refundsCount: number;
}

export interface ServiceReportRowDto {
  serviceId: string;
  serviceName: string;
  categoryName: string;
  requests: number;
  avgDurationMin: number | null;
  revenueToman: number;
}

export interface WalletReportRowDto {
  type: string;
  count: number;
  netToman: number;
}

export const adminReportsApi = {
  financial: (params: { from?: string; to?: string }) =>
    apiClient.get<FinancialReportDto>('/admin/reports/financial', { params }).then((r) => r.data),

  services: (params: { from?: string; to?: string }) =>
    apiClient.get<ServiceReportRowDto[]>('/admin/reports/services', { params }).then((r) => r.data),

  wallet: (params: { from?: string; to?: string }) =>
    apiClient.get<WalletReportRowDto[]>('/admin/reports/wallet', { params }).then((r) => r.data),

  payments: (params: { from?: string; to?: string }) =>
    apiClient
      .get<DashboardCharts['payments']>('/admin/reports/payments', { params })
      .then((r) => r.data),
};

// ==================== Audit logs (9.11) ====================

export interface AuditLogsPage {
  items: AuditLogItemDto[];
  meta: PageMeta;
}

export const adminAuditApi = {
  list: (params: {
    userId?: string;
    action?: string;
    entity?: string;
    entityId?: string;
    from?: string;
    to?: string;
    page?: number;
    perPage?: number;
  }) => apiClient.get<AuditLogsPage>('/admin/audit-logs', { params }).then((r) => r.data),
};

// ==================== Broadcast notifications (9.9.2–9.9.3) ====================

export const adminNotificationsApi = {
  broadcast: (data: {
    title: string;
    body?: string;
    audience: 'all' | 'customers' | 'operators';
    type?: string;
  }) =>
    apiClient
      .post<{ ok: boolean; recipients: number }>('/admin/notifications/broadcast', data)
      .then((r) => r.data),

  history: (params: { page?: number; perPage?: number }) =>
    apiClient
      .get<{ items: BroadcastItemDto[]; meta: PageMeta }>('/admin/notifications/broadcasts', {
        params,
      })
      .then((r) => r.data),
};

// ==================== Catalog — categories (9.6.1) ====================

export const adminCategoriesApi = {
  list: (params?: { page?: number; perPage?: number; active?: string; search?: string }) =>
    apiClient
      .get<{ items: CategoryDto[]; meta: PageMeta }>('/admin/categories', { params })
      .then((r) => r.data),

  create: (data: {
    name: string;
    slug?: string;
    description?: string;
    icon?: string;
    sortOrder?: number;
    active?: boolean;
  }) => apiClient.post<CategoryDto>('/admin/categories', data).then((r) => r.data),

  update: (
    id: string,
    data: { name?: string; description?: string; icon?: string; active?: boolean },
  ) => apiClient.patch<CategoryDto>(`/admin/categories/${id}`, data).then((r) => r.data),

  reorder: (items: Array<{ id: string; sortOrder: number }>) =>
    apiClient.patch<{ ok: boolean }>('/admin/categories/reorder', { items }).then((r) => r.data),

  remove: (id: string) =>
    apiClient.delete<{ ok: boolean }>(`/admin/categories/${id}`).then((r) => r.data),
};

// ==================== Catalog — services (9.6.2–9.6.5) ====================

export const adminServicesApi = {
  list: (params?: {
    page?: number;
    perPage?: number;
    search?: string;
    categoryId?: number;
    active?: string;
  }) =>
    apiClient
      .get<{ items: ServiceDto[]; meta: PageMeta }>('/admin/services', { params })
      .then((r) => r.data),

  get: (id: string) =>
    apiClient
      .get<ServiceDto & { fields?: ServiceFieldDto[] }>(`/admin/services/${id}`)
      .then((r) => r.data),

  create: (data: {
    name: string;
    categoryId: number;
    laborFee: number;
    slug?: string;
    description?: string;
    icon?: string;
    defaultMaterialCost?: number;
    minMaterialCost?: number;
    maxMaterialCost?: number;
    estimatedDurationMin?: number;
    active?: boolean;
    requiresFile?: boolean;
    requiresCustomerInfo?: boolean;
  }) => apiClient.post<ServiceDto>('/admin/services', data).then((r) => r.data),

  update: (
    id: string,
    data: {
      name?: string;
      categoryId?: number;
      laborFee?: number;
      description?: string;
      icon?: string;
      defaultMaterialCost?: number;
      minMaterialCost?: number;
      maxMaterialCost?: number;
      estimatedDurationMin?: number;
      active?: boolean;
      requiresFile?: boolean;
      requiresCustomerInfo?: boolean;
    },
  ) => apiClient.patch<ServiceDto>(`/admin/services/${id}`, data).then((r) => r.data),

  remove: (id: string) =>
    apiClient.delete<{ ok: boolean }>(`/admin/services/${id}`).then((r) => r.data),

  // ---- Form builder (9.6.3) ----
  fields: (serviceId: string) =>
    apiClient.get<ServiceFieldDto[]>(`/admin/services/${serviceId}/fields`).then((r) => r.data),

  addField: (
    serviceId: string,
    data: {
      name: string;
      label: string;
      type: string;
      placeholder?: string;
      helpText?: string;
      required?: boolean;
      defaultValue?: string;
      sortOrder?: number;
      options?: ServiceFieldOptionDto[];
      active?: boolean;
    },
  ) =>
    apiClient
      .post<ServiceFieldDto>(`/admin/services/${serviceId}/fields`, data)
      .then((r) => r.data),

  updateField: (
    serviceId: string,
    fieldId: string,
    data: {
      label?: string;
      placeholder?: string;
      helpText?: string;
      required?: boolean;
      defaultValue?: string;
      sortOrder?: number;
      options?: ServiceFieldOptionDto[];
      active?: boolean;
    },
  ) =>
    apiClient
      .patch<ServiceFieldDto>(`/admin/services/${serviceId}/fields/${fieldId}`, data)
      .then((r) => r.data),

  deleteField: (serviceId: string, fieldId: string) =>
    apiClient
      .delete<{ ok: boolean }>(`/admin/services/${serviceId}/fields/${fieldId}`)
      .then((r) => r.data),

  reorderFields: (serviceId: string, items: Array<{ id: string; sortOrder: number }>) =>
    apiClient
      .patch<{ ok: boolean }>(`/admin/services/${serviceId}/fields/reorder`, { items })
      .then((r) => r.data),
};

// ==================== Discounts admin (9.8.6–9.8.7) ====================

export const adminDiscountsApi = {
  list: (params: {
    page?: number;
    perPage?: number;
    active?: 'all' | 'active' | 'inactive';
    search?: string;
  }) =>
    apiClient
      .get<{ items: DiscountDto[]; meta: PageMeta }>('/admin/discounts', { params })
      .then((r) => r.data),

  usages: (id: string) =>
    apiClient
      .get<{ discount: DiscountDto; usages: DiscountUsageDto[] }>(`/admin/discounts/${id}/usages`)
      .then((r) => r.data),

  create: (data: {
    code: string;
    type: 'percent' | 'fixed';
    valueToman: number;
    minOrderAmountToman?: number;
    maxDiscountAmountToman?: number;
    usageLimit?: number;
    usageLimitPerUser?: number;
    startsAt: string;
    expiresAt?: string;
    active?: boolean;
  }) => apiClient.post<DiscountDto>('/admin/discounts', data).then((r) => r.data),

  update: (
    id: string,
    data: {
      active?: boolean;
      valueToman?: number;
      minOrderAmountToman?: number;
      maxDiscountAmountToman?: number;
      usageLimit?: number;
      usageLimitPerUser?: number;
      expiresAt?: string;
    },
  ) => apiClient.patch<DiscountDto>(`/admin/discounts/${id}`, data).then((r) => r.data),

  remove: (id: string) =>
    apiClient.delete<{ ok: boolean }>(`/admin/discounts/${id}`).then((r) => r.data),
};

// ==================== Requests admin (9.7) ====================

export interface AdminRequestsPage {
  items: RequestDto[];
  meta: PageMeta;
}

export const adminRequestsApi = {
  list: (params: { status?: string; search?: string; page?: number; perPage?: number }) =>
    apiClient.get<AdminRequestsPage>('/admin/requests', { params }).then((r) => r.data),

  get: (id: string) => apiClient.get<RequestDto>(`/admin/requests/${id}`).then((r) => r.data),

  timeline: (id: string) =>
    apiClient.get<RequestTimelineEntryDto[]>(`/admin/requests/${id}/timeline`).then((r) => r.data),

  history: (id: string) =>
    apiClient
      .get<{ items: Array<Record<string, unknown>> }>(`/admin/requests/${id}/history`)
      .then((r) => r.data),

  changeStatus: (id: string, data: { status: string; note?: string }) =>
    apiClient.patch<RequestDto>(`/admin/requests/${id}/status`, data).then((r) => r.data),

  assign: (id: string, operatorId?: string) =>
    apiClient
      .post<RequestDto>(`/admin/requests/${id}/assign`, operatorId ? { operatorId } : {})
      .then((r) => r.data),

  unassign: (id: string, note?: string) =>
    apiClient.post<RequestDto>(`/admin/requests/${id}/unassign`, { note }).then((r) => r.data),

  cancel: (id: string, reason?: string) =>
    apiClient.patch<RequestDto>(`/admin/requests/${id}/cancel`, { reason }).then((r) => r.data),

  removeDiscount: (id: string) =>
    apiClient.post<RequestDto>(`/admin/requests/${id}/remove-discount`, {}).then((r) => r.data),
};
