/**
 * format.ts — currency presentation helpers
 *
 * E6.2 Task 2.7 — AUD currency formatter used everywhere customer-facing
 * money is rendered (web + PDF).
 *
 * Spec §5.7 contract: "render currency as AUD with comma thousands separator
 * and 2-decimal precision (e.g. `$9,880.04`)". The single AC example is
 * `formatAUD(9880.04)` → `"$9,880.04"`.
 *
 * Why this is separate from `lib/lsl/engine/decimal.ts:displayAUD`:
 *   - `displayAUD` is calculation-side: returns the rounded numeric string
 *     `"9880.04"` (no `$`, no thousands separator) so the engine can write
 *     the value into structured outputs.
 *   - `formatAUD` is presentation-side: prepends `$`, inserts thousands
 *     separators, and is the right call from any React component or PDF
 *     template that renders money to a user.
 *
 * Locale: en-AU. Uses `Intl.NumberFormat` which is built into every
 * supported runtime (Node ≥ 14, all evergreen browsers, react-pdf via the
 * polyfill it ships). No new dependency.
 *
 * @param amount - the AUD value to format. `number`, not `Decimal`, on
 *   purpose: this helper sits at the presentation boundary; if the caller
 *   already has a `Decimal`, they should convert it via `.toNumber()` (or
 *   keep the rounded `displayAUD` string and not touch it further).
 * @param opts.cents - when `false`, drops the cents portion (e.g.
 *   `formatAUD(9880, { cents: false })` → `"$9,880"`). Default `true`.
 *
 * Rounding: defers to `Intl.NumberFormat`. Observed quirks like
 * `formatAUD(1.005) === "$1.01"` are driven by IEEE-754 representation
 * (`1.005` is stored as `1.00499…` and so isn't actually a tie), not by a
 * half-to-even tie-break. The LSL engine handles all money-arithmetic
 * rounding upstream with `Decimal.ROUND_HALF_UP`; by the time a value
 * reaches this formatter it should already be quantised to cents, so the
 * exact rounding behaviour here is academic.
 *
 * Edge cases covered by `format.test.ts`:
 *   - 0 → `"$0.00"`
 *   - negative → leading `-` before `$` (en-AU convention)
 *   - > 1M → thousands separators every three digits
 *   - fractional pence → rounded to 2dp
 *   - `NaN` / `Infinity` → throws (defensive; never expected in real flow)
 */

const AUD_FORMATTER_WITH_CENTS = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  currencyDisplay: 'narrowSymbol',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const AUD_FORMATTER_NO_CENTS = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  currencyDisplay: 'narrowSymbol',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export interface FormatAUDOptions {
  /** Include cents in the output. Defaults to true. */
  cents?: boolean;
}

export function formatAUD(amount: number, opts: FormatAUDOptions = {}): string {
  if (!Number.isFinite(amount)) {
    throw new RangeError(
      `formatAUD: amount must be a finite number, received ${amount}`,
    );
  }
  const formatter =
    opts.cents === false ? AUD_FORMATTER_NO_CENTS : AUD_FORMATTER_WITH_CENTS;
  return formatter.format(amount);
}
