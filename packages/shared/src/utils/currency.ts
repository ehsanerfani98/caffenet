/**
 * CurrencyHelper (Phase 5.1.5) — the ONLY sanctioned way to format, parse,
 * and convert currency amounts across API, Web, and Worker.
 *
 * Rules:
 *  - Internally everything is an INTEGER in MINOR units (Rial for IRT).
 *  - Never use floating-point arithmetic on currency.
 *  - Parses Persian/Arabic digits and Persian thousand separators (٬ , ،).
 */

import { Currency } from '../enums';

export class CurrencyHelper {
  /** Minor units per major unit for each supported currency. */
  private static readonly MINOR_PER_MAJOR: Record<string, number> = {
    [Currency.IRT]: 100, // 1 Toman = 100 minor units
    [Currency.IRR]: 1, // Rial itself is the minor unit
    [Currency.USD]: 100, // cents
  };

  /** Persian → Latin digit map (plus Arabic-Indic digits). */
  private static readonly PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
  private static readonly ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

  // ==================== CONVERT (5.1.5) ====================

  /** Toman (major) → minor units. Throws on non-integers / negatives. */
  static toMinor(toman: number, currency: string = Currency.IRT): number {
    const scale = CurrencyHelper.MINOR_PER_MAJOR[currency];
    if (!scale) throw new Error(`Unsupported currency: ${currency}`);
    if (!Number.isFinite(toman) || !Number.isInteger(toman) || toman < 0) {
      throw new Error(`مبلغ نامعتبر است: ${toman}`);
    }
    return toman * scale;
  }

  /** Minor units → Toman (major) for display/API responses. */
  static toMajor(minor: number, currency: string = Currency.IRT): number {
    const scale = CurrencyHelper.MINOR_PER_MAJOR[currency];
    if (!scale) throw new Error(`Unsupported currency: ${currency}`);
    if (!Number.isInteger(minor)) throw new Error(`مبلغ نامعتبر است: ${minor}`);
    return Math.floor(minor / scale);
  }

  /** Convert a major-unit amount between supported currencies (fixed-rate IRT↔IRR). */
  static convert(amount: number, from: string, to: string): number {
    if (from === to) return amount;
    if (from === Currency.IRT && to === Currency.IRR) return amount * 10;
    if (from === Currency.IRR && to === Currency.IRT) return Math.floor(amount / 10);
    throw new Error(`تبدیل ${from} به ${to} پشتیبانی نمی‌شود`);
  }

  // ==================== FORMAT (5.1.5) ====================

  /** Format minor units as a Persian-language major-unit string (grouped). */
  static format(minor: number, currency: string = Currency.IRT, locale = 'fa-IR'): string {
    const major = CurrencyHelper.toMajor(minor, currency);
    const unit = CurrencyHelper.unitLabel(currency);
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(major)} ${unit}`;
  }

  /** Format major units (Toman) without the unit label — for form inputs. */
  static formatMajor(major: number, locale = 'fa-IR'): string {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(major);
  }

  static unitLabel(currency: string = Currency.IRT): string {
    switch (currency) {
      case Currency.IRT:
        return 'تومان';
      case Currency.IRR:
        return 'ریال';
      case Currency.USD:
        return 'دلار';
      default:
        return currency;
    }
  }

  // ==================== PARSE (5.1.5) ====================

  /**
   * Parse a human-typed amount into MINOR units.
   * Accepts Persian/Arabic digits, thousand separators (٬ ، , , spaces), and
   * an optional trailing currency word. Returns null when nothing parseable.
   */
  static parse(input: string, currency: string = Currency.IRT): number | null {
    if (typeof input !== 'string') return null;
    let s = input.trim();
    if (s.length === 0) return null;

    // Normalize Persian/Arabic digits → Latin
    s = s.replace(/[۰-۹]/g, (d) => String(CurrencyHelper.PERSIAN_DIGITS.indexOf(d)));
    s = s.replace(/[٠-٩]/g, (d) => String(CurrencyHelper.ARABIC_DIGITS.indexOf(d)));

    // Persian decimal separator → dot (rejected later for money safety)
    s = s.replace(/٫/g, '.');

    // Strip currency words and separators
    s = s.replace(/(تومان|ریال|دلار|tomans?|rials?|toman|rial)/gi, '').replace(/[٬،,\s]/g, '');

    if (!/^-?\d+(\.\d+)?$/.test(s)) return null;

    const value = Number(s);
    if (!Number.isFinite(value)) return null;
    const major = Math.floor(Math.abs(value));
    try {
      return CurrencyHelper.toMinor(major, currency) * Math.sign(value || 1);
    } catch {
      return null;
    }
  }

  /** Parse to MAJOR units (Toman) — for DTO-level validation. */
  static parseMajor(input: string): number | null {
    const minor = CurrencyHelper.parse(input);
    if (minor === null) return null;
    return CurrencyHelper.toMajor(Math.abs(minor)) * Math.sign(minor || 1);
  }

  // ==================== INTEGER MATH (5.1.4) ====================

  /** Integer-safe sum of minor-unit amounts. */
  static add(...amounts: number[]): number {
    return amounts.reduce((sum, x) => {
      if (!Number.isInteger(x)) throw new Error('مبلغ باید عدد صحیح باشد');
      return sum + x;
    }, 0);
  }

  /**
   * Final total (5.2.3 / 5.2.4): Labor + Material + Additional − Discount.
   * Throws when the result would be negative — server-side only.
   */
  static finalTotal(labor: number, material: number, additional: number, discount: number): number {
    const total = CurrencyHelper.add(labor, material, additional) - discount;
    if (total < 0) {
      throw new Error('مبلغ نهایی نمی‌تواند منفی باشد');
    }
    return total;
  }
}
