import { Decimal, d, mul } from '@/lib/lsl/engine/decimal';
import { citation } from '@/lib/lsl/engine/citation';
import { overlapDays, inclusiveDays } from '@/lib/lsl/engine/dates';
import type {
  Citation,
  Employee,
  ISODate,
  Trigger,
  ValuePerDayEntry,
} from '@/lib/lsl/engine/types';
import type { TASExtraInputs } from '../extra-inputs';

/**
 * TAS value-of-week — T8.2.
 *
 * Priority order (resolved in T8.2):
 *   1. Per-day rate variation (TBD-TAS-01 RESOLVED — TAS UNIQUE):
 *        per-day rate = (base × penalty_multiplier) + allowance
 *        value_of_week = SUM across the LSL days
 *        Surfaces `valuePerDayBreakdown[]` on `Result.outputs`.
 *      Path activates when EITHER `extras.tas_shift_penalty_by_day` OR
 *      `extras.tas_all_purpose_allowance_by_day` is supplied as a non-empty
 *      array. Arithmetic order LOCKED per signed test-cases-tas.md line 1583.
 *   2. Commission / piece-rate (s.11(3) — TAS UNIQUE 3-mo / 91-day window):
 *        weekly value = sum(commission income in last 91 days) / 13.
 *      Activates when `employee.categoryOverride === 'C'` AND
 *      `categoryOverrideConfirmed === true`. Falls back to fixed-rate otherwise.
 *   3. Casual / PT s.11(6) 12-month hours averaging:
 *        avg_weekly_hours = hoursLast12Months / 52
 *        value_of_week = avg_weekly_hours × currentHourlyRate
 *      Anchored at entitlement date for taking_leave / as_at / cash_out;
 *      anchored at cessation for termination.
 *   4. Casual / PT fallback — `currentWeeklyGross`.
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
 */

export type TASValueOfWeekPath =
  | 'fixed-rate'
  | 'fixed-rate-with-per-day-variation'
  | 'commission-3mo'
  | 'casual-hours-12mo-s11-6'
  | 'casual-fallback';

export interface TASValueOfWeekResult {
  value: Decimal;
  path: TASValueOfWeekPath;
  citations: Citation[];
  /**
   * Populated when path === 'fixed-rate-with-per-day-variation'. Always 5
   * entries (the working days of the LSL week) when active.
   */
  valuePerDayBreakdown?: ValuePerDayEntry[];
  /**
   * True when neither `extras.tas_shift_penalty_by_day` nor
   * `tas_all_purpose_allowance_by_day` carried any per-day entries and engine
   * fell back to flat weekly rate. The orchestrator surfaces BOTH the TBD-TAS-05
   * default-flat assumption advisory and the TBD-TAS-01 fallback notice.
   */
  perDayVariationFellBackToFlat?: boolean;
  /** Weekly avg hours from s.11(6) — surfaced for diagnostics. */
  weeklyAvg12moHours?: Decimal;
  /** Weekly commission value from s.11(3) — surfaced for diagnostics. */
  weeklyCommission3mo?: Decimal;
}

function readExtras(employee: Employee): TASExtraInputs {
  return (employee.extraInputs ?? {}) as TASExtraInputs;
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

/**
 * TBD-TAS-01 RESOLVED 2026-05-26: per-day rate variation pathway.
 *
 * Arithmetic order LOCKED to first form: `(base × penalty_multiplier) + allowance`.
 * Engine derives `value_of_week` = SUM of per-day `payable`.
 *
 * Requires `currentWeeklyGross / 5` as the per-day base (no separate base-rate
 * input in the cross-state shape). When neither per-day array carries entries
 * the function returns `undefined` and the caller falls back to flat-rate FT.
 *
 * For `taking_leave` triggers we anchor the LSL period at `trigger.leaveStartDate`
 * across 5 weekdays (Mon-Fri). For other triggers we attempt to use the union
 * of `extras.tas_shift_penalty_by_day` and `tas_all_purpose_allowance_by_day`
 * date-set as the LSL days.
 */
function tryPerDayRateVariation(
  employee: Employee,
  trigger: Trigger,
  extras: TASExtraInputs
): { value: Decimal; breakdown: ValuePerDayEntry[] } | undefined {
  const penaltyArr = extras.tas_shift_penalty_by_day ?? [];
  const allowanceArr = extras.tas_all_purpose_allowance_by_day ?? [];

  if (penaltyArr.length === 0 && allowanceArr.length === 0) return undefined;

  const penaltyMap = new Map<string, number>();
  for (const e of penaltyArr) penaltyMap.set(e.date, e.penalty_multiplier);
  const allowanceMap = new Map<string, number>();
  for (const e of allowanceArr) allowanceMap.set(e.date, e.allowance_amount);

  // Determine the LSL day set. For taking_leave we walk 5 weekdays from
  // leaveStartDate. For other triggers we use the union of supplied dates.
  let lslDays: ISODate[];
  if (trigger.kind === 'taking_leave') {
    lslDays = [];
    let cursor = trigger.leaveStartDate;
    let workdaysFound = 0;
    let safety = 0;
    while (workdaysFound < 5 && safety < 30) {
      const dt = new Date(
        Date.UTC(
          Number(cursor.slice(0, 4)),
          Number(cursor.slice(5, 7)) - 1,
          Number(cursor.slice(8, 10))
        )
      );
      const dow = dt.getUTCDay();
      if (dow !== 0 && dow !== 6) {
        lslDays.push(cursor);
        workdaysFound += 1;
      }
      cursor = addDays(cursor, 1);
      safety += 1;
    }
  } else {
    const set = new Set<string>();
    for (const e of penaltyArr) set.add(e.date);
    for (const e of allowanceArr) set.add(e.date);
    lslDays = Array.from(set).sort() as ISODate[];
    if (lslDays.length === 0) return undefined;
  }

  const base = d(employee.currentWeeklyGross).dividedBy(5);
  const breakdown: ValuePerDayEntry[] = [];
  let total = new Decimal(0);

  for (const day of lslDays) {
    const multRaw = penaltyMap.get(day);
    const allowRaw = allowanceMap.get(day);
    const multiplier = multRaw !== undefined ? new Decimal(multRaw) : undefined;
    const allowance = allowRaw !== undefined ? new Decimal(allowRaw) : undefined;

    // (base × penalty_multiplier) + allowance  — locked arithmetic order
    let payable = base;
    if (multiplier !== undefined) payable = payable.times(multiplier);
    if (allowance !== undefined) payable = payable.plus(allowance);

    const entry: ValuePerDayEntry = { date: day, base, payable };
    if (multiplier !== undefined) entry.multiplier = multiplier;
    if (allowance !== undefined) entry.allowance = allowance;
    breakdown.push(entry);
    total = total.plus(payable);
  }

  return { value: total, breakdown };
}

/**
 * TBD-TAS-03 RESOLVED — commission s.11(3) 13-week (91-day) lookback.
 * Sums commission income in the 91 days strictly prior to `anchor` and divides
 * by 13. Returns undefined if no wage-history rows overlap the window.
 */
function tryCommission3mo(
  employee: Employee,
  anchor: ISODate
): { value: Decimal } | undefined {
  if (employee.categoryOverride !== 'C' || !employee.categoryOverrideConfirmed) {
    return undefined;
  }
  // 91-day window ending at anchor (inclusive).
  const windowStart = addDays(anchor, -90);
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
  return { value: sumGross.dividedBy(13) };
}

export function valueOfWeekTAS(
  employee: Employee,
  trigger: Trigger,
  prescribedDate: ISODate,
  effectiveServiceStart: ISODate
): TASValueOfWeekResult {
  void prescribedDate;
  void effectiveServiceStart;
  const citations: Citation[] = [];
  const extras = readExtras(employee);

  // ── Path 1: per-day rate variation (FT/PT).
  if (
    employee.employmentType === 'full_time' ||
    employee.employmentType === 'part_time'
  ) {
    const perDay = tryPerDayRateVariation(employee, trigger, extras);
    if (perDay) {
      citations.push(
        citation(
          'TAS LSL Act 1976 s.11',
          'ordinary-pay.day-to-day-rate-variation-per-shift-penalty-and-allowance',
          TAS_PAGE
        )
      );
      return {
        value: perDay.value,
        path: 'fixed-rate-with-per-day-variation',
        citations,
        valuePerDayBreakdown: perDay.breakdown,
      };
    }
  }

  // ── Path 2: Commission 3-mo (s.11(3)).
  const commissionAnchor: ISODate =
    trigger.kind === 'termination'
      ? trigger.terminationDate
      : trigger.kind === 'as_at'
        ? trigger.asAtDate
        : trigger.kind === 'taking_leave'
          ? trigger.leaveStartDate
          : trigger.cashOutDate;
  const commission = tryCommission3mo(employee, commissionAnchor);
  if (commission) {
    citations.push(
      citation(
        'TAS LSL Act 1976 s.11(3)',
        'ordinary-pay.commission-3mo-income-divided-by-13',
        TAS_PAGE
      )
    );
    return {
      value: commission.value,
      path: 'commission-3mo',
      weeklyCommission3mo: commission.value,
      citations,
    };
  }

  // ── Path 3 / 4: Casual / PT s.11(6) hours averaging.
  if (
    employee.employmentType === 'casual' ||
    employee.employmentType === 'part_time'
  ) {
    const isTaking = trigger.kind === 'taking_leave';
    const isTermination = trigger.kind === 'termination';

    let hours: Decimal | undefined;
    let rate: Decimal | undefined;
    if (extras.currentHourlyRate !== undefined) {
      rate = d(extras.currentHourlyRate);
    }

    if (isTaking || trigger.kind === 'as_at' || trigger.kind === 'cash_out') {
      if (extras.hoursLast12MonthsBeforeEntitlement !== undefined) {
        hours = new Decimal(extras.hoursLast12MonthsBeforeEntitlement);
      } else if (extras.hoursLast12MonthsBeforeCessation !== undefined) {
        hours = new Decimal(extras.hoursLast12MonthsBeforeCessation);
      }
    } else if (isTermination) {
      if (extras.hoursLast12MonthsBeforeCessation !== undefined) {
        hours = new Decimal(extras.hoursLast12MonthsBeforeCessation);
      } else if (extras.hoursLast12MonthsBeforeEntitlement !== undefined) {
        hours = new Decimal(extras.hoursLast12MonthsBeforeEntitlement);
      }
    }

    if (hours !== undefined && rate !== undefined) {
      const avgWeeklyHours = hours.dividedBy(52);
      const value = mul(avgWeeklyHours, rate);
      citations.push(
        citation(
          'TAS LSL Act 1976 s.11(6)',
          employee.employmentType === 'casual'
            ? 'ordinary-pay.casual-12mo-average-hours'
            : 'ordinary-pay.part-time-12mo-average-hours',
          TAS_PAGE
        )
      );
      return {
        value,
        path: 'casual-hours-12mo-s11-6',
        weeklyAvg12moHours: avgWeeklyHours,
        citations,
        perDayVariationFellBackToFlat: true,
      };
    }

    const fallback = d(employee.currentWeeklyGross);
    citations.push(
      citation(
        'TAS LSL Act 1976 s.11(6)',
        employee.employmentType === 'casual'
          ? 'ordinary-pay.casual-12mo-average-fallback'
          : 'ordinary-pay.part-time-12mo-average-fallback',
        TAS_PAGE
      )
    );
    return {
      value: fallback,
      path: 'casual-fallback',
      citations,
      perDayVariationFellBackToFlat: true,
    };
  }

  // ── Path 5: Fixed-rate FT (s.11).
  const fixed = d(employee.currentWeeklyGross);
  citations.push(
    citation('TAS LSL Act 1976 s.11', 'ordinary-pay.fixed-rate', TAS_PAGE)
  );
  return {
    value: fixed,
    path: 'fixed-rate',
    citations,
    perDayVariationFellBackToFlat: true,
  };
}

const TAS_PAGE = 97;

export function valueOfDayTAS(valueOfWeek: Decimal): Decimal {
  return valueOfWeek.dividedBy(5);
}
