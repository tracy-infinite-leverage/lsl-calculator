import { Decimal, d, div, mul } from '@/lib/lsl/engine/decimal';
import { citation } from '@/lib/lsl/engine/citation';
import { inclusiveDays, overlapDays } from '@/lib/lsl/engine/dates';
import type { Citation, Employee, ISODate, Trigger } from '@/lib/lsl/engine/types';
import type { NTExtraInputs, NTHoursPerWeekByYear } from '../extra-inputs';

/**
 * NT value-of-week — T9.2.
 *
 * Priority order:
 *   1. **NT per-year `RP × HWW × 1.3` formula** (s.11(3) — NT UNIQUE):
 *        value_of_LSL = Σ over each completed year of service:
 *          RP × HWW_y × 1.3
 *      where RP = rate at cessation/LSL-start and HWW_y = hours per week
 *      during that year (excluding overtime). Surfaces an aggregated
 *      `value_of_week` derived from the total per-year sum (divided by the
 *      total payable weeks). The path activates when
 *      `extras.nt_hours_per_week_by_year` is supplied as a non-empty array
 *      OR when we can synthesise a single-year flat record from
 *      `currentWeeklyGross` + `currentHourlyRate`. When the operator-supplied
 *      array is incomplete the engine fills the gaps from `currentWeeklyGross`
 *      and emits `nt_per_year_hours_history_partial`.
 *
 *      Note: the *aggregated* `value_of_week` reported on the orchestrator
 *      output is `total_payout / payable_weeks` — i.e. the average per-week
 *      dollar value implied by the per-year sum. The orchestrator then
 *      multiplies `value_of_week × payable_weeks` to produce the total dollar
 *      figure, which by construction equals the per-year sum exactly. This
 *      preserves the cross-state output shape (every state reports a single
 *      `valueOfWeek`) while honouring s.11(3).
 *
 *   2. **Commission / piece-rate** (s.11 rate-varies branch): 12-month income
 *      lookback prior to LSL/cessation (TBD-NT-10: 52 wks / 364 days). Active
 *      when `employee.categoryOverride === 'C'` AND `categoryOverrideConfirmed
 *      === true`.
 *
 *   3. **Fixed-rate FT fallback** (s.11 default): `currentWeeklyGross`.
 *
 * Ordinary-pay inclusions per s.7(2):
 *   - base wages, casual loading, industry/leading-hand/skill/qualification/
 *     service-grant allowances, board/lodging cash value, over-award payments,
 *     commissions — INCLUDED
 *   - bonus / incentive — INCLUDED IF usually paid with pay (s.7(2)(b) —
 *     NT BROADEST in Australia; TBD-NT-07 operator flag handled in orchestrator)
 *   - overtime, penalty rates, district/site/climatic allowances, shift
 *     penalties — EXCLUDED
 *
 * Sources:
 *   - NT LSL Act 1981 s.7(2), s.7(2)(b), s.7(2)(c), s.11, s.11(1)(b), s.11(3),
 *     s.11(4)/(5) statutory worked examples
 *   - APA LSL Masterclass — NT section
 *   - docs/qa/test-cases-nt.md v1.0 PM-signed 2026-05-27
 */

const NT_ACT_PAGE = 0; // RES-3 pin pending.
const NT_PER_YEAR_FACTOR = new Decimal('1.3'); // s.11(3) × 1.3
const NT_COMMISSION_LOOKBACK_DAYS = 364; // 52 weeks per TBD-NT-10

export type NTValueOfWeekPath =
  | 'fixed-rate'
  | 'per-year-formula'
  | 'commission-12mo';

export interface NTPerYearBucket {
  yearStart: ISODate;
  yearEnd: ISODate;
  hoursPerWeek: Decimal;
  /** RP × HWW × 1.3 for this year. */
  yearDollars: Decimal;
  /** Source: 'operator' (from nt_hours_per_week_by_year) or 'fallback' (from currentWeeklyGross). */
  source: 'operator' | 'fallback';
}

export interface NTValueOfWeekResult {
  value: Decimal;
  path: NTValueOfWeekPath;
  citations: Citation[];
  /** Per-year breakdown — present whenever the per-year formula fires. */
  perYearBreakdown?: NTPerYearBucket[];
  /** Total dollars from the per-year sum (path = 'per-year-formula'). */
  totalDollarsFromPerYear?: Decimal;
  /** Weekly commission value from the 12-mo lookback — diagnostics. */
  weeklyCommission12mo?: Decimal;
  /** True when `nt_hours_per_week_by_year` was empty and engine fell back. */
  perYearHistoryMissing?: boolean;
  /** True when `nt_hours_per_week_by_year` was supplied but did not cover all years. */
  perYearHistoryPartial?: boolean;
}

function readExtras(employee: Employee): NTExtraInputs {
  return (employee.extraInputs ?? {}) as NTExtraInputs;
}

function asISO(s: string): ISODate {
  return s as ISODate;
}

function addDaysISO(iso: ISODate, days: number): ISODate {
  const dt = new Date(
    Date.UTC(
      Number(iso.slice(0, 4)),
      Number(iso.slice(5, 7)) - 1,
      Number(iso.slice(8, 10))
    )
  );
  dt.setUTCDate(dt.getUTCDate() + days);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}` as ISODate;
}

/**
 * Derive a "current" hourly rate from `currentWeeklyGross` when the operator
 * has not supplied a separate hourly. Engine convention: 38 hr/wk is the
 * national award-standard full-time hours base. Used only for the per-year
 * formula fallback (when `nt_hours_per_week_by_year` is empty we need a rate
 * and a single-bucket hours value — the rate is `currentWeeklyGross / 38`).
 *
 * The operator-supplied per-year `hoursPerWeek` values produce per-year
 * dollars by `(currentWeeklyGross / 38) × hours × 1.3` — which preserves the
 * "RP at cessation" definition while accepting per-year HWW.
 */
function deriveHourlyRate(employee: Employee): Decimal {
  return d(employee.currentWeeklyGross).dividedBy(38);
}

/**
 * Build a list of per-year buckets covering the [effectiveServiceStart, psd]
 * range. Each bucket is exactly one calendar-year-from-start; the FINAL
 * bucket is truncated to the psd if the worker did not complete the full year.
 *
 * Operator-supplied entries from `nt_hours_per_week_by_year` are matched by
 * overlap with each year bucket. When a bucket has no operator overlap, the
 * fallback hours-per-week is derived from `currentWeeklyGross` (assumed
 * 38hr/wk).
 *
 * Years strictly past `effectiveYearsForPayout` are EXCLUDED from the sum —
 * this is how the s.10(1A) misconduct truncation interacts with the per-year
 * formula. e.g. 12.5y misconduct → effectiveYearsForPayout = 10 → only the
 * first 10 year-buckets are summed.
 */
function buildPerYearBuckets(
  employee: Employee,
  effectiveServiceStart: ISODate,
  effectivePsd: ISODate,
  effectiveYearsForPayout: Decimal,
  operatorHistory: NTHoursPerWeekByYear[]
): { buckets: NTPerYearBucket[]; partial: boolean } {
  const RP_HOURLY = deriveHourlyRate(employee); // rate immediately preceding cessation
  const fallbackWeekly = d(employee.currentWeeklyGross);

  // Total years to sum: min(actual elapsed, effectiveYearsForPayout). When
  // effectiveYearsForPayout > total elapsed (shouldn't happen for misconduct
  // but defensively): clamp to elapsed.
  const totalDaysElapsed = inclusiveDays(effectiveServiceStart, effectivePsd);
  const totalYearsElapsed = new Decimal(totalDaysElapsed).dividedBy('365.25');
  const yearsToSum = Decimal.min(effectiveYearsForPayout, totalYearsElapsed);

  // Build N integer year-buckets + one final fractional bucket (if any).
  const fullYears = yearsToSum.floor().toNumber();
  const fractionalRemainder = yearsToSum.minus(fullYears);

  const buckets: NTPerYearBucket[] = [];
  let partial = false;

  let cursor: ISODate = effectiveServiceStart;
  for (let i = 0; i < fullYears; i++) {
    // Year bucket: [cursor, cursor + 364 days] (i.e. 365 inclusive days = 1 year).
    const yearEnd = addDaysISO(cursor, 364);
    const matched = findOperatorHoursForBucket(cursor, yearEnd, operatorHistory);
    let hoursPerWeek: Decimal;
    let source: 'operator' | 'fallback';
    if (matched !== undefined) {
      hoursPerWeek = new Decimal(matched);
      source = 'operator';
    } else {
      // Fallback: derive from currentWeeklyGross at the 38 hr/wk baseline.
      hoursPerWeek = fallbackWeekly.dividedBy(RP_HOURLY);
      source = 'fallback';
      partial = true;
    }
    const yearDollars = RP_HOURLY.times(hoursPerWeek).times(NT_PER_YEAR_FACTOR);
    buckets.push({
      yearStart: cursor,
      yearEnd,
      hoursPerWeek,
      yearDollars,
      source,
    });
    cursor = addDaysISO(yearEnd, 1);
  }

  // Fractional final bucket (only for the per-year formula's full-tenure
  // path; misconduct truncation always lands on an integer multiple).
  if (fractionalRemainder.gt(0)) {
    // Final bucket spans from `cursor` to `effectivePsd`.
    const yearEnd = effectivePsd;
    const matched = findOperatorHoursForBucket(cursor, yearEnd, operatorHistory);
    let hoursPerWeek: Decimal;
    let source: 'operator' | 'fallback';
    if (matched !== undefined) {
      hoursPerWeek = new Decimal(matched);
      source = 'operator';
    } else {
      hoursPerWeek = fallbackWeekly.dividedBy(RP_HOURLY);
      source = 'fallback';
      partial = true;
    }
    // Pro-rated dollars: `RP × HWW × 1.3 × fractionalRemainder`.
    const yearDollars = RP_HOURLY.times(hoursPerWeek)
      .times(NT_PER_YEAR_FACTOR)
      .times(fractionalRemainder);
    buckets.push({
      yearStart: cursor,
      yearEnd,
      hoursPerWeek,
      yearDollars,
      source,
    });
  }

  return { buckets, partial };
}

/**
 * Find the operator-supplied hours-per-week value that best overlaps a given
 * year bucket. We use overlap-fraction as a tie-breaker: the operator entry
 * with the largest overlap wins. Returns `undefined` if no entry overlaps.
 */
function findOperatorHoursForBucket(
  yearStart: ISODate,
  yearEnd: ISODate,
  operatorHistory: NTHoursPerWeekByYear[]
): number | undefined {
  let bestOverlap = 0;
  let bestHours: number | undefined;
  for (const entry of operatorHistory) {
    const opStart = asISO(entry.yearStart);
    const opEnd = asISO(entry.yearEnd);
    const overlap = overlapDays(opStart, opEnd, yearStart, yearEnd);
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestHours = entry.hoursPerWeek;
    }
  }
  return bestHours;
}

/**
 * s.11 rate-varies 12-month commission lookback. Returns undefined when:
 *   - employee is not flagged as commission (categoryOverride !== 'C' OR
 *     categoryOverrideConfirmed !== true), OR
 *   - no wage-history rows overlap the 12-month window.
 */
function tryCommission12mo(
  employee: Employee,
  anchor: ISODate
): { value: Decimal } | undefined {
  if (employee.categoryOverride !== 'C' || !employee.categoryOverrideConfirmed) {
    return undefined;
  }
  const windowStart = addDaysISO(anchor, -(NT_COMMISSION_LOOKBACK_DAYS - 1));
  let sumGross = new Decimal(0);
  let anyOverlap = false;
  for (const row of employee.wageHistory) {
    const rowDays =
      row.periodDays ?? inclusiveDays(row.periodStart, row.periodEnd);
    if (rowDays === 0) continue;
    const overlap = overlapDays(
      row.periodStart,
      row.periodEnd,
      windowStart,
      anchor
    );
    if (overlap === 0) continue;
    anyOverlap = true;
    const gross = d(row.grossPay);
    if (overlap === rowDays) {
      sumGross = sumGross.plus(gross);
    } else {
      sumGross = sumGross.plus(gross.times(overlap).dividedBy(rowDays));
    }
  }
  if (!anyOverlap) return undefined;
  // Weekly average = total / 52.
  return { value: sumGross.dividedBy(52) };
}

/**
 * Output of the per-year formula path — the value passed back via
 * `NTValueOfWeekResult.value` is the AVERAGE weekly value implied by the
 * per-year sum divided by the total payable weeks (`effectiveYearsForPayout
 * × 1.3`). This preserves the cross-state output shape while the orchestrator
 * relies on `totalDollarsFromPerYear` for the exact dollar payout.
 */
export interface NTValueOfWeekContext {
  /**
   * Years used for the per-year sum — passed in from the accrual table. For
   * normal full/pro-rata paths this is identical to `years_of_continuous_service`.
   * For the s.10(1A) misconduct path this is the truncated block (e.g. 10 yrs
   * for a 12.5y misconduct termination).
   */
  effectiveYearsForPayout: Decimal;
}

/**
 * Main value-of-week entry point. The orchestrator calls this twice in the
 * misconduct case (once with the truncated block years to get the locked
 * per-year sum, and the result is the canonical value). For all other paths
 * the orchestrator calls it once.
 */
export function valueOfWeekNT(
  employee: Employee,
  trigger: Trigger,
  psd: ISODate,
  effectiveServiceStart: ISODate,
  context?: NTValueOfWeekContext
): NTValueOfWeekResult {
  const citations: Citation[] = [];
  const extras = readExtras(employee);

  // ── Commission 12-mo lookback (s.11 rate-varies branch — TBD-NT-10).
  const commissionAnchor: ISODate =
    trigger.kind === 'termination'
      ? trigger.terminationDate
      : trigger.kind === 'as_at'
        ? trigger.asAtDate
        : trigger.kind === 'taking_leave'
          ? trigger.leaveStartDate
          : trigger.cashOutDate;

  const commission = tryCommission12mo(employee, commissionAnchor);
  if (commission) {
    citations.push(
      citation(
        'NT LSL Act 1981 s.11',
        'ordinary-pay.commission-12mo-lookback',
        NT_ACT_PAGE
      )
    );
    citations.push(
      citation(
        'NT LSL Act 1981 s.7(2)',
        'ordinary-pay.s7-2-inclusions',
        NT_ACT_PAGE
      )
    );
    return {
      value: commission.value,
      path: 'commission-12mo',
      citations,
      weeklyCommission12mo: commission.value,
    };
  }

  // ── Per-year `RP × HWW × 1.3` formula (s.11(3) — NT UNIQUE).
  const operatorHistory = Array.isArray(extras.nt_hours_per_week_by_year)
    ? extras.nt_hours_per_week_by_year
    : [];
  const perYearHistorySupplied = operatorHistory.length > 0;

  // Determine the years-to-sum. The orchestrator passes context for the
  // misconduct branch; otherwise we use the elapsed years from effective
  // service start to psd.
  const elapsedDays = inclusiveDays(effectiveServiceStart, psd);
  const elapsedYears = new Decimal(elapsedDays).dividedBy('365.25');
  const yearsToSum =
    context?.effectiveYearsForPayout !== undefined
      ? context.effectiveYearsForPayout
      : elapsedYears;

  // Only fire the per-year formula when there's any tenure to sum. (Zero
  // tenure → fall through to flat-rate fallback; orchestrator surfaces $0
  // via the accrual gates.)
  if (yearsToSum.gt(0)) {
    const { buckets, partial } = buildPerYearBuckets(
      employee,
      effectiveServiceStart,
      psd,
      yearsToSum,
      operatorHistory
    );

    if (buckets.length > 0) {
      let totalDollars = new Decimal(0);
      for (const b of buckets) totalDollars = totalDollars.plus(b.yearDollars);
      // Average weekly value across the locked payable weeks (= yearsToSum × 1.3).
      const payableWeeks = yearsToSum.times(NT_PER_YEAR_FACTOR);
      const value = payableWeeks.gt(0)
        ? totalDollars.dividedBy(payableWeeks)
        : new Decimal(0);

      citations.push(
        citation(
          'NT LSL Act 1981 s.11(3)',
          'ordinary-pay.per-year-rp-hww-1.3',
          NT_ACT_PAGE
        )
      );
      citations.push(
        citation(
          'NT LSL Act 1981 s.7(2)',
          'ordinary-pay.s7-2-inclusions',
          NT_ACT_PAGE
        )
      );
      return {
        value,
        path: 'per-year-formula',
        citations,
        perYearBreakdown: buckets,
        totalDollarsFromPerYear: totalDollars,
        perYearHistoryMissing: !perYearHistorySupplied,
        perYearHistoryPartial: perYearHistorySupplied && partial,
      };
    }
  }

  // ── Fixed-rate fallback (s.11 default — sub-7y, $0, etc.).
  const weekly = d(employee.currentWeeklyGross);
  citations.push(
    citation('NT LSL Act 1981 s.11', 'ordinary-pay.fixed-rate', NT_ACT_PAGE)
  );
  citations.push(
    citation('NT LSL Act 1981 s.7(2)', 'ordinary-pay.s7-2-inclusions', NT_ACT_PAGE)
  );
  return {
    value: weekly,
    path: 'fixed-rate',
    citations,
    perYearHistoryMissing: !perYearHistorySupplied,
  };
}

/** value_of_day = value_of_week / 5 — same convention as every prior state. */
export function valueOfDayNT(valueOfWeek: Decimal): Decimal {
  return div(valueOfWeek, 5);
}

/** Exposed for unit tests. */
export const __INTERNAL = {
  buildPerYearBuckets,
  tryCommission12mo,
  deriveHourlyRate,
  NT_PER_YEAR_FACTOR,
  NT_COMMISSION_LOOKBACK_DAYS,
};

void mul; // (kept import for symmetry with sibling modules)
