import type { DiscountType } from '../enums';

/**
 * Finance-related shared types (Phase 5).
 * Pricing / costs / discounts / invoices — used by API responses and the web app.
 *
 * Money convention (CRITICAL — see types/money.ts):
 *  - DB + internal math: BigInt MINOR units (Rial; Toman × 100) — never float
 *  - DTOs / API responses: Toman (major units) as number
 *  - All final totals computed SERVER-SIDE only
 */

// ==================== COSTS (5.1 / 5.2) ====================

/** One component of a request price snapshot (Toman, major units). */
export interface RequestCostDto {
  requestId: string;
  /** Service labor fee — snapshot taken at request creation */
  laborFee: number;
  /** Operator-registered material cost */
  materialCost: number;
  /** Additional costs (packaging, shipping, …) */
  additionalCost: number;
  /** Applied discount amount (>= 0) */
  discountAmount: number;
  /** Labor + Material + Additional − Discount (>= 0), computed server-side */
  finalTotal: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export type CostChangeType = 'labor' | 'material' | 'additional' | 'discount';

/** Audit trail entry for EVERY cost mutation (5.1.2 / 5.2.5). */
export interface RequestCostHistoryDto {
  id: string;
  requestCostId: string;
  changeType: CostChangeType | string;
  /** Toman (major units) */
  previousAmount: number;
  /** Toman (major units) */
  newAmount: number;
  userId: string;
  userName?: string | null;
  reason?: string | null;
  createdAt: string;
}

/** Payload for PATCH /api/v1/operator/requests/:id/costs (5.2.1). */
export interface RequestPriceChangedPayload {
  requestId: string;
  trackingCode: string;
  previousTotal: number;
  newTotal: number;
  changedBy: string;
  at: string;
}

// ==================== DISCOUNTS (5.3) ====================

export interface DiscountCodeDto {
  id: string;
  uuid: string;
  code: string;
  type: DiscountType | string;
  /** percent → 1..100, fixed → Toman (major units) */
  value: number;
  currency: string;
  minOrderAmount?: number | null;
  maxDiscountAmount?: number | null;
  usageLimit?: number | null;
  usageLimitPerUser?: number | null;
  usedCount: number;
  startsAt: string;
  expiresAt?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDiscountDtoData {
  code: string;
  type: DiscountType | string;
  value: number;
  minOrderAmount?: number | null;
  maxDiscountAmount?: number | null;
  usageLimit?: number | null;
  usageLimitPerUser?: number | null;
  startsAt: string;
  expiresAt?: string | null;
  active?: boolean;
}

export interface DiscountValidationResult {
  valid: boolean;
  /** Machine-readable failure reason (client may map to Persian copy) */
  code?:
    | 'not_found'
    | 'inactive'
    | 'not_started'
    | 'expired'
    | 'usage_limit_reached'
    | 'per_user_limit_reached'
    | 'min_order_not_met'
    | 'already_applied'
    | 'already_used_by_request';
  message: string;
  discount?: DiscountCodeDto;
  /** Preview — Toman (major units), computed server-side */
  preview?: {
    subtotal: number;
    discountAmount: number;
    finalTotal: number;
  };
}

export interface DiscountUsageDto {
  id: string;
  discountId: string;
  requestId: string;
  userId: string;
  /** Toman (major units) */
  amountSaved: number;
  usedAt: string;
}

// ==================== INVOICES (5.4) ====================

export interface InvoiceItemDto {
  id: string;
  /** 'labor' | 'material' | 'additional' | 'discount' */
  type: string;
  description: string;
  /** Toman (major units) — discount lines are negative */
  amount: number;
  createdAt: string;
}

export interface InvoiceDto {
  id: string;
  uuid: string;
  invoiceNumber: string;
  customerId: string;
  customerName?: string | null;
  customerPhone?: string | null;
  requestId: string;
  requestTrackingCode?: string;
  laborFee: number;
  materialCost: number;
  additionalCost: number;
  discountAmount: number;
  finalTotal: number;
  currency: string;
  status: string;
  discountCodeId?: string | null;
  discountCode?: string | null;
  paidAt?: string | null;
  voidedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  items?: InvoiceItemDto[];
}
