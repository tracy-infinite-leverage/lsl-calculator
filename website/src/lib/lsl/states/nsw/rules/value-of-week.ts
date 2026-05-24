import { Decimal, d } from '@/lib/lsl/engine/decimal';
import { citation } from '@/lib/lsl/engine/citation';
import {
  buildWindow,
  weeklyAverageOverWindow,
} from '@/lib/lsl/engine/lookback';
import { computeDaysNotCountedInLookback } from '@/lib/lsl/engine/continuous-service';
import type {
  Category,
  Citation,
  Employee,
  ISODate,
} from '@/lib/lsl/engine/types';
import { NSW_SERVICE_PROFILE } from '../continuous-service-rules';

export interface ValueOfWeekResult {
  value: Decimal;
  weeklyAvg12mo: Decimal;
  weeklyAvg5yr: Decimal;
  daysNotCountedInLookback: { window12mo: number; window5yr: number };
  citations: Citation[];
}

/**
 * NSW LSA s.4(5): "value of a week" for the three pay-pattern categories.
 *
 * Per spec v0.5.0 §F8:
 *   - Category A: greater of (current_weekly_gross, 5-year average weekly gross) — s.4(5)(b)
 *   - Category B: greater of (12-month avg, 5-year avg) — s.4(5)(c)
 *   - Category C: greater of (12-month avg, 5-year avg) — s.4(5)(d)
 *
 * v1 uses gross-only inputs (no hours collected) — Categories B and C share the same math;
 * citations distinguish them.
 */
export function valueOfWeekNSW(
  employee: Employee,
  category: Category,
  prescribedDate: ISODate
): ValueOfWeekResult {
  const window12 = buildWindow(prescribedDate, 1);
  const window5 = buildWindow(prescribedDate, 5);

  const dnc12 = computeDaysNotCountedInLookback(
    window12.start,
    window12.end,
    employee.serviceEvents,
    NSW_SERVICE_PROFILE
  );
  const dnc5 = computeDaysNotCountedInLookback(
    window5.start,
    window5.end,
    employee.serviceEvents,
    NSW_SERVICE_PROFILE
  );

  const avg12 = weeklyAverageOverWindow(employee.wageHistory, window12, dnc12);
  const avg5 = weeklyAverageOverWindow(employee.wageHistory, window5, dnc5);
  const current = d(employee.currentWeeklyGross);

  const citations: Citation[] = [];
  let value: Decimal;

  if (category === 'A') {
    // Category A: greater of (current, 5-year avg)
    if (current.gte(avg5)) {
      value = current;
      citations.push(
        citation('NSW LSA s.4(5)(b)', 'value-of-week.A.current', 18)
      );
    } else {
      value = avg5;
      citations.push(
        citation('NSW LSA s.4(5)(b)', 'value-of-week.A.5yr-greater-of', 18)
      );
    }
    citations.push(
      citation('NSW LSA s.3(2)', 'ordinary-pay-definition', 18)
    );
  } else if (category === 'B') {
    // Category B: greater of (12-month avg, 5-year avg) [fall-through to C math per spec v0.5.0 §F8]
    if (avg12.gte(avg5)) {
      value = avg12;
      citations.push(
        citation(
          'NSW LSA s.4(5)(c)',
          'value-of-week.B.12mo-greater-of',
          19,
          'Cat B math = Cat C math per spec v0.5.0 §F8 — hours not collected, gross-only fall-through'
        )
      );
    } else {
      value = avg5;
      citations.push(
        citation(
          'NSW LSA s.4(5)(c)',
          'value-of-week.B.5yr-greater-of',
          19,
          'Cat B math = Cat C math per spec v0.5.0 §F8'
        )
      );
    }
  } else {
    // Category C: greater of (12-month avg, 5-year avg)
    if (avg12.gte(avg5)) {
      value = avg12;
      citations.push(
        citation('NSW LSA s.4(5)(d)', 'value-of-week.C.12mo-greater-of', 21)
      );
    } else {
      value = avg5;
      citations.push(
        citation('NSW LSA s.4(5)(d)', 'value-of-week.C.5yr-greater-of', 21)
      );
    }
  }

  // Lookback-denominator citation when any days were excluded
  if (dnc12 > 0 || dnc5 > 0) {
    citations.push(
      citation('NSW LSA s.4(5)', 'lookback.days-not-counted', 19)
    );
  }

  return {
    value,
    weeklyAvg12mo: avg12,
    weeklyAvg5yr: avg5,
    daysNotCountedInLookback: { window12mo: dnc12, window5yr: dnc5 },
    citations,
  };
}

/** value-of-day = value-of-week / 5 for the standard full-time case. */
export function valueOfDayNSW(valueOfWeek: Decimal): Decimal {
  return valueOfWeek.dividedBy(5);
}

