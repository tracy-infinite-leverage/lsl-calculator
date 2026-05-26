import { Decimal, d } from '@/lib/lsl/engine/decimal';
import { citation } from '@/lib/lsl/engine/citation';
import type {
  Citation,
  Employee,
  ISODate,
  Trigger,
} from '@/lib/lsl/engine/types';
import type { TASExtraInputs } from '../extra-inputs';

/**
 * TAS value-of-week — T8.1 SCAFFOLD.
 *
 * Priority order (resolved in T8.2):
 *   1. Per-day rate variation (TBD-TAS-01 RESOLVED — TAS UNIQUE):
 *        per-day rate = (base × penalty_multiplier) + allowance
 *        value_of_week = average across the LSL days
 *        Output also surfaces `value_per_day_breakdown[]` when active.
 *   2. Commission / piece-rate — 3-month income ÷ 13 (s.11(3) — TAS UNIQUE,
 *      shorter than every other state's commission window).
 *   3. Casual/PT 12-mo hours-averaging (s.11(6)) — anchored at entitlement
 *      date (taking_leave) or cessation (termination).
 *   4. Casual/PT fallback — `currentWeeklyGross`.
 *   5. Fixed-rate FT (s.11) — `currentWeeklyGross`.
 *
 * Ordinary-pay inclusions per s.11:
 *   - shift penalties — INCLUDED (TAS UNIQUE with QLD)
 *   - all-purpose allowances — INCLUDED
 *   - casual loading — INCLUDED
 *   - board/lodging cash value — INCLUDED
 *   - commissions — INCLUDED via s.11(3) 3-month average
 *   - overtime — EXCLUDED
 *   - bonuses — EXCLUDED ABSOLUTELY per s.11(2)(h) — TAS most restrictive
 *
 * For T8.1 the scaffold returns the fixed-rate FT path on `currentWeeklyGross`
 * — sufficient for the smoke fixture TC-TAS-001. T8.2 wires the per-day
 * variation, the 3-mo commission window, the s.11(6) casual averaging, and
 * the per-day-breakdown surface to `Result`.
 */

export type TASValueOfWeekPath =
  | 'fixed-rate'
  | 'fixed-rate-with-per-day-variation'
  | 'commission-3mo'
  | 'casual-hours-12mo-s11-6'
  | 'casual-fallback';

export interface TASValuePerDay {
  date: ISODate;
  rate: Decimal;
}

export interface TASValueOfWeekResult {
  value: Decimal;
  path: TASValueOfWeekPath;
  citations: Citation[];
  /**
   * Populated when path === 'fixed-rate-with-per-day-variation' or
   * 'commission-3mo' surfaces per-day rates (TBD-TAS-01 output addition).
   */
  valuePerDayBreakdown?: TASValuePerDay[];
  /**
   * True when `extras.tas_shift_penalty_by_day` / `tas_all_purpose_allowance_by_day`
   * were empty / undefined and engine fell back to flat weekly rate. The
   * orchestrator surfaces `tas_shift_penalty_assumed_included_in_weekly_gross`
   * advisory.
   */
  perDayVariationFellBackToFlat?: boolean;
}

function readExtras(employee: Employee): TASExtraInputs {
  return (employee.extraInputs ?? {}) as TASExtraInputs;
}

export function valueOfWeekTAS(
  employee: Employee,
  trigger: Trigger,
  prescribedDate: ISODate,
  effectiveServiceStart: ISODate
): TASValueOfWeekResult {
  void trigger;
  void prescribedDate;
  void effectiveServiceStart;
  const citations: Citation[] = [];
  const extras = readExtras(employee);

  // T8.1 scaffold — fixed-rate FT path only. T8.2 wires in:
  //   * per-day variation (extras.tas_shift_penalty_by_day +
  //     tas_all_purpose_allowance_by_day) with value_per_day_breakdown surface
  //   * commission 3-mo lookback (categoryOverride === 'C')
  //   * casual/PT s.11(6) hours-averaging
  // For now, signal flat-fallback so the orchestrator can emit the
  // `tas_shift_penalty_assumed_included_in_weekly_gross` advisory when no
  // per-day data is supplied.
  const fixed = d(employee.currentWeeklyGross);
  citations.push(
    citation('TAS LSL Act 1976 s.11', 'ordinary-pay.fixed-rate', 97)
  );

  const hasPerDayPenalties =
    extras.tas_shift_penalty_by_day !== undefined &&
    Object.keys(extras.tas_shift_penalty_by_day).length > 0;
  const hasPerDayAllowances =
    extras.tas_all_purpose_allowance_by_day !== undefined &&
    Object.keys(extras.tas_all_purpose_allowance_by_day).length > 0;
  const perDayVariationFellBackToFlat = !(
    hasPerDayPenalties || hasPerDayAllowances
  );

  return {
    value: fixed,
    path: 'fixed-rate',
    citations,
    perDayVariationFellBackToFlat,
  };
}

export function valueOfDayTAS(valueOfWeek: Decimal): Decimal {
  return valueOfWeek.dividedBy(5);
}
