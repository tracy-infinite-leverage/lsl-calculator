import { Decimal, d, mul } from '@/lib/lsl/engine/decimal';
import { inclusiveDays, toDate, toISO } from '@/lib/lsl/engine/dates';
import type { ISODate, WagePeriod } from '@/lib/lsl/engine/types';

/**
 * SA s.8(3a)(b) cash-out variation-top-up detection.
 *
 * When LSL is cashed out under a written agreement (s.5(1a)), the rate of
 * pay is fixed at the cash-out date. If the worker's ordinary rate rises
 * during the period the cash-out payment covers (`cashOutDate` through
 * `cashOutDate + cashedOutWeeks × 7` days), the employer MUST make a
 * further payment equal to (rising_rate − rate_at_cash_out) × affected_weeks.
 *
 * This is a statutory minimum — under-payment breaches the Act.
 *
 * Pure function: scans wageHistory for periods that START strictly after
 * `cashOutDate` and within the coverage window, compares each period's
 * weekly-equivalent rate against `rateAtCashOut`, and aggregates rises.
 *
 * Sources:
 *   - SA LSL Act 1987 s.8(3a)(b) (SA-unique statutory variation top-up)
 *   - .specify/features/005-lsl-platform/spec.md §6 method-level overrides
 */

export interface SARiseEntry {
  /** Rising weekly-equivalent rate observed in the wage row. */
  rate: Decimal;
  /** ISO date the rising rate is effective from (period start). */
  effectiveFrom: ISODate;
  /** Affected weeks within the cash-out coverage window. */
  affectedWeeks: Decimal;
  /** Top-up for this rise: (rate − rateAtCashOut) × affectedWeeks. */
  topUp: Decimal;
}

export interface SACashoutVariationTopupResult {
  rateAtCashOut: Decimal;
  cashOutDate: ISODate;
  coverageEnd: ISODate;
  cashedOutWeeks: Decimal;
  rises: SARiseEntry[];
  totalAffectedWeeks: Decimal;
  totalTopUp: Decimal;
}

function addDays(iso: ISODate, days: number): ISODate {
  const dt = toDate(iso);
  dt.setUTCDate(dt.getUTCDate() + days);
  return toISO(dt);
}

function isoLT(a: ISODate, b: ISODate): boolean {
  return toDate(a).getTime() < toDate(b).getTime();
}

function isoGT(a: ISODate, b: ISODate): boolean {
  return toDate(a).getTime() > toDate(b).getTime();
}

function maxISO(a: ISODate, b: ISODate): ISODate {
  return isoLT(a, b) ? b : a;
}

function minISO(a: ISODate, b: ISODate): ISODate {
  return isoGT(a, b) ? b : a;
}

/**
 * Detect SA cash-out variation top-up. Returns `null` when no qualifying
 * rate rise is found within the coverage window.
 *
 * @param wageHistory  Persisted pay-period rows, ordered or unordered.
 * @param cashOutDate  Trigger date — start of the cash-out coverage period.
 * @param cashedOutWeeks  Number of weeks being cashed out (drives window length).
 * @param rateAtCashOut  Weekly rate locked at the cash-out date (typically
 *                       the SA value-of-week output for the trigger).
 */
export function detectSACashoutVariationTopup(
  wageHistory: WagePeriod[],
  cashOutDate: ISODate,
  cashedOutWeeks: Decimal,
  rateAtCashOut: Decimal
): SACashoutVariationTopupResult | null {
  if (cashedOutWeeks.lte(0)) return null;
  if (rateAtCashOut.lte(0)) return null;

  // Coverage window is (cashOutDate, cashOutDate + cashedOutWeeks × 7] in days.
  // Use ceil to keep fractional-week cash-outs auditable to the nearest day.
  const totalCoverageDays = Math.ceil(cashedOutWeeks.times(7).toNumber());
  const coverageEnd = addDays(cashOutDate, totalCoverageDays);
  const coverageStart = addDays(cashOutDate, 1); // strictly after cash-out

  const rises: SARiseEntry[] = [];
  let totalAffectedWeeks = new Decimal(0);
  let totalTopUp = new Decimal(0);

  for (const row of wageHistory) {
    // Only consider rows whose period STARTS strictly after cashOutDate and
    // starts on or before coverageEnd. Rows that straddle cashOutDate carry
    // the rate-at-cash-out by definition and are excluded.
    if (!isoGT(row.periodStart, cashOutDate)) continue;
    if (isoGT(row.periodStart, coverageEnd)) continue;

    const rowDays =
      row.periodDays ?? inclusiveDays(row.periodStart, row.periodEnd);
    if (rowDays <= 0) continue;

    const gross = d(row.grossPay);
    // Per-row weekly-equivalent rate. Matches the convention used by
    // lookback.ts (gross × 7 / row_days).
    const rowWeeklyRate = mul(gross, 7).dividedBy(rowDays);

    if (rowWeeklyRate.lte(rateAtCashOut)) continue; // not a rise

    // Affected portion within the coverage window.
    const overlapStart = maxISO(row.periodStart, coverageStart);
    const overlapEnd = minISO(row.periodEnd, coverageEnd);
    if (isoGT(overlapStart, overlapEnd)) continue;

    const overlapDaysCount = inclusiveDays(overlapStart, overlapEnd);
    const affectedWeeks = new Decimal(overlapDaysCount).dividedBy(7);
    const topUp = mul(
      rowWeeklyRate.minus(rateAtCashOut),
      affectedWeeks
    );

    rises.push({
      rate: rowWeeklyRate,
      effectiveFrom: row.periodStart,
      affectedWeeks,
      topUp,
    });
    totalAffectedWeeks = totalAffectedWeeks.plus(affectedWeeks);
    totalTopUp = totalTopUp.plus(topUp);
  }

  if (rises.length === 0) return null;

  // Sort rises by effectiveFrom for deterministic output / message ordering.
  rises.sort((a, b) =>
    a.effectiveFrom < b.effectiveFrom ? -1 : a.effectiveFrom > b.effectiveFrom ? 1 : 0
  );

  return {
    rateAtCashOut,
    cashOutDate,
    coverageEnd,
    cashedOutWeeks,
    rises,
    totalAffectedWeeks,
    totalTopUp,
  };
}
