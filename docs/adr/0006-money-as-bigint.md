# ADR-0006: All Money Stored as BIGINT Minor Units

- **Status**: Accepted
- **Date**: 2026-09-28

## Context

The system has many financial operations:
- Wallet balance
- Service labor fees
- Material costs
- Discounts (percent and fixed)
- Online payments
- Refunds

Floating-point arithmetic on money causes well-known issues:
- `0.1 + 0.2 = 0.30000000000000004`
- Rounding errors compound over thousands of transactions
- Hard to audit

## Decision

Store all money values as **BIGINT minor units**.

### Convention

| Unit | Major | Minor | Multiplier |
|------|-------|--------|------------|
| Toman (IRT) | 50,000 Toman | 5,000,000 Rial | ×100 |
| USD | $10.00 | 1000 cents | ×100 |
| EUR | €10.00 | 1000 cents | ×100 |

In our system, the default currency is **IRT** (Toman), so all amounts are stored as **Rial** (1 Toman = 100 Rial).

### Implementation

- Prisma schema: `BigInt` type for all money columns (mapped to BIGINT in MySQL)
- Code: `number` is used in TypeScript (BigInt not JSON-serializable), but values are always integers
- Validation: TypeScript type guards ensure no fractional values reach the DB
- Formatting: `formatToman(minor)` returns Persian-formatted Toman string

### Helper Functions (`apps/api/src/common/utils/money.ts`)

```ts
// Convert Toman (major) to Rial (minor)
toMinor(50000) → 5_000_000

// Convert Rial (minor) back to Toman (major)
toMajor(5_000_000) → 50_000

// Format as Persian string: "۵۰٬۰۰۰ تومان"
formatToman(5_000_000, 'fa-IR')
```

### Prisma Schema Examples

```prisma
model Wallet {
  // balance in minor units (Rial)
  balance BigInt @default(0)
}

model WalletTransaction {
  // positive = credit, negative = debit (minor units)
  amount       BigInt
  balanceBefore BigInt
  balanceAfter BigInt
}
```

## Consequences

### Positive
- ✅ No floating-point errors ever
- ✅ Easy to audit (integer math)
- ✅ Atomic operations work natively (no decimal/float concerns)
- ✅ Compatible with all database engines
- ✅ Easy to serialize as JSON (number)

### Negative
- ⚠️ Frontend must remember amounts are ×100 — error-prone
- ⚠️ UI components need to format properly for display
- ⚠️ Precision: max value = `9,223,372,036,854,775,807` Rial ≈ `92,233,720,368,547,758` Toman — sufficient

### Mitigations
- All conversions go through helper functions
- Tests verify that no float math reaches the DB
- API responses include both `amountMinor` (raw) and `formatted` (display string) for safety

## References

- TASKS.md Phase 5: Pricing + Material Costs + Discounts + Invoice
- TASKS.md Phase 6: Wallet + Ledger + Online Payment
- Best practices: https://martinforegood.com/blog/avoid-floating-point-for-money
