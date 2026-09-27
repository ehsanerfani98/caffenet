/**
 * System-wide enums shared between API, Web, and Worker.
 * Stored in DB as strings (Prisma enum) or as TINYINT (lookup tables for high-volume tables).
 */

// ==================== AUTH ====================
export enum UserRole {
  CUSTOMER = 'customer',
  OPERATOR = 'operator',
  ADMIN = 'admin',
}

export enum UserStatus {
  PENDING_OTP = 'pending_otp',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  BANNED = 'banned',
}

export enum SessionStatus {
  ACTIVE = 'active',
  REVOKED = 'revoked',
  EXPIRED = 'expired',
}

export enum OtpType {
  REGISTER = 'register',
  LOGIN = 'login',
  FORGOT_PASSWORD = 'forgot_password',
  RESET_PASSWORD = 'reset_password',
}

export enum OtpStatus {
  PENDING = 'pending',
  CONSUMED = 'consumed',
  EXPIRED = 'expired',
}

// ==================== CATALOG ====================
export enum CategoryStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export enum ServiceStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DRAFT = 'draft',
}

export enum ServiceFieldType {
  TEXT = 'text',
  TEXTAREA = 'textarea',
  NUMBER = 'number',
  EMAIL = 'email',
  PHONE = 'phone',
  DATE = 'date',
  TIME = 'time',
  DATETIME = 'datetime',
  SELECT = 'select',
  MULTISELECT = 'multiselect',
  RADIO = 'radio',
  CHECKBOX = 'checkbox',
  FILE = 'file',
  IMAGE = 'image',
}

// ==================== REQUESTS ====================
export enum RequestStatus {
  PENDING = 'pending',
  REVIEWING = 'reviewing',
  WAITING_FOR_CUSTOMER = 'waiting_for_customer',
  IN_PROGRESS = 'in_progress',
  WAITING_FOR_PAYMENT = 'waiting_for_payment',
  PAID = 'paid',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  REJECTED = 'rejected',
}

export enum PaymentStatus {
  UNPAID = 'unpaid',
  PARTIALLY_PAID = 'partially_paid',
  PAID = 'paid',
  REFUNDED = 'refunded',
}

// ==================== FINANCE ====================
export enum Currency {
  IRR = 'IRR', // Iranian Rial (minor unit = 1 Rial)
  IRT = 'IRT', // Iranian Toman (minor unit = 1/100 Toman)
  USD = 'USD',
}

export enum WalletStatus {
  ACTIVE = 'active',
  FROZEN = 'frozen',
  CLOSED = 'closed',
}

export enum WalletTransactionType {
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
  SERVICE_PAYMENT = 'service_payment',
  REFUND = 'refund',
  DISCOUNT = 'discount',
  BONUS = 'bonus',
  MANUAL_ADJUSTMENT = 'manual_adjustment',
  PAYMENT_REVERSAL = 'payment_reversal',
}

export enum WalletTransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REVERSED = 'reversed',
}

export enum PaymentGatewayName {
  ZARINPAL = 'zarinpal',
  ZIBAL = 'zibal',
  // future: 'asanpardakht', 'sep' etc.
}

export enum PaymentRecordStatus {
  PENDING = 'pending',
  VERIFYING = 'verifying',
  SUCCESSFUL = 'successful',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

export enum InvoiceStatus {
  DRAFT = 'draft',
  ISSUED = 'issued',
  PAID = 'paid',
  VOID = 'void',
}

export enum DiscountType {
  PERCENT = 'percent',
  FIXED = 'fixed',
}

// ==================== CHAT ====================
export enum ChatRoomType {
  REQUEST = 'request',
  SUPPORT = 'support',
}

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  FILE = 'file',
  SYSTEM = 'system',
  PRICE_UPDATE = 'price_update',
  STATUS_UPDATE = 'status_update',
}

export enum MessageStatus {
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  DELETED = 'deleted',
}

// ==================== NOTIFICATIONS ====================
export enum NotificationType {
  REQUEST_CREATED = 'request_created',
  REQUEST_ASSIGNED = 'request_assigned',
  REQUEST_STATUS_CHANGED = 'request_status_changed',
  REQUEST_PRICE_CHANGED = 'request_price_changed',
  NEW_CHAT_MESSAGE = 'new_chat_message',
  PAYMENT_SUCCESSFUL = 'payment_successful',
  PAYMENT_FAILED = 'payment_failed',
  WALLET_CHARGED = 'wallet_charged',
  REFUND_ISSUED = 'refund_issued',
  REQUEST_COMPLETED = 'request_completed',
  REQUEST_CANCELLED = 'request_cancelled',
}

export enum NotificationChannel {
  IN_APP = 'in_app',
  PUSH = 'push',
  EMAIL = 'email',
  SMS = 'sms',
}

// ==================== QUEUE / JOBS ====================
export enum JobStatus {
  PENDING = 'pending',
  RESERVED = 'reserved',
  COMPLETED = 'completed',
  FAILED = 'failed',
  EXPIRED = 'expired',
}

export enum JobName {
  SEND_NOTIFICATION = 'send_notification',
  SEND_WEB_PUSH = 'send_web_push',
  SEND_EMAIL = 'send_email',
  SEND_SMS = 'send_sms',
  PAYMENT_RECONCILIATION = 'payment_reconciliation',
  CLEANUP_PUSH_SUBSCRIPTIONS = 'cleanup_push_subscriptions',
  CLEANUP_EXPIRED_OTPS = 'cleanup_expired_otps',
  CLEANUP_EXPIRED_SESSIONS = 'cleanup_expired_sessions',
}

// ==================== AUDIT ====================
export enum AuditAction {
  LOGIN = 'login',
  LOGOUT = 'logout',
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  ASSIGN = 'assign',
  REVOKE = 'revoke',
  PRICE_CHANGE = 'price_change',
  STATUS_CHANGE = 'status_change',
  WALLET_ADJUST = 'wallet_adjust',
  REFUND_ISSUE = 'refund_issue',
  PERMISSION_CHANGE = 'permission_change',
  ROLE_CHANGE = 'role_change',
  SETTING_CHANGE = 'setting_change',
}

// ==================== FILE STORAGE ====================
export enum FileVisibility {
  PUBLIC = 'public',
  PRIVATE = 'private',
}

export enum FileStorageDriver {
  LOCAL = 'local',
  S3 = 's3',
}

// ==================== DEPLOYMENT ====================
export enum DeploymentProfile {
  SHARED = 'shared',
  VPS = 'vps',
}

export enum CacheDriver {
  FILE = 'file',
  REDIS = 'redis',
}

export enum QueueDriver {
  DATABASE = 'database',
  REDIS = 'redis',
}
