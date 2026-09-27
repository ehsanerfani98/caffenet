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
