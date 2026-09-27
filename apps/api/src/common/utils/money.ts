import { ConflictException } from '@nestjs/common';

/**
 * Money helper — all amounts in MINOR units (Toman × 100 = Rial).
 * Never use Float for currency. Only the BigInt/int math below is allowed.
 *
 * Conventions:
 *  - DB column type: BIGINT (via Prisma BigInt)
 *  - API DTO: number (JSON has no BigInt, so we serialize as number where safe)
 *  - Frontend display: format with Intl.NumberFormat('fa-IR')
 */

export const MINOR_UNIT = 100;

/**
 * Convert Toman (major) to Rial (minor).
 * 50,000 Toman → 5,000,000 Rial.
 */
export function toMinor(toman: number): number {
  if (!Number.isInteger(toman) || toman < 0) {
    throw new ConflictException(`Invalid money amount: ${toman}`);
  }
  return toman * MINOR_UNIT;
}

/**
 * Convert Rial (minor) back to Toman (major) for display.
 */
export function toMajor(minor: number): number {
  return Math.floor(minor / MINOR_UNIT);
}

/**
 * Format money amount in minor units as Persian Toman string.
 */
export function formatToman(minor: number, locale = 'fa-IR'): string {
  const major = toMajor(minor);
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(major);
}

/**
 * Add two money amounts (minor units).
 */
export function addMoney(...amounts: number[]): number {
  return amounts.reduce((sum, x) => sum + x, 0);
}

/**
 * Subtract money (minor units). Refuses negative results for wallet balance.
 */
export function subMoney(from: number, ...toSub: number[]): number {
  const result = toSub.reduce((sum, x) => sum - x, from);
  if (result < 0) {
    throw new ConflictException('مبلغ نهایی نمی‌تواند منفی باشد');
  }
  return result;
}
