/**
 * Money type — always stored in minor units (e.g. Toman × 100 = Rial)
 * Never use floating-point arithmetic on currency.
 */

export interface Money {
  /** Amount in the smallest currency unit (e.g. Rial for IRT) */
  amount: number;
  /** ISO 4217 currency code (IRR, IRT, USD) */
  currency: string;
}

export interface PriceBreakdown {
  laborFee: Money;
  materialCost: Money;
  additionalCost: Money;
  discount: Money;
  finalTotal: Money;
}

export function calculateFinalTotal(breakdown: Omit<PriceBreakdown, 'finalTotal'>): Money {
  const { laborFee, materialCost, additionalCost, discount } = breakdown;
  if (
    laborFee.currency !== materialCost.currency ||
    materialCost.currency !== additionalCost.currency ||
    additionalCost.currency !== discount.currency
  ) {
    throw new Error('Currency mismatch in price breakdown');
  }
  const finalTotal = laborFee.amount + materialCost.amount + additionalCost.amount - discount.amount;
  return {
    amount: Math.max(0, finalTotal),
    currency: laborFee.currency,
  };
}

/** Format a Money object for display in Persian */
export function formatMoney(money: Money, locale = 'fa-IR'): string {
  const majorAmount = money.amount / 100;
  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: money.currency,
    maximumFractionDigits: 0,
  }).format(majorAmount);
  return formatted;
}
