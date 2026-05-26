import { Decimal, d, mul } from '@/lib/lsl/engine/decimal';
import { citation } from '@/lib/lsl/engine/citation';
import { buildWindow, weeklyAverageOverWindow } from '@/lib/lsl/engine/lookback';
import { subtractYears, dateInRange } from '@/lib/lsl/engine/dates';
import type {
  Citation,
  Employee,
  ISODate,
  Trigger,
} from '@/lib/lsl/engine/types';
import type { ACTExtraInputs } from '../extra-inputs';

/**
 * ACT value-of-week per ACT LSL Act 1976 s.7 (+ s.2F, s.11D).
 *
 * Priority order:
 *   1. s.7(3) FT→PT/casual within 2 yrs of entitlement (ACT-unique).
 *   2. s.2F commission / piece-rate — 12-mo income ÷ 52.
 *   3. s.7(2) casual/PT 12-mo hours averaging anchored at entitlement date
 *      (for taking_leave / as_at / cash_out).
 *   4. s.11D casual/PT 12-mo hours averaging anchored at cessation
 *      (for termination).
 *   5. Casual/PT fallback — currentWeeklyGross.
 *   6. Fixed-rate FT (s.7(1)) — currentWeeklyGross.
 *
 * Asymmetric overtime treatment (TBD-ACT-02 RESOLVED):
 *   - hours-averaging window INCLUDES overtime hours
 *   - rate applied EXCLUDES overtime premium
 */

export interface ACTValueOfWeekResult {
  value: Decimal;
  path:
    | 'fixed-rate'
    | 'commission-12mo'
    | 'casual-hours-12mo-s7-2'
    | 'casual-hours-12mo-s11D'
    | 'casual-fallback'
    | 's7-3-ft-to-pt-5yr-salary';
  weeklyAvg12moHours?: Decimal;
  weeklyAvg12moIncome?: Decimal;
  fiveYrTotalSalary?: Decimal;
  citations: Citation[];
  overtimeIncluded?: boolean;
  anchorDiverged?: boolean;
  s7_3Applied?: boolean;
}

function readExtras(employee: Employee): ACTExtraInputs {
  return (employee.extraInputs ?? {}) as ACTExtraInputs;
}

function inclusiveDaysSafe(start: string, end: string): number {
  const s = new Date(Date.UTC(
    Number(start.slice(0, 4)),
    Number(start.slice(5, 7)) - 1,
    Number(start.slice(8, 10))
  ));
  const e = new Date(Date.UTC(
    Number(end.slice(0, 4)),
    Number(end.slice(5, 7)) - 1,
    Number(end.slice(8, 10))
  ));
  return Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1;
}

function overlapDaysSafe(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): number {
  const s = aStart > bStart ? aStart : bStart;
  const e = aEnd < bEnd ? aEnd : bEnd;
  if (s > e) return 0;
  return inclusiveDaysSafe(s, e);
}

function overtimeHoursInWindow(
  extras: ACTExtraInputs,
  windowStart: ISODate,
  windowEnd: ISODate
): Decimal {
  void windowStart;
  void windowEnd;
  void dateInRange;
  // v1: presence of any non-zero overtime entry signals that the user-supplied
  // hours total includes overtime hours per s.7(2). Date-window checking is
  // out of scope for v1 — the caller is responsible for ensuring overtime
  // entries correspond to the relevant 12-mo window.
  const periods =
    extras.act_overtime_hours_by_period ??
    extras.overtimeHoursByPeriod ??
    [];
  let total = new Decimal(0);
  for (const p of periods) {
    total = total.plus(new Decimal(p.hours));
  }
  return total;
}

function entitlementDate(effectiveServiceStart: ISODate): ISODate {
  const dt = new Date(
    Date.UTC(
      Number(effectiveServiceStart.slice(0, 4)),
      Number(effectiveServiceStart.slice(5, 7)) - 1,
      Number(effectiveServiceStart.slice(8, 10))
    )
  );
  dt.setUTCFullYear(dt.getUTCFullYear() + 7);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}` as ISODate;
}

export function valueOfWeekACT(
  employee: Employee,
  trigger: Trigger,
  prescribedDate: ISODate,
  effectiveServiceStart: ISODate
): ACTValueOfWeekResult {
  const citations: Citation[] = [];
  const extras = readExtras(employee);

  // ── Path 1: s.7(3) FT→PT/casual within 2 yrs of entitlement.
  if (extras.act_ft_to_pt_transition_date) {
    const entitlement = entitlementDate(effectiveServiceStart);
    const twoYearsBefore = subtractYears(entitlement, 2);
    const transitionDate = extras.act_ft_to_pt_transition_date as ISODate;
    if (transitionDate >= twoYearsBefore && transitionDate <= entitlement) {
      const fiveYearsBefore = subtractYears(entitlement, 5);
      let totalSalary = new Decimal(0);
      for (const row of employee.wageHistory) {
        const rowDays =
          row.periodDays ?? inclusiveDaysSafe(row.periodStart, row.periodEnd);
        if (rowDays === 0) continue;
        const overlap = overlapDaysSafe(
          row.periodStart,
          row.periodEnd,
          fiveYearsBefore,
          entitlement
        );
        if (overlap === 0) continue;
        const gross = d(row.grossPay);
        if (overlap === rowDays) {
          totalSalary = totalSalary.plus(gross);
        } else {
          totalSalary = totalSalary.plus(gross.times(overlap).dividedBy(rowDays));
        }
      }
      const value = totalSalary.dividedBy(5).dividedBy(52);
      citations.push(
        citation(
          'ACT LSL Act 1976 s.7(3)',
          'ordinary-pay.ft-to-pt-within-2yr-of-entitlement-5yr-salary-divided-by-5',
          120
        )
      );
      return {
        value,
        path: 's7-3-ft-to-pt-5yr-salary',
        fiveYrTotalSalary: totalSalary,
        citations,
        s7_3Applied: true,
      };
    }
  }

  // ── Path 2: Commission / piece-rate (s.2F).
  if (
    employee.categoryOverride === 'C' &&
    employee.categoryOverrideConfirmed
  ) {
    const window52 = buildWindow(prescribedDate, 1);
    const avg52 = weeklyAverageOverWindow(employee.wageHistory, window52, 0);
    citations.push(
      citation(
        'ACT LSL Act 1976 s.2F',
        'ordinary-pay.commission-12mo-income-divided-by-52',
        117
      )
    );
    return {
      value: avg52,
      path: 'commission-12mo',
      weeklyAvg12moIncome: avg52,
      citations,
    };
  }

  // ── Path 3 / 4: Casual / PT 12-mo hours-averaging.
  if (
    employee.employmentType === 'casual' ||
    employee.employmentType === 'part_time'
  ) {
    const isTaking = trigger.kind === 'taking_leave';
    const isTermination = trigger.kind === 'termination';

    let primaryHours: Decimal | undefined;
    let primaryAnchor: 'entitlement' | 'cessation' = 'entitlement';
    let secondaryHours: Decimal | undefined;
    let rate: Decimal | undefined;

    if (extras.currentHourlyRate !== undefined) {
      rate = d(extras.currentHourlyRate);
    }

    if (isTaking) {
      primaryAnchor = 'entitlement';
      if (extras.hoursLast12MonthsBeforeEntitlement !== undefined) {
        primaryHours = new Decimal(extras.hoursLast12MonthsBeforeEntitlement);
      }
      if (extras.hoursLast12MonthsBeforeCessation !== undefined) {
        secondaryHours = new Decimal(extras.hoursLast12MonthsBeforeCessation);
      }
    } else if (isTermination) {
      primaryAnchor = 'cessation';
      if (extras.hoursLast12MonthsBeforeCessation !== undefined) {
        primaryHours = new Decimal(extras.hoursLast12MonthsBeforeCessation);
      }
      if (extras.hoursLast12MonthsBeforeEntitlement !== undefined) {
        secondaryHours = new Decimal(extras.hoursLast12MonthsBeforeEntitlement);
      }
    } else {
      if (extras.hoursLast12MonthsBeforeEntitlement !== undefined) {
        primaryHours = new Decimal(extras.hoursLast12MonthsBeforeEntitlement);
        primaryAnchor = 'entitlement';
      } else if (extras.hoursLast12MonthsBeforeCessation !== undefined) {
        primaryHours = new Decimal(extras.hoursLast12MonthsBeforeCessation);
        primaryAnchor = 'cessation';
      }
    }

    if (primaryHours !== undefined && rate !== undefined) {
      const anchorDate: ISODate =
        primaryAnchor === 'entitlement'
          ? entitlementDate(effectiveServiceStart)
          : (trigger.kind === 'termination'
              ? trigger.terminationDate
              : prescribedDate);
      const windowStart = subtractYears(anchorDate, 1);
      const overtimeHours = overtimeHoursInWindow(extras, windowStart, anchorDate);
      const overtimeIncluded = overtimeHours.gt(0);

      const avgWeeklyHours = primaryHours.dividedBy(52);
      const value = mul(avgWeeklyHours, rate);

      const ruleKey =
        primaryAnchor === 'entitlement'
          ? 'ordinary-pay.part-time-12mo-average-hours-include-overtime-rate-excludes'
          : 'ordinary-pay.casual-12mo-average-hours-include-overtime';
      citations.push(
        citation(
          primaryAnchor === 'entitlement'
            ? 'ACT LSL Act 1976 s.7(2)'
            : 'ACT LSL Act 1976 s.11D',
          ruleKey,
          115
        )
      );
      citations.push(
        citation(
          'ACT LSL Act 1976 s.7(1)',
          employee.employmentType === 'casual'
            ? 'ordinary-pay.casual-base-rate-includes-loading-excludes-overtime-premium'
            : 'ordinary-pay.part-time-rate-excludes-overtime-premium',
          115
        )
      );

      const anchorDiverged =
        secondaryHours !== undefined && !secondaryHours.eq(primaryHours);

      return {
        value,
        path:
          primaryAnchor === 'entitlement'
            ? 'casual-hours-12mo-s7-2'
            : 'casual-hours-12mo-s11D',
        weeklyAvg12moHours: avgWeeklyHours,
        citations,
        overtimeIncluded,
        anchorDiverged,
      };
    }

    const fallback = d(employee.currentWeeklyGross);
    citations.push(
      citation(
        isTermination
          ? 'ACT LSL Act 1976 s.11D'
          : 'ACT LSL Act 1976 s.7(2)',
        employee.employmentType === 'casual'
          ? 'ordinary-pay.casual-12mo-average-fallback'
          : 'ordinary-pay.part-time-12mo-average-fallback',
        115
      )
    );
    return {
      value: fallback,
      path: 'casual-fallback',
      citations,
    };
  }

  // ── Path 6: Fixed-rate FT (s.7(1)).
  const fixed = d(employee.currentWeeklyGross);
  citations.push(
    citation('ACT LSL Act 1976 s.7(1)', 'ordinary-pay.fixed-rate', 111)
  );
  return {
    value: fixed,
    path: 'fixed-rate',
    citations,
  };
}

export function valueOfDayACT(valueOfWeek: Decimal): Decimal {
  return valueOfWeek.dividedBy(5);
}
