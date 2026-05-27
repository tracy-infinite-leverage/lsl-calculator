import { Decimal, d, div } from '@/lib/lsl/engine/decimal';
import { citation } from '@/lib/lsl/engine/citation';
import type { Citation, Employee, ISODate, Trigger } from '@/lib/lsl/engine/types';
import type { NTExtraInputs } from '../extra-inputs';

/**
 * NT value-of-week — T9.1 SCAFFOLD.
 *
 * Final priority order (locked for T9.2):
 *   1. **NT per-year `RP × HWW × 1.3` formula** (s.11(3) — NT UNIQUE):
 *        value_of_LSL = Σ over each completed year of service:
 *          RP × HWW × 1.3
 *      where RP = rate at cessation/LSL-start and HWW = hours per week
 *      during that year (excluding overtime). Surfaces an aggregated
 *      `value_of_week` derived from the total per-year sum.
 *      Activates when `extras.nt_hours_per_week_by_year` is supplied as a
 *      non-empty array. When empty AND `currentWeeklyGross` is supplied,
 *      engine falls back to flat path and emits
 *      `nt_per_year_hours_history_missing`.
 *   2. **Commission / piece-rate** (s.11 rate-varies branch): 12-month
 *      income lookback prior to LSL/cessation per TBD-NT-10. Activates when
 *      `employee.categoryOverride === 'C'` AND `categoryOverrideConfirmed
 *      === true`.
 *   3. **Casual / PT s.11(1)(b) per-year averaging**: each year averaged
 *      separately (NT UNIQUE — TBD-NT-01).
 *   4. **Fixed-rate FT** (s.11 default): `currentWeeklyGross`.
 *
 * T9.1 SCAFFOLD implements path 4 only — flat `currentWeeklyGross`. The
 * per-year formula, commission lookback, and per-year averaging land in T9.2.
 *
 * Ordinary-pay inclusions per s.7(2):
 *   - base wages — INCLUDED
 *   - casual loading — INCLUDED (per universal practice; TBD-NT-13)
 *   - industry / leading hand / skill / qualification / service grant
 *     allowances — INCLUDED
 *   - board/lodging cash value — INCLUDED ($15/wk board + $5/wk lodging
 *     statutory fallback per s.7(2)(c); TBD-NT-11)
 *   - bonus / incentive — INCLUDED IF usually paid with pay (s.7(2)(b) —
 *     NT BROADEST in Australia; TBD-NT-07 operator flag)
 *   - over-award payments — INCLUDED
 *   - shift penalties — EXCLUDED (NT diverges from QLD/TAS here)
 *   - penalty rates — EXCLUDED
 *   - district / site / climatic allowances — EXCLUDED
 *   - overtime — EXCLUDED
 *
 * Sources:
 *   - NT LSL Act 1981 s.7(2), s.7(2)(b), s.7(2)(c), s.11, s.11(1)(b), s.11(3),
 *     s.11(4)/(5) statutory worked examples
 *   - APA LSL Masterclass — NT section
 *   - docs/qa/test-cases-nt.md v1.0 PM-signed 2026-05-27
 */

export type NTValueOfWeekPath =
  | 'fixed-rate'
  | 'per-year-formula'
  | 'commission-12mo'
  | 'casual-pt-per-year-averaging';

export interface NTValueOfWeekResult {
  value: Decimal;
  path: NTValueOfWeekPath;
  citations: Citation[];
  /** Weekly avg derived from the s.11(1)(b) per-year averaging — diagnostics. */
  weeklyAvgPerYearHours?: Decimal;
  /** Weekly commission value from s.11 rate-varies branch — diagnostics. */
  weeklyCommission12mo?: Decimal;
  /** True when `nt_hours_per_week_by_year` was empty and engine fell back. */
  perYearHistoryMissing?: boolean;
}

function readExtras(employee: Employee): NTExtraInputs {
  return (employee.extraInputs ?? {}) as NTExtraInputs;
}

/**
 * T9.1 SCAFFOLD: flat-rate path only. T9.2 will layer the NT per-year formula
 * (s.11(3)), the s.11 rate-varies 12-mo commission lookback, and the
 * s.11(1)(b) per-year averaging for casual/PT employees.
 *
 * The smoke fixture TC-NT-001 exercises this path end-to-end.
 */
export function valueOfWeekNT(
  employee: Employee,
  trigger: Trigger,
  psd: ISODate,
  effectiveServiceStart: ISODate
): NTValueOfWeekResult {
  // T9.1 SCAFFOLD: trigger / psd / effectiveServiceStart are part of the
  // locked signature consumed by T9.2 (per-year formula needs psd as the
  // RP anchor and effectiveServiceStart as the year-bucket start).
  void trigger;
  void psd;
  void effectiveServiceStart;

  const citations: Citation[] = [];
  const extras = readExtras(employee);

  // T9.2 will branch on `extras.nt_hours_per_week_by_year`. T9.1 records
  // whether the array is present so the orchestrator can emit the
  // `nt_per_year_hours_history_missing` advisory consistently from day one.
  const perYearHistorySupplied =
    Array.isArray(extras.nt_hours_per_week_by_year) &&
    extras.nt_hours_per_week_by_year.length > 0;
  void perYearHistorySupplied; // reserved for T9.2

  // T9.1 fixed-rate fallback per s.11 default.
  const weekly = d(employee.currentWeeklyGross);
  citations.push(
    citation('NT LSL Act 1981 s.11', 'ordinary-pay.fixed-rate', 0)
  );
  citations.push(
    citation('NT LSL Act 1981 s.7(2)', 'ordinary-pay.s7-2-inclusions', 0)
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
