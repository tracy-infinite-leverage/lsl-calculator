/**
 * format.test.ts — formatAUD edge-case coverage
 *
 * E6.2 Task 2.7 AC:
 *   - formatAUD(9880.04) returns "$9,880.04"
 *   - Unit tests cover edge cases (0, negative, > 1M, fractional pence)
 *
 * Notes on Intl behaviour:
 *   - `narrowSymbol` currencyDisplay strips the AUD locale's default
 *     `A$` prefix down to `$`, matching the spec example exactly. This is
 *     stable Intl behaviour across Node 18+ / V8 / SpiderMonkey / JSC.
 *   - The thousands separator in en-AU is `,` (comma). Negative numbers
 *     get a leading `-` (no parentheses). Both are en-AU defaults and the
 *     tests below pin both.
 *   - Non-breaking-space U+00A0 sometimes appears between sign and value
 *     in older Node Intl builds. We assert by `replace(/\s/g, '')` where
 *     the leading sign matters; for the headline cases (no sign) we pin
 *     literal strings.
 */

import { describe, expect, it } from 'vitest';
import { formatAUD } from './format';

describe('formatAUD', () => {
  it('formats the AC headline case `9880.04` as `$9,880.04`', () => {
    expect(formatAUD(9880.04)).toBe('$9,880.04');
  });

  it('formats zero as `$0.00`', () => {
    expect(formatAUD(0)).toBe('$0.00');
  });

  it('formats a small sub-dollar value with leading zero and two decimals', () => {
    expect(formatAUD(0.5)).toBe('$0.50');
  });

  it('formats a negative value with leading minus', () => {
    // Strip whitespace because some Intl implementations insert a U+00A0
    // between the sign and the value. The semantic assertion is "leading
    // minus before the dollar sign, comma thousands, two decimals".
    expect(formatAUD(-1234.56).replace(/\s/g, '')).toBe('-$1,234.56');
  });

  it('formats values above one million with thousands separators every three digits', () => {
    expect(formatAUD(1_000_000)).toBe('$1,000,000.00');
    expect(formatAUD(12_345_678.9)).toBe('$12,345,678.90');
  });

  it('rounds fractional pence to two decimal places', () => {
    // The LSL engine quantises money to cents upstream with explicit
    // `Decimal.ROUND_HALF_UP` (see `lib/lsl/engine/decimal.ts:displayAUD`),
    // so by the time a value reaches this formatter it should already be
    // at-most-cents precision. These assertions therefore exist to pin
    // *observed* Intl behaviour (IEEE-754 + V8's rounding), not to specify
    // a product-level rounding contract.
    expect(formatAUD(1.005)).toBe('$1.01');
    expect(formatAUD(1.015)).toBe('$1.02');
    expect(formatAUD(99.999)).toBe('$100.00');
  });

  it('drops cents when called with { cents: false }', () => {
    expect(formatAUD(9880.04, { cents: false })).toBe('$9,880');
    expect(formatAUD(1_000_000, { cents: false })).toBe('$1,000,000');
  });

  it('still formats zero correctly when cents are dropped', () => {
    expect(formatAUD(0, { cents: false })).toBe('$0');
  });

  it('throws for NaN', () => {
    expect(() => formatAUD(Number.NaN)).toThrow(RangeError);
  });

  it('throws for Infinity / -Infinity', () => {
    expect(() => formatAUD(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => formatAUD(Number.NEGATIVE_INFINITY)).toThrow(RangeError);
  });
});
