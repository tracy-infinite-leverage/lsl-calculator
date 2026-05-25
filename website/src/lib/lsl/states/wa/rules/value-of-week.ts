import { Decimal, add, d, mul } from '@/lib/lsl/engine/decimal';
import { citation } from '@/lib/lsl/engine/citation';
import { exclusiveDays } from '@/lib/lsl/engine/dates';
import { buildWindow, weeklyAverageOverWindow } from '@/lib/lsl/engine/lookback';
import type {
  Citation,
  Employee,
  ISODate,
  Trigger,
} from '@/lib/lsl/engine/types';
import type { WAExtraInputs } from '../extra-inputs';

/**
 * WA value-of-week per WA LSL Act 1958 s.9 (as amended 2022).
 *
 * Four primary paths:
 *
 *   1. **Fixed-rate (s.9)** — FT / PT with a stable ordinary-time rate of pay.
 *      Engine trusts `currentWeeklyGross` (user supplies an "ordinary rate
 *      excluding overtime"). Above-award and contractual allowances honoured
 *      if included.
 *
 *   2. **Casual / varied-hours (s.9 as amended 2022 + DEMIRS)** —
 *      **accrual-period averaging** (TBD-WA-06 RESOLVED). Average over each
 *      completed or partial accrual block:
 *        - first 10 yrs = one accrual period
 *        - each subsequent 5 yrs = its own accrual period
 *      Partial second block averaged over PARTIAL DURATION only — NOT
 *      extrapolated to 5 yrs (TBD-WA-06).
 *
 *      Required fixture inputs (on `Employee.extraInputs`):
 *        - `currentHourlyRate` (loaded for casuals — includes casual loading)
 *        - `hoursAccrualBlock1` total ordinary hours in first 10-yr block
 *        - `hoursAccrualBlock2` OR `hoursPartialBlock2` total ordinary hours
 *          in second 5-yr (or partial) block, if tenure > 10 yrs.
 *      When tenure ≤ 10 yrs, only block1 is used.
 *      Fallback: if these are not supplied, the engine falls back to
 *      `currentWeeklyGross` (gross average).
 *
 *   3. **Commission / piecework / results-based (s.9)** — average over the
 *      previous 365 days. Identified by `categoryOverride: 'C'` +
 *      `categoryOverrideConfirmed: true`, OR by `commissionEarningsLast365Days`
 *      being set. Formula: `commissionEarningsLast365Days ÷ 365 × 7`.
 *
 *   4. **Meals/accommodation cash value inclusion** — DEMIRS rule: "may
 *      include the cash value of meals/accommodation normally provided".
 *      When `Employee.mealsAndAccommodationCashValueWeekly` is supplied (>0),
 *      added to the computed value-of-week.
 *
 * Workers Comp rate: TBD-WA-05 RESOLVED — literal s.9 ordinary rate at leave
 * time. No higher-of-rates equivalent to VIC s.17. The reduced-rate advisory
 * is emitted by `index.ts`, not this module.
 *
 * Sources:
 *   - WA LSL Act 1958 s.9 (as amended 2022)
 *   - DEMIRS — Payment for long service leave
 *   - APA LSL Masterclass PDF pp.66-70
 *   - docs/qa/test-cases-wa.md v1.0 PM-signed 2026-05-25
 */

export interface WAValueOfWeekResult {
  value: Decimal;
  /** Diagnostic path taken. */
  path:
    | 'fixed-rate'
    | 'casual-accrual-period'
    | 'casual-fallback'
    | 'commission-365day'
    | 'varied-hours-accrual-period';
  /** Diagnostic block-level rates. */
  valueOfWeekBlock1?: Decimal;
  valueOfWeekPartialBlock2?: Decimal;
  weeklyAvgHoursBlock1?: Decimal;
  weeklyAvgHoursPartialBlock2?: Decimal;
  citations: Citation[];
}

function readExtras(employee: Employee): WAExtraInputs {
  return (employee.extraInputs ?? {}) as WAExtraInputs;
}

/**
 * Decide which path applies to this employee.
 */
function determinePath(employee: Employee): WAValueOfWeekResult['path'] {
  const extras = readExtras(employee);
  if (employee.employmentType === 'casual') {
    if (
      extras.hoursAccrualBlock1 !== undefined &&
      extras.currentHourlyRate !== undefined
    ) {
      return 'casual-accrual-period';
    }
    return 'casual-fallback';
  }
  if (
    employee.categoryOverride === 'C' &&
    employee.categoryOverrideConfirmed
  ) {
    return 'commission-365day';
  }
  if (extras.commissionEarningsLast365Days !== undefined) {
    return 'commission-365day';
  }
  // Varied-hours PT detection: when block1 hours are supplied on a non-casual.
  if (
    employee.employmentType === 'part_time' &&
    extras.hoursAccrualBlock1 !== undefined &&
    extras.currentHourlyRate !== undefined
  ) {
    return 'varied-hours-accrual-period';
  }
  return 'fixed-rate';
}

/**
 * Compute accrual-period-averaged value-of-week for casual/varied-hours.
 *
 * Returns the BLOCK1 average rate. Block2 (if present) and the blended
 * computation (8.6667 weeks at block1 rate plus partial-block2 weeks at
 * block2 rate) are surfaced in diagnostics; the engine's `value-of-week`
 * concept refers to block1 because that's what taking_leave uses first.
 *
 * The trigger handler / orchestrator can then compute total $ as the
 * blended value across blocks for tenure > 10 yrs.
 */
function valueOfWeekAccrualPeriod(
  employee: Employee,
  yearsOfService: Decimal,
  prescribedDate: ISODate
): {
  weeklyAvg: Decimal;
  blockBreakdown: {
    valueOfWeekBlock1: Decimal;
    valueOfWeekPartialBlock2?: Decimal;
    weeklyAvgHoursBlock1: Decimal;
    weeklyAvgHoursPartialBlock2?: Decimal;
  };
} {
  const extras = readExtras(employee);
  const hourly = d(extras.currentHourlyRate ?? '0');

  // Block 1: first 10-yr block. For sub-10-yr tenure, the partial block is
  // the only block — averaged over **floor(grossCalendarYears) × 52** weeks.
  //
  // Why gross calendar (not net-of-LWOP) and why floor()?
  //   PM decision 2026-05-25 — locks in the doc's clean-anniversary verbatim
  //   values (e.g. TC-WA-050: floor(8.0007) × 52 = 416 weeks denominator).
  //   The gross calendar span avoids surfacing LWOP-adjusted denominators that
  //   would diverge from the doc's pre-computed expected values, and floor()
  //   produces the clean integer-year multiple of 52. Fractional-year casuals
  //   (e.g. 7.5 yrs) are floor()-ed to 7 yrs for the divisor in v1 — partial
  //   year is discarded. All existing fixtures are clean-anniversary so this
  //   is the docs verbatim path.
  let block1WeeksDenominator = 520; // 10 yrs × 52 wks
  if (yearsOfService.lt(10)) {
    const grossCalendarDays = exclusiveDays(employee.startDate, prescribedDate);
    const grossCalendarYears = new Decimal(grossCalendarDays).dividedBy('365.25');
    block1WeeksDenominator = Math.max(
      1,
      grossCalendarYears.floor().toNumber() * 52
    );
  }
  const hours1 = d(extras.hoursAccrualBlock1 ?? 0);
  const avgHoursBlock1 = hours1.dividedBy(block1WeeksDenominator);
  const valueOfWeekBlock1 = mul(avgHoursBlock1, hourly);

  // Block 2 (partial or whole): years 10 → end of tenure (or 15).
  let valueOfWeekPartialBlock2: Decimal | undefined;
  let weeklyAvgHoursPartialBlock2: Decimal | undefined;
  const block2Hours =
    extras.hoursPartialBlock2 !== undefined
      ? extras.hoursPartialBlock2
      : extras.hoursAccrualBlock2;
  if (block2Hours !== undefined && yearsOfService.gt(10)) {
    const partialYears = yearsOfService.minus(10);
    const partialDenom = Math.max(1, partialYears.toNumber() * 52);
    const partialHours = d(block2Hours);
    weeklyAvgHoursPartialBlock2 = partialHours.dividedBy(partialDenom);
    valueOfWeekPartialBlock2 = mul(weeklyAvgHoursPartialBlock2, hourly);
  }

  return {
    weeklyAvg: valueOfWeekBlock1,
    blockBreakdown: {
      valueOfWeekBlock1,
      valueOfWeekPartialBlock2,
      weeklyAvgHoursBlock1: avgHoursBlock1,
      weeklyAvgHoursPartialBlock2,
    },
  };
}

export function valueOfWeekWA(
  employee: Employee,
  trigger: Trigger,
  prescribedDate: ISODate,
  yearsOfService: Decimal
): WAValueOfWeekResult {
  const citations: Citation[] = [];
  const extras = readExtras(employee);
  const path = determinePath(employee);

  // Meals/accommodation cash value addition.
  const mealsAddition = d(employee.mealsAndAccommodationCashValueWeekly ?? 0);

  if (path === 'casual-accrual-period') {
    const r = valueOfWeekAccrualPeriod(employee, yearsOfService, prescribedDate);
    citations.push(
      citation(
        'WA LSL Act 1958 s.9',
        'ordinary-pay.casual-loaded-rate-accrual-period-avg',
        70
      )
    );
    citations.push(
      citation(
        'WA LSL Act 1958 s.9',
        'ordinary-pay.casual-accrual-period-average-with-loading',
        70
      )
    );
    let value = r.weeklyAvg;
    if (mealsAddition.gt(0)) {
      value = add(value, mealsAddition);
      citations.push(
        citation(
          'WA LSL Act 1958 s.9',
          'ordinary-pay.meals-accommodation-cash-value-included',
          70
        )
      );
    }
    return {
      value,
      path,
      valueOfWeekBlock1: r.blockBreakdown.valueOfWeekBlock1,
      valueOfWeekPartialBlock2: r.blockBreakdown.valueOfWeekPartialBlock2,
      weeklyAvgHoursBlock1: r.blockBreakdown.weeklyAvgHoursBlock1,
      weeklyAvgHoursPartialBlock2: r.blockBreakdown.weeklyAvgHoursPartialBlock2,
      citations,
    };
  }

  if (path === 'varied-hours-accrual-period') {
    const r = valueOfWeekAccrualPeriod(employee, yearsOfService, prescribedDate);
    citations.push(
      citation(
        'WA LSL Act 1958 s.9',
        'ordinary-pay.varied-hours-accrual-period-average',
        72
      )
    );
    let value = r.weeklyAvg;
    if (mealsAddition.gt(0)) {
      value = add(value, mealsAddition);
      citations.push(
        citation(
          'WA LSL Act 1958 s.9',
          'ordinary-pay.meals-accommodation-cash-value-included',
          70
        )
      );
    }
    return {
      value,
      path,
      valueOfWeekBlock1: r.blockBreakdown.valueOfWeekBlock1,
      valueOfWeekPartialBlock2: r.blockBreakdown.valueOfWeekPartialBlock2,
      weeklyAvgHoursBlock1: r.blockBreakdown.weeklyAvgHoursBlock1,
      weeklyAvgHoursPartialBlock2: r.blockBreakdown.weeklyAvgHoursPartialBlock2,
      citations,
    };
  }

  if (path === 'casual-fallback') {
    // No hours/rate supplied — compute 52-wk gross average from wage history;
    // fall back to currentWeeklyGross when wage history is empty/sparse.
    const window52 = buildWindow(prescribedDate, 1);
    const avg52 = weeklyAverageOverWindow(employee.wageHistory, window52, 0);
    let value = avg52.isZero() ? d(employee.currentWeeklyGross) : avg52;
    citations.push(
      citation(
        'WA LSL Act 1958 s.9',
        'ordinary-pay.casual-loaded-rate-accrual-period-avg',
        70
      )
    );
    if (mealsAddition.gt(0)) {
      value = add(value, mealsAddition);
      citations.push(
        citation(
          'WA LSL Act 1958 s.9',
          'ordinary-pay.meals-accommodation-cash-value-included',
          70
        )
      );
    }
    return {
      value,
      path,
      citations,
    };
  }

  if (path === 'commission-365day') {
    // Results-based pay 365-day average. Use explicit commission earnings if
    // supplied; otherwise compute from wage history (52-wk approximation).
    let value: Decimal;
    if (extras.commissionEarningsLast365Days !== undefined) {
      const annual = d(extras.commissionEarningsLast365Days);
      value = annual.dividedBy(365).times(7);
    } else {
      const window52 = buildWindow(prescribedDate, 1);
      value = weeklyAverageOverWindow(employee.wageHistory, window52, 0);
    }
    citations.push(
      citation(
        'WA LSL Act 1958 s.9',
        'ordinary-pay.results-based-pay-365-day-average'
      )
    );
    if (mealsAddition.gt(0)) {
      value = add(value, mealsAddition);
      citations.push(
        citation(
          'WA LSL Act 1958 s.9',
          'ordinary-pay.meals-accommodation-cash-value-included',
          70
        )
      );
    }
    return {
      value,
      path,
      citations,
    };
  }

  // Default fixed-rate path.
  void trigger;
  let value = d(employee.currentWeeklyGross);
  citations.push(
    citation(
      'WA LSL Act 1958 s.9',
      'ordinary-pay.fixed-rate',
      66
    )
  );
  citations.push(
    citation(
      'WA LSL Act 1958 s.9',
      'ordinary-pay.fixed-rate-pt',
      66
    )
  );
  citations.push(
    citation(
      'WA LSL Act 1958 s.9',
      'ordinary-pay.overtime-excluded',
      66
    )
  );
  if (mealsAddition.gt(0)) {
    value = add(value, mealsAddition);
    citations.push(
      citation(
        'WA LSL Act 1958 s.9',
        'ordinary-pay.meals-accommodation-cash-value-included',
        70
      )
    );
  }
  return {
    value,
    path: 'fixed-rate',
    citations,
  };
}

/** value-of-day = value-of-week / 5 — standard 5-day work week. */
export function valueOfDayWA(valueOfWeek: Decimal): Decimal {
  return valueOfWeek.dividedBy(5);
}
