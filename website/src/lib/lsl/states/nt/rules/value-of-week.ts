import { Decimal, d } from '@/lib/lsl/engine/decimal';
import { citation } from '@/lib/lsl/engine/citation';
import { overlapDays, inclusiveDays } from '@/lib/lsl/engine/dates';
import type {
  Citation,
  Employee,
  ISODate,
  Trigger,
} from '@/lib/lsl/engine/types';
import type { NTExtraInputs, NTHoursPerWeekByYearEntry } from '../extra-inputs';

/**
 * NT value-of-week — T9.1 SCAFFOLD.
 *
 * Priority order:
 *   1. Per-year formula (TBD-NT-01 RESOLVED — NT UNIQUE):
 *        Σ over each completed year of service: RP × HWW_y × 1.3
 *        where RP = rate immediately preceding cessation/LSL-start.
 *      Path activates when `extras.nt_hours_per_week_by_year` is supplied as
 *      a non-empty array. Returns `value` as the AGGREGATE PAYOUT (i.e. the
 *      total dollar entitlement), not a per-week dollar figure.
 *      NOTE: this differs from the standard `valueOfWeek × weeks` shape used
 *      by the other 7 states. The orchestrator detects this path and bypasses
 *      the `valueOfWeek × accrual.payableWeeks` multiplication. T9.1 scaffold
 *      surfaces the path with full advisories; richer integration lands in
 *      T9.2 (rules + orchestrator).
 *   2. Variable-rate 12-mo (52-week) lookback (TBD-NT-10 RESOLVED — s.11):
 *        weekly value = sum(income last 52 weeks) / 52
 *      Activates when `employee.categoryOverride === 'C'` AND
 *      `categoryOverrideConfirmed === true`. Falls back to fixed-rate otherwise.
 *   3. Fixed-rate FT (s.11 — constant hours branch) — `currentWeeklyGross`.
 *      Smoke path for TC-NT-001.
 *
 * Ordinary-pay inclusions per s.7(2):
 *   - shift penalties — EXCLUDED per s.7(2)
 *   - all-purpose / industry / leading hand / skill / qualification / service
 *     grant allowances — INCLUDED per s.7(2)
 *   - casual loading — INCLUDED (universal practice, TBD-NT-13)
 *   - board/lodging cash value — operator pre-strips into currentWeeklyGross
 *     per TBD-NT-11 RESOLVED Option (c)
 *   - commissions — INCLUDED via s.11 12-mo lookback
 *   - overtime — EXCLUDED per s.7(2)
 *   - penalty rates — EXCLUDED per s.7(2)
 *   - district / site / climatic allowances — EXCLUDED per s.7(2)
 *   - bonuses — INCLUDED iff operator confirms via `extraInputs.nt_bonus_usually_paid_with_pay`
 *     per s.7(2)(b) (BROADEST in Australia — TBD-NT-07)
 *
 * Sources:
 *   - NT LSL Act 1981 s.7(2), s.11, s.11(1)(b), s.11(3)
 *   - APA LSL Masterclass — NT section
 *   - docs/qa/test-cases-nt.md v1.0 PM-signed 2026-05-27
 */

export type NTValueOfWeekPath =
  | 'fixed-rate'
  | 'per-year-formula'
  | 'variable-rate-52wk'
  | 'casual-fallback';

export interface NTValueOfWeekResult {
  /**
   * For path 'per-year-formula': total dollar entitlement (aggregate payout).
   * For all other paths: the weekly value (multiplied by accrual weeks
   * downstream).
   */
  value: Decimal;
  path: NTValueOfWeekPath;
  citations: Citation[];
  /**
   * Per-year breakdown when `per-year-formula` path applies. One entry per
   * completed year of service that the operator supplied.
   */
  perYearBreakdown?: Array<{
    yearStart: ISODate;
    yearEnd: ISODate;
    hoursPerWeek: Decimal;
    /** `RP × HWW × 1.3` for this year — the year's contribution to the payout. */
    yearContribution: Decimal;
  }>;
  /**
   * True when the per-year formula was the obvious applicable path (NT has
   * unique per-year payout structure) but the operator did not supply the
   * `nt_hours_per_week_by_year` array. Engine fell back to flat
   * `currentWeeklyGross` for the year-aggregate. Surfaced as
   * `nt_hours_per_year_history_not_supplied` advisory by the orchestrator.
   */
  perYearHistoryNotSupplied?: boolean;
  /** Weekly average from 52-wk lookback when path === 'variable-rate-52wk'. */
  weeklyAvg52wk?: Decimal;
}

function readExtras(employee: Employee): NTExtraInputs {
  return (employee.extraInputs ?? {}) as NTExtraInputs;
}

function addDays(iso: ISODate, days: number): ISODate {
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

const NT_ACT_PAGE = 0;

/**
 * Build the per-year payout using `extras.nt_hours_per_week_by_year`.
 *
 * For each year: contribution = RP × HWW × 1.3, where RP is derived as
 * `currentHourlyRate` (preferred) or `currentWeeklyGross / HWW` (fallback).
 *
 * Returns undefined if the per-year array is empty / missing.
 */
function tryPerYearFormula(
  employee: Employee,
  entries: NTHoursPerWeekByYearEntry[]
): { value: Decimal; breakdown: NTValueOfWeekResult['perYearBreakdown'] } | undefined {
  if (entries.length === 0) return undefined;

  // RP = rate immediately preceding cessation / LSL-start. For the smoke path
  // we derive RP from `currentWeeklyGross` and the OPERATOR-SUPPLIED current
  // hours. If `currentWeeklyGross` is set the operator has already encoded
  // their canonical RP × HWW snapshot — for the per-year application we use
  // that weekly-gross / 38 (default-hours) as RP hourly rate per s.11(3)(a)
  // simplification, OR if the entries themselves carry a consistent HWW we
  // can derive RP from a single weeklyGross check. v1 keeps this simple and
  // defers to operator-supplied currentWeeklyGross as `RP × HWW_at_cessation`
  // — and we treat each prior year's HWW × 1.3 ratio over the cessation HWW
  // as the per-year scaling factor.
  //
  // Engine surface for T9.1 scaffold: compute Σ (HWW_y × 1.3) × (RP_hourly),
  // where RP_hourly = currentWeeklyGross / HWW_at_cessation. The last entry
  // (latest year) defines HWW_at_cessation.
  const cessationEntry = entries[entries.length - 1];
  const hwwAtCessation = new Decimal(cessationEntry.hoursPerWeek);
  if (hwwAtCessation.lte(0)) return undefined;

  const weeklyGross = d(employee.currentWeeklyGross);
  const rpHourly = weeklyGross.dividedBy(hwwAtCessation);

  const breakdown: NTValueOfWeekResult['perYearBreakdown'] = [];
  let total = new Decimal(0);
  for (const e of entries) {
    const hww = new Decimal(e.hoursPerWeek);
    // Per-year contribution: RP × HWW × 1.3 weeks = hourly × HWW × 1.3
    //   = $/hr × hrs/wk × wks = $.
    const contribution = rpHourly.times(hww).times(new Decimal('1.3'));
    breakdown.push({
      yearStart: e.yearStart as ISODate,
      yearEnd: e.yearEnd as ISODate,
      hoursPerWeek: hww,
      yearContribution: contribution,
    });
    total = total.plus(contribution);
  }
  return { value: total, breakdown };
}

/**
 * TBD-NT-10 RESOLVED — variable-rate s.11 52-week (364-day) lookback. Sums
 * income in the 364 days strictly prior to `anchor` and divides by 52.
 * Returns undefined if no wage-history rows overlap the window.
 */
function tryVariableRate52wk(
  employee: Employee,
  anchor: ISODate
): { value: Decimal } | undefined {
  if (employee.categoryOverride !== 'C' || !employee.categoryOverrideConfirmed) {
    return undefined;
  }
  // 364-day window ending at anchor (inclusive).
  const windowStart = addDays(anchor, -363);
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
  return { value: sumGross.dividedBy(52) };
}

export function valueOfWeekNT(
  employee: Employee,
  trigger: Trigger,
  prescribedDate: ISODate,
  effectiveServiceStart: ISODate
): NTValueOfWeekResult {
  void prescribedDate;
  void effectiveServiceStart;
  const citations: Citation[] = [];
  const extras = readExtras(employee);

  // ── Path 1: NT-unique per-year formula (s.11(3)).
  const perYearEntries = extras.nt_hours_per_week_by_year ?? [];
  if (perYearEntries.length > 0) {
    const perYear = tryPerYearFormula(employee, perYearEntries);
    if (perYear) {
      citations.push(
        citation(
          'NT LSL Act 1981 s.11(3)',
          'ordinary-pay.per-year-rp-times-hww-times-1.3-aggregation',
          NT_ACT_PAGE
        )
      );
      return {
        value: perYear.value,
        path: 'per-year-formula',
        citations,
        perYearBreakdown: perYear.breakdown,
      };
    }
  }

  // ── Path 2: Variable-rate 52-wk (s.11).
  const variableRateAnchor: ISODate =
    trigger.kind === 'termination'
      ? trigger.terminationDate
      : trigger.kind === 'as_at'
        ? trigger.asAtDate
        : trigger.kind === 'taking_leave'
          ? trigger.leaveStartDate
          : trigger.cashOutDate;
  const variableRate = tryVariableRate52wk(employee, variableRateAnchor);
  if (variableRate) {
    citations.push(
      citation(
        'NT LSL Act 1981 s.11',
        'ordinary-pay.variable-rate-52wk-income-divided-by-52',
        NT_ACT_PAGE
      )
    );
    return {
      value: variableRate.value,
      path: 'variable-rate-52wk',
      weeklyAvg52wk: variableRate.value,
      citations,
    };
  }

  // ── Path 3: Casual fallback (no per-year, no variable-rate path).
  if (employee.employmentType === 'casual') {
    const fallback = d(employee.currentWeeklyGross);
    citations.push(
      citation(
        'NT LSL Act 1981 s.11',
        'ordinary-pay.casual-fallback-from-current-weekly-gross',
        NT_ACT_PAGE
      )
    );
    return {
      value: fallback,
      path: 'casual-fallback',
      citations,
      perYearHistoryNotSupplied: true,
    };
  }

  // ── Path 4: Fixed-rate FT/PT (s.11 constant-hours branch) — smoke path.
  const fixed = d(employee.currentWeeklyGross);
  citations.push(
    citation('NT LSL Act 1981 s.11', 'ordinary-pay.fixed-rate', NT_ACT_PAGE)
  );
  return {
    value: fixed,
    path: 'fixed-rate',
    citations,
    perYearHistoryNotSupplied: true,
  };
}

export function valueOfDayNT(valueOfWeek: Decimal): Decimal {
  return valueOfWeek.dividedBy(5);
}
