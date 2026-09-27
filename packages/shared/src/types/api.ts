/**
 * Standard API response envelope shared between backend & frontend.
 */

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ApiMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown> | Array<Record<string, unknown>>;
}

export interface ApiMeta {
  requestId: string;
  timestamp: string;
  page?: number;
  perPage?: number;
  total?: number;
  totalPages?: number;
  cursor?: string;
}

export interface PaginatedData<T> {
  items: T[];
  meta: Required<Pick<ApiMeta, 'page' | 'perPage' | 'total' | 'totalPages'>>;
}

export interface CursorPaginatedData<T> {
  items: T[];
  meta: { nextCursor: string | null; hasMore: boolean };
}

// Standard error codes
export const ERROR_CODES = {
  // 400 Bad Request
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_REQUEST: 'INVALID_REQUEST',
  // 401 Unauthorized
  UNAUTHORIZED: 'UNAUTHORIZED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  // 403 Forbidden
  FORBIDDEN: 'FORBIDDEN',
  INSUFFICIENT_PERMISSION: 'INSUFFICIENT_PERMISSION',
  // 404 Not Found
  NOT_FOUND: 'NOT_FOUND',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  // 409 Conflict
  CONFLICT: 'CONFLICT',
  DUPLICATE_RESOURCE: 'DUPLICATE_RESOURCE',
  // 422 Unprocessable
  BUSINESS_RULE_VIOLATION: 'BUSINESS_RULE_VIOLATION',
  WALLET_INSUFFICIENT_BALANCE: 'WALLET_INSUFFICIENT_BALANCE',
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
  DISCOUNT_EXPIRED: 'DISCOUNT_EXPIRED',
  DISCOUNT_USAGE_LIMIT_REACHED: 'DISCOUNT_USAGE_LIMIT_REACHED',
  // 429 Too Many
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  OTP_RATE_LIMIT_EXCEEDED: 'OTP_RATE_LIMIT_EXCEEDED',
  // 500 Server
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  PAYMENT_GATEWAY_ERROR: 'PAYMENT_GATEWAY_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
