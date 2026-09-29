/**
 * System-wide constants shared between API, Web, and Worker.
 */

export const SYSTEM_CONFIG = {
  SYSTEM_NAME: 'Caffenet',
  SYSTEM_NAME_FA: 'کافی‌نت',
  DEFAULT_CURRENCY: 'IRT', // Toman
  DEFAULT_LOCALE: 'fa',
  SUPPORTED_LOCALES: ['fa', 'en'],
  DEFAULT_TIMEZONE: 'Asia/Tehran',
  API_VERSION: 'v1',
  API_PREFIX: '/api/v1',
} as const;

export const AUTH_CONFIG = {
  ACCESS_TOKEN_TTL_SECONDS: 15 * 60, // 15 minutes
  REFRESH_TOKEN_TTL_SECONDS: 7 * 24 * 60 * 60, // 7 days
  OTP_LENGTH: 6,
  OTP_TTL_SECONDS: 120, // 2 minutes
  OTP_MAX_ATTEMPTS: 5,
  OTP_RESEND_RATE_LIMIT_PER_HOUR: 3,
  OTP_RESEND_RATE_LIMIT_PER_DAY: 5,
  LOGIN_RATE_LIMIT_PER_MIN_PER_IP: 5,
  LOGIN_RATE_LIMIT_PER_HOUR_PER_ACCOUNT: 10,
  BCRYPT_COST: 12,
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 128,
} as const;

export const REQUEST_CONFIG = {
  TRACKING_CODE_PREFIX: 'CF',
  TRACKING_CODE_LENGTH: 8,
  ESTIMATED_DURATION_DEFAULT_MIN: 60,
  CANCEL_ALLOWED_STATUSES: ['pending', 'reviewing', 'waiting_for_customer'],
} as const;

/**
 * Request status state machine (Phase 4.2).
 * Key = current status, value = set of statuses it may transition to.
 * Enforced SERVER-SIDE in RequestWorkflowService — the client may use this
 * only for UX gating (e.g. disabling buttons), never for authorization.
 */
export const REQUEST_STATUS_TRANSITIONS: Record<string, readonly string[]> = {
  pending: ['reviewing', 'cancelled', 'rejected'],
  reviewing: [
    'waiting_for_customer',
    'in_progress',
    'waiting_for_payment',
    'rejected',
    'cancelled',
  ],
  waiting_for_customer: ['in_progress', 'reviewing', 'cancelled', 'rejected'],
  in_progress: [
    'waiting_for_customer',
    'waiting_for_payment',
    'completed',
    'rejected',
    'cancelled',
  ],
  waiting_for_payment: ['paid', 'cancelled', 'rejected'],
  paid: ['completed'],
  completed: [], // terminal
  cancelled: [], // terminal
  rejected: [], // terminal
};

/** Statuses an operator/admin may set via the operator status endpoint. */
export const REQUEST_OPERATOR_STATUSES = [
  'reviewing',
  'waiting_for_customer',
  'in_progress',
  'waiting_for_payment',
  'completed',
  'rejected',
] as const;

/** 'paid' is a financial status — admin-only via this endpoint (payment gateway sets it automatically in Phase 6). */
export const REQUEST_ADMIN_ONLY_STATUSES = ['paid'] as const;

/** Auto-assignment strategies (Phase 4.3.5). */
export const AUTO_ASSIGN_STRATEGIES = ['none', 'round_robin', 'least_load'] as const;
export const AUTO_ASSIGN_CONFIG = {
  DEFAULT_STRATEGY: 'round_robin' as const,
  SETTING_KEY: 'requests.auto_assign_strategy',
} as const;

export const WALLET_CONFIG = {
  MIN_DEPOSIT_AMOUNT: 1000, // 10 Toman (minor units)
  MAX_DEPOSIT_AMOUNT: 50_000_000, // 500,000 Toman
  MIN_WITHDRAWAL_AMOUNT: 5000, // 50 Toman
  MAX_WITHDRAWAL_AMOUNT: 10_000_000, // 100,000 Toman
} as const;

export const PAYMENT_CONFIG = {
  CALLBACK_TIMEOUT_SECONDS: 300, // 5 minutes
  VERIFY_RETRY_MAX: 3,
  VERIFY_RETRY_DELAY_MS: 1000,
  IDEMPOTENCY_KEY_TTL_HOURS: 24,
} as const;

export const FILE_UPLOAD_CONFIG = {
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024, // 10 MB
  MAX_IMAGE_SIZE_BYTES: 5 * 1024 * 1024, // 5 MB
  ALLOWED_MIME_TYPES: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
  ],
  ALLOWED_IMAGE_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
} as const;

export const RATE_LIMIT_CONFIG = {
  GLOBAL_PER_MINUTE: 100,
  AUTH_LOGIN_PER_MIN: 5,
  AUTH_REGISTER_PER_HOUR: 3,
  AUTH_OTP_VERIFY_PER_MIN: 10,
  REQUEST_CREATE_PER_MIN: 10,
  MESSAGE_SEND_PER_MIN: 30,
} as const;

export const PUSHER_CONFIG = {
  PRIVATE_REQUEST_CHANNEL: (requestId: number | string) => `private-request.${requestId}`,
  PRESENCE_REQUEST_CHANNEL: (requestId: number | string) => `presence-request.${requestId}`,
  PRIVATE_USER_CHANNEL: (userId: number | string) => `private-user.${userId}`,
  PRIVATE_ADMIN_CHANNEL: 'private-admin',
} as const;

export const STORAGE_PATHS = {
  APP_BASE: 'storage/app',
  PUBLIC_BASE: 'storage/app/public',
  PRIVATE_BASE: 'storage/app/private',
  CACHE_BASE: 'storage/cache',
  LOGS_BASE: 'storage/logs',
} as const;

// Events emitted by Event Bus → consumed by notification/realtime/audit listeners
export const DOMAIN_EVENTS = {
  REQUEST_CREATED: 'request.created',
  REQUEST_ASSIGNED: 'request.assigned',
  REQUEST_STATUS_CHANGED: 'request.status_changed',
  REQUEST_PRICE_CHANGED: 'request.price_changed',
  MESSAGE_SENT: 'message.sent',
  MESSAGE_READ: 'message.read',
  NOTIFICATION_CREATED: 'notification.created',
  PAYMENT_COMPLETED: 'payment.completed',
  PAYMENT_FAILED: 'payment.failed',
  WALLET_UPDATED: 'wallet.updated',
} as const;

// ==================== PHASE 5 — PRICING / DISCOUNTS / INVOICES ====================

/**
 * Cost change types recorded in request_cost_histories (5.1.2 / 5.2.5).
 * Every mutation of a price component writes one row per changed component.
 */
export const COST_CHANGE_TYPES = ['labor', 'material', 'additional', 'discount'] as const;

export const PRICING_CONFIG = {
  /** Reject negative final totals SERVER-SIDE (5.2.4) */
  ALLOW_NEGATIVE_TOTAL: false,
  /** Hard cap for a single cost component in Toman (safety rail) */
  MAX_COMPONENT_TOMAN: 500_000_000,
  MAX_REASON_LENGTH: 500,
} as const;

export const DISCOUNT_CONFIG = {
  CODE_PATTERN: /^[A-Za-z0-9_-]{3,50}$/,
  MIN_PERCENT_VALUE: 1,
  MAX_PERCENT_VALUE: 100,
  /** Hard cap for a fixed-amount discount in Toman (safety rail) */
  MAX_FIXED_VALUE_TOMAN: 100_000_000,
  /** Base for percent/fixed computation = labor + material + additional */
  PERCENT_BASE: 'subtotal_before_discount' as const,
} as const;

export const INVOICE_CONFIG = {
  NUMBER_PREFIX: 'INV',
  /**
   * Invoice numbers derive from the request id: INV-YYYY-000123.
   * invoices are 1:1 with requests (request_id UNIQUE), so the numeric part
   * is collision-free without an extra sequence table.
   */
  NUMBER_PAD: 6,
  GENERATE_ON_STATUS: 'waiting_for_payment' as const,
  PDF_PAGE_MARGIN: 40,
} as const;
