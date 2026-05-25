import { Decimal, d, mul } from '@/lib/lsl/engine/decimal';
import { citation } from '@/lib/lsl/engine/citation';
import { buildWindow, weeklyAverageOverWindow } from '@/lib/lsl/engine/lookback';
import type {
  Citation,
  Employee,
  ISODate,
  Trigger,
} from '@/lib/lsl/engine/types';
import type { SAExtraInputs } from '../extra-inputs';

/**
 * SA value-of-week per SA LSL Act 1987 s.4 (as amended 2015).
 *
 * Five paths:
 *
 *   1. **Higher-duties acting rate (SA-unique, s.4 + SafeWork SA)** — when
 *      `extraInputs.sa_higher_duties_active === true` AND a
 *      `sa_higher_duties_weekly_rate` is supplied, that higher rate is the
 *      ordinary weekly rate for LSL purposes. Per SafeWork SA: "If you are
 *      acting in a higher paying position when you take leave your ordinary
 *      weekly rate of pay is the new higher rate." TBD-SA-07 RESOLUTION:
 *      SA-localised via `extraInputs` (NOT a DEV-CROSS-3 cross-state field).
 *      Applies regardless of employment type — checked first.
 *
 *   2. **Fixed-rate (s.4)** — FT / PT with a stable wage history. Engine
 *      trusts `currentWeeklyGross` (the user supplies an "ordinary rate
 *      excluding overtime / penalty rates / shift premiums").
 *
 *   3. **Casual / Part-time 156-wk averaging (s.4 + SafeWork SA)** — SA-unique
 *      methodology: hours INCLUDING overtime worked over the 156 weeks
 *      preceding the leave divided by 156, multiplied by the current base
 *      hourly rate (including 25% casual loading for casuals; excluding
 *      overtime / penalty / shift premium rate components). Inputs come from
 *      `Employee.extraInputs.{currentHourlyRate, hoursLast156Weeks}`. The
 *      caller is responsible for the WC/UPL substitution (the form helper
 *      adjusts `hoursLast156Weeks` before submission per TBD-SA-05).
 *
 *   4. **Commission / piece-rate 52-wk income lookback (SafeWork SA —
 *      commission / target / per-piece guidance)** — SA uses a 52-week
 *      income window for commission workers (NOT 156 weeks). Identified via
 *      `categoryOverride: 'C'` + `categoryOverrideConfirmed: true` (the
 *      user has affirmed the worker is commission-based).
 *
 *   5. **Workers Comp overlap (s.4 literal)** — per TBD-SA-08 RESOLUTION: SA
 *      has NO equivalent of VIC s.17 "higher of pre-injury or current rate".
 *      Engine always returns the current rate at the time of taking leave,
 *      even if that is a reduced WC partial-capacity rate. Advisory emitted
 *      from `index.ts`.
 *
 * Sources:
 *   - SA LSL Act 1987 s.4 (as amended by LSL (Calculation of Average Weekly
 *     Earnings) Amendment Act 2015 (SA))
 *   - SafeWork SA — calculating-leave / commission-target-per-piece /
 *     casual-workers / part-time-workers guidance
 *   - APA LSL Masterclass PDF pp.80-94
 *   - docs/qa/test-cases-sa.md v1.0 PM-signed 2026-05-25
 */

export interface SAValueOfWeekResult {
  value: Decimal;
  /** Path taken — for diagnostics + warning emission upstream. */
  path:
    | 'higher-duties'
    | 'fixed-rate'
    | 'casual-hours-156wk'
    | 'casual-fallback'
    | 'commission-52wk';
  /** Diagnostic: 156-wk weekly average where computed. */
  weeklyAvg156w?: Decimal;
  /** Diagnostic: 52-wk weekly average where computed (commission path). */
  weeklyAvg52w?: Decimal;
  citations: Citation[];
  /** Internal: did the higher-duties acting rate apply? Drives warning upstream. */
  higherDutiesApplied?: boolean;
}

function readExtras(employee: Employee): SAExtraInputs {
  return (employee.extraInputs ?? {}) as SAExtraInputs;
}

export function valueOfWeekSA(
  employee: Employee,
  trigger: Trigger,
  prescribedDate: ISODate
): SAValueOfWeekResult {
  const citations: Citation[] = [];
  const extras = readExtras(employee);

  // ── Higher-duties acting-rate path (SA-unique, s.4) — checked first.
  // Applies regardless of employment type when the user has set the flag
  // and supplied a rate.
  if (
    extras.sa_higher_duties_active === true &&
    extras.sa_higher_duties_weekly_rate !== undefined
  ) {
    const acting = d(extras.sa_higher_duties_weekly_rate);
    citations.push(
      citation(
        'SA LSL Act 1987 s.4',
        'ordinary-pay.higher-duties-acting-rate-sa-unique',
        81
      )
    );
    return {
      value: acting,
      path: 'higher-duties',
      citations,
      higherDutiesApplied: true,
    };
  }

  // ── Commission path (52-wk income avg) — checked before casual so a
  // commission casual still uses the 52-wk income window.
  if (
    employee.categoryOverride === 'C' &&
    employee.categoryOverrideConfirmed
  ) {
    const window52 = buildWindow(prescribedDate, 1);
    const avg52 = weeklyAverageOverWindow(employee.wageHistory, window52, 0);
    citations.push(
      citation(
        'SA LSL Act 1987 s.4',
        'ordinary-pay.commission-52wk-income-lookback',
        86
      )
    );
    return {
      value: avg52,
      path: 'commission-52wk',
      weeklyAvg52w: avg52,
      citations,
    };
  }

  // ── Casual / part-time 156-wk averaging path (SA-unique).
  if (
    employee.employmentType === 'casual' ||
    employee.employmentType === 'part_time'
  ) {
    if (
      extras.currentHourlyRate !== undefined &&
      extras.hoursLast156Weeks !== undefined
    ) {
      const hourly = d(extras.currentHourlyRate);
      const hours156 = d(extras.hoursLast156Weeks);
      const avgWeeklyHours = hours156.dividedBy(156);
      const weeklyAvg = mul(avgWeeklyHours, hourly);
      const ruleKey =
        employee.employmentType === 'casual'
          ? 'ordinary-pay.casual-156wk-all-hours-average-with-loading'
          : 'ordinary-pay.part-time-156wk-average';
      citations.push(citation('SA LSL Act 1987 s.4', ruleKey, 85));
      return {
        value: weeklyAvg,
        path: 'casual-hours-156wk',
        weeklyAvg156w: avgWeeklyHours,
        citations,
      };
    }

    // Fallback: no hours/rate supplied — use `currentWeeklyGross` so the
    // form still produces a result. Less precise; the user is expected to
    // supply hours+rate via the form helper for full SA-shaped output.
    const fallback = d(employee.currentWeeklyGross);
    const ruleKey =
      employee.employmentType === 'casual'
        ? 'ordinary-pay.casual-156wk-all-hours-average-with-loading'
        : 'ordinary-pay.part-time-156wk-average';
    citations.push(citation('SA LSL Act 1987 s.4', ruleKey, 85));
    return {
      value: fallback,
      path: 'casual-fallback',
      citations,
    };
  }

  // ── Default: fixed-rate FT path (s.4).
  void trigger;
  const fixed = d(employee.currentWeeklyGross);
  citations.push(
    citation(
      'SA LSL Act 1987 s.4',
      'ordinary-pay.fixed-rate',
      81
    )
  );
  return {
    value: fixed,
    path: 'fixed-rate',
    citations,
  };
}

/** value-of-day = value-of-week / 5 — standard 5-day work week. */
export function valueOfDaySA(valueOfWeek: Decimal): Decimal {
  return valueOfWeek.dividedBy(5);
}
