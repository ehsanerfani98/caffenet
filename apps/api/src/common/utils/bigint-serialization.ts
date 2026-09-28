/**
 * BigInt JSON serialization patch — BigInt is not natively serializable as JSON.
 *
 * This patch overrides BigInt.prototype.toJSON to return the BigInt as a string.
 * Applied once at app startup (in main.ts).
 *
 * Why strings and not numbers?
 *  - IDs can exceed Number.MAX_SAFE_INTEGER (2^53 - 1) for large primary keys
 *  - Strings round-trip safely through JSON.parse and don't lose precision
 *  - Frontend can use the string as-is for API calls and comparisons
 *
 * Why BigInt instead of Int/number?
 *  - MySQL BIGINT supports up to 2^63 - 1 (huge IDs, future-proof)
 *  - Money (Rial) can be in trillions — exceeds Number.MAX_SAFE_INTEGER
 *
 * Alternative approach (not used here):
 *  - Convert every BigInt field to .toString() manually in service/controller layer
 *  - More verbose but more explicit
 *  - We choose the global patch for DRY and simplicity
 */
export function patchBigIntSerialization(): void {
  // @ts-expect-error: BigInt.prototype doesn't have toJSON by default
  BigInt.prototype.toJSON = function () {
    return this.toString();
  };
}
