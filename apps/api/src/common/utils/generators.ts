/**
 * Tracking code generator: CF-YYYY-NNNNNN
 * e.g. CF-2026-001234
 */
export function generateTrackingCode(
  sequence: number,
  year: number = new Date().getFullYear(),
): string {
  const padded = String(sequence).padStart(6, '0');
  return `CF-${year}-${padded}`;
}

/**
 * Invoice number generator: INV-YYYY-NNNNNN
 */
export function generateInvoiceNumber(
  sequence: number,
  year: number = new Date().getFullYear(),
): string {
  const padded = String(sequence).padStart(6, '0');
  return `INV-${year}-${padded}`;
}

/**
 * Idempotency key — UUID v4 + optional namespace
 */
export function generateIdempotencyKey(namespace?: string): string {
  const uuid = require('uuid').v4();
  return namespace ? `${namespace}:${uuid}` : uuid;
}

/**
 * Generate a 6-digit OTP code (cryptographically random)
 * Returns string with leading zeros preserved.
 */
export function generateOtpCode(length: number = 6): string {
  const { randomBytes } = require('crypto');
  const max = Math.pow(10, length);
  const num = randomBytes(4).readUInt32BE(0) % max;
  return num.toString().padStart(length, '0');
}

/**
 * Mask phone for logging: 09123456789 → 0912*****89
 */
export function maskPhone(phone: string): string {
  if (phone.length < 6) return '*'.repeat(phone.length);
  return `${phone.slice(0, 4)}${'*'.repeat(phone.length - 6)}${phone.slice(-2)}`;
}

/**
 * Mask email for logging: ali@gmail.com → a***@gmail.com
 */
export function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain || !user || user.length < 2) return email;
  return `${user[0]}${'*'.repeat(Math.min(5, user.length - 1))}@${domain}`;
}
