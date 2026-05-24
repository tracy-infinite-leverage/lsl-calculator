import { Decimal, d, max as dmax } from '@/lib/lsl/engine/decimal';
import { citation } from '@/lib/lsl/engine/citation';
import {
  buildWindow,
  weeklyAverageOverWindow,
} from '@/lib/lsl/engine/lookback';
import { inclusiveDays } from '@/lib/lsl/engine/dates';
import { computeVICDaysNotCountedInLookback, type VICExtraInputs } from '../continuous-service-rules';
import type {
  Citation,
  Employee,
  ISODate,
  Trigger,
} from '@/lib/lsl/engine/types';

/**
 * VIC value-of-week per ss.15, 16, 17.
 *
 * Three paths:
 *   1. Fixed-rate (s.15(1)) — employee has a fixed ordinary time rate of pay;
 *      use currentWeeklyGross directly. Detected by stable wage history
 *      (gross CV < ambiguity threshold) for non-casual employees.
 *   2. Varied-rate (s.15(2)) — greater of (52-wk avg, 260-wk avg, whole-period
 *      avg). Used for commission, piece-work, varied-rate employees. The
 *      same s.15(2) maths is used by s.16(1)(b) when hours have changed in
 *      the last 104 weeks for a fixed-rate employee (per TBD-VIC-11).
 *   3. Workers Comp (s.17) — greater of (pre-injury rate, current rate). The
 *      pre-injury rate is supplied via `employee.extraInputs.preInjuryWeeklyRate`.
 *
 * Death trigger override (s.10(3)(b)): for the death termination reason, the
 * ordinary pay is the 52-week average IMMEDIATELY BEFORE DEATH. This
 * overrides the s.15(2) 3-tier greater-of for death cases only.
 *
 * Sources: VIC LSL Act 2018 ss.15, 16, 17; APA LSL Masterclass PDF pp.39-42.
 */

export interface ValueOfWeekResult {
  value: Decimal;
  /** Path taken — for diagnostics. */
  path: 'fixed-rate' | 'varied-rate-3tier' | 'workers-comp' | 'death-52wk';
  /** Diagnostics — populated for the varied-rate path. */
  weeklyAvg52w?: Decimal;
  weeklyAvg260w?: Decimal;
  weeklyAvgWhole?: Decimal;
  daysNotCountedInLookback?: { window52w: number; window260w: number; windowWhole: number };
  citations: Citation[];
}

interface VICExtraInputsValueOfWeek extends VICExtraInputs {
  /** s.17(2) — pre-injury weekly rate for workers-comp ordinary-pay determination. */
  preInjuryWeeklyRate?: number | string;
  /** s.17(2) — pre-injury hours-per-week (for diagnostics only; v1 uses rate directly). */
  preInjuryWeeklyHours?: number;
}

function readExtras(employee: Employee): VICExtraInputsValueOfWeek {
  return (employee.extraInputs ?? {}) as VICExtraInputsValueOfWeek;
}

/**
 * Decide if the employee should be on the s.15(2) 3-tier averaging path.
 *
 * Per TBD-VIC-11:
 *   - Casual employees → varied-rate (s.16 hours averaging, applied as
 *     s.15(2) on gross because hours are not collected in v1).
 *   - Wage history with gross variation > threshold → varied-rate (s.15(2)
 *     direct on gross). Catches commission, piece-work, and hours-changed
 *     within 104 weeks for fixed-rate employees (s.16(1)(b)).
 *   - Otherwise → fixed-rate (s.15(1)) — uses currentWeeklyGross.
 *
 * The wage-history variation check uses a simple coefficient-of-variation
 * heuristic: compute per-period weekly-normalised gross, then std/mean.
 */
function isVariedRate(employee: Employee): boolean {
  if (employee.employmentType === 'casual') return true;
  if (employee.categoryOverride === 'C' && employee.categoryOverrideConfirmed)
    return true;
  if (employee.wageHistory.length < 2) return false;
  // Compute weekly-normalised gross for each period.
  const weeklies = employee.wageHistory.map((p) => {
    const days =
      p.periodDays ??
      inclusiveDays(p.periodStart, p.periodEnd);
    if (days === 0) return new Decimal(0);
    return d(p.grossPay).times(7).dividedBy(days);
  });
  const mean = weeklies.reduce<Decimal>((a, b) => a.plus(b), new Decimal(0)).dividedBy(
    weeklies.length
  );
  if (mean.isZero()) return false;
  const variance = weeklies
    .reduce<Decimal>((a, v) => a.plus(v.minus(mean).pow(2)), new Decimal(0))
    .dividedBy(weeklies.length);
  const stddev = variance.sqrt();
  const cv = stddev.dividedBy(mean);
  return cv.gt('0.05');
}

/**
 * Build a whole-period window from effective service start to prescribed date.
 */
function buildWholePeriodWindow(
  effectiveServiceStart: ISODate,
  prescribedDate: ISODate
): { start: ISODate; end: ISODate; totalDays: number } {
  return {
    start: effectiveServiceStart,
    end: prescribedDate,
    totalDays: inclusiveDays(effectiveServiceStart, prescribedDate),
  };
}

export function valueOfWeekVIC(
  employee: Employee,
  trigger: Trigger,
  prescribedDate: ISODate,
  effectiveServiceStart: ISODate
): ValueOfWeekResult {
  const citations: Citation[] = [];
  const extras = readExtras(employee);

  // ── Death trigger override (s.10(3)(b)): 52-wk avg immediately before death.
  if (trigger.kind === 'termination' && trigger.reason === 'death') {
    const window52 = buildWindow(prescribedDate, 1);
    const dnc52 = computeVICDaysNotCountedInLookback(
      window52.start,
      window52.end,
      employee.serviceEvents,
      employee.employmentType,
      extras
    );
    const avg52 = weeklyAverageOverWindow(employee.wageHistory, window52, dnc52);
    citations.push(
      citation(
        'VIC LSL Act 2018 s.10(3)(b)',
        'ordinary-pay.death-52wk-avg-immediately-before-death',
        43
      )
    );
    citations.push(
      citation(
        'VIC LSL Act 2018 s.10',
        'trigger.termination.death.estate-payable',
        43
      )
    );
    // If 52-wk avg is zero (rare — no wage history in window), fall back to currentWeeklyGross.
    const value = avg52.isZero() ? d(employee.currentWeeklyGross) : avg52;
    return {
      value,
      path: 'death-52wk',
      weeklyAvg52w: avg52,
      citations,
    };
  }

  // ── Workers Comp override (s.17(2)): greater of pre-injury / current rate.
  const onWorkersComp = employee.serviceEvents.some(
    (e) => e.type === 'workers_comp_absence' && (e.endDate === undefined || e.endDate === null)
  );
  if (onWorkersComp && extras.preInjuryWeeklyRate !== undefined) {
    const current = d(employee.currentWeeklyGross);
    const preInjury = d(extras.preInjuryWeeklyRate);
    if (preInjury.gte(current)) {
      citations.push(
        citation(
          'VIC LSL Act 2018 s.17(2)',
          'ordinary-pay.workers-comp-higher-of-rates',
          39
        )
      );
      return { value: preInjury, path: 'workers-comp', citations };
    }
    citations.push(
      citation(
        'VIC LSL Act 2018 s.17(2)',
        'ordinary-pay.workers-comp-higher-of-rates-current-wins',
        39
      )
    );
    return { value: current, path: 'workers-comp', citations };
  }

  // ── Varied-rate path: 3-tier greater-of averages per s.15(2).
  if (isVariedRate(employee)) {
    const window52 = buildWindow(prescribedDate, 1);
    const window260 = buildWindow(prescribedDate, 5);
    const wholeWindow = buildWholePeriodWindow(effectiveServiceStart, prescribedDate);
    const dnc52 = computeVICDaysNotCountedInLookback(
      window52.start,
      window52.end,
      employee.serviceEvents,
      employee.employmentType,
      extras
    );
    const dnc260 = computeVICDaysNotCountedInLookback(
      window260.start,
      window260.end,
      employee.serviceEvents,
      employee.employmentType,
      extras
    );
    const dncWhole = computeVICDaysNotCountedInLookback(
      wholeWindow.start,
      wholeWindow.end,
      employee.serviceEvents,
      employee.employmentType,
      extras
    );
    const avg52 = weeklyAverageOverWindow(employee.wageHistory, window52, dnc52);
    const avg260 = weeklyAverageOverWindow(employee.wageHistory, window260, dnc260);
    const avgWhole = weeklyAverageOverWindow(
      employee.wageHistory,
      wholeWindow,
      dncWhole
    );

    let value = dmax(avg52, dmax(avg260, avgWhole));
    let winnerRule = 'ordinary-pay.greater-of-52wk-avg';
    let winnerSection = 'VIC LSL Act 2018 s.15(2)(a)';
    if (value.eq(avg260) && !value.eq(avg52)) {
      winnerRule = 'ordinary-pay.greater-of-260wk-avg';
      winnerSection = 'VIC LSL Act 2018 s.15(2)(b)';
    } else if (value.eq(avgWhole) && !value.eq(avg52) && !value.eq(avg260)) {
      winnerRule = 'ordinary-pay.greater-of-whole-period-avg';
      winnerSection = 'VIC LSL Act 2018 s.15(2)(c)';
    }
    citations.push(citation(winnerSection, winnerRule, 39));

    // For casuals, emit s.16 hours-averaging citation as well.
    if (employee.employmentType === 'casual') {
      citations.push(
        citation(
          'VIC LSL Act 2018 s.16',
          'ordinary-pay.varied-hours-casual',
          41
        )
      );
      citations.push(
        citation(
          'VIC LSL Act 2018 s.16(1)(b)',
          'ordinary-pay.varied-hours-casual',
          41
        )
      );
    } else {
      // Non-casual varied-rate (commission, piece, or fixed-rate-with-hours-changed):
      // s.16(1)(b) applies if hours changed in last 104 wks; otherwise pure s.15(2).
      citations.push(
        citation(
          'VIC LSL Act 2018 s.16(1)(b)',
          'ordinary-pay.hours-changed-in-last-104wks',
          41
        )
      );
    }

    return {
      value,
      path: 'varied-rate-3tier',
      weeklyAvg52w: avg52,
      weeklyAvg260w: avg260,
      weeklyAvgWhole: avgWhole,
      daysNotCountedInLookback: {
        window52w: dnc52,
        window260w: dnc260,
        windowWhole: dncWhole,
      },
      citations,
    };
  }

  // ── Fixed-rate path (s.15(1)).
  const fixed = d(employee.currentWeeklyGross);
  citations.push(
    citation('VIC LSL Act 2018 s.15(1)', 'ordinary-pay.fixed-rate', 39)
  );
  return {
    value: fixed,
    path: 'fixed-rate',
    citations,
  };
}

/** value-of-day = value-of-week / 5 — standard 5-day work week. */
export function valueOfDayVIC(valueOfWeek: Decimal): Decimal {
  return valueOfWeek.dividedBy(5);
}
