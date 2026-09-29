'use client';

import { apiClient } from '@/lib/api-client';
import type { PaginatedData } from '@caffenet/shared';

/**
 * Catalog API (7.5) — categories + services (public endpoints).
 * Shapes mirror apps/api/src/modules/{categories,services} serializers.
 */

export interface CategoryDto {
  id: string;
  uuid: string;
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  image?: string | null;
  sortOrder: number;
  active: boolean;
  servicesCount?: number;
}

export interface ServiceFieldDto {
  id: string;
  uuid: string;
  label: string;
  name: string;
  type: string;
  placeholder?: string | null;
  helpText?: string | null;
  required: boolean;
  validationRules?: Array<{
    type: string;
    params?: Record<string, unknown>;
    message?: string;
  }>;
  defaultValue?: string | null;
  sortOrder: number;
  options?: Array<{ value: string; label: string; isDefault?: boolean }> | null;
  active: boolean;
}

export interface ServiceDto {
  id: string;
  uuid: string;
  categoryId: string;
  category?: { id: string; name: string; slug: string; icon?: string | null };
  name: string;
  slug: string;
  description?: string | null;
  image?: string | null;
  icon?: string | null;
  /** Toman (major units) */
  laborFee: number;
  defaultMaterialCost: number;
  minMaterialCost?: number | null;
  maxMaterialCost?: number | null;
  estimatedDurationMin?: number | null;
  active: boolean;
  requiresFile: boolean;
  requiresCustomerInfo: boolean;
  currency: string;
  fieldsCount?: number;
  fields?: ServiceFieldDto[];
}

export const catalogApi = {
  categories: () =>
    apiClient
      .get<CategoryDto[] | { items: CategoryDto[] }>('/categories')
      .then((r) => (Array.isArray(r.data) ? r.data : (r.data.items ?? []))),

  category: (slug: string) => apiClient.get<CategoryDto>(`/categories/${slug}`).then((r) => r.data),

  services: (params: { page?: number; limit?: number; category?: string; search?: string }) =>
    apiClient.get<PaginatedData<ServiceDto>>('/services', { params }).then((r) => r.data),

  service: (slug: string) => apiClient.get<ServiceDto>(`/services/${slug}`).then((r) => r.data),
};
