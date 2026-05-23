import { Decimal, d, mul } from './decimal';
import { inclusiveDays, overlapDays, subtractYears } from './dates';
import type { ISODate, WagePeriod } from './types';

export interface LookbackWindow {
  start: ISODate;
  end: ISODate;
  /** Inclusive day count between start and end. */
  totalDays: number;
}

/**
 * Build a lookback window of N years ending at prescribedDate (inclusive).
 * For an N-year window ending at `end`, the start is `end - N years + 1 day`.
 * Inclusive day count then is `N × 365 + leap_days_in_window`.
 */
export function buildWindow(prescribedDate: ISODate, years: number): LookbackWindow {
  // start = subtractYears(end, N) + 1 day
  // Using subtractYears(end, N) gives same-day-N-years-prior; we add 1 day for inclusive.
  const sameMonthDayNYrsPrior = subtractYears(prescribedDate, years);
  // The window is (subtract date + 1 day) → end, inclusive.
  // To compute "subtract + 1 day", just iterate using inclusiveDays math.
  // Simpler: window length = N * 365 + leap days. We compute totalDays via inclusiveDays.
  const totalDays = inclusiveDays(sameMonthDayNYrsPrior, prescribedDate);
  // The window is `(sameMonthDayNYrsPrior+1)..prescribedDate`, length = totalDays - 1... wait:
  // inclusiveDays(sameMonth, prescribed) = N × 365 + leap_days + 1 (if same calendar date).
  // For 5-year window ending 2026-05-21: sameMonth = 2021-05-21. Inclusive = 1827 (5*365 + 2 leaps + 1?)
  // Let me verify: 2021-05-21 → 2026-05-21 inclusive = 5 yrs + 1 day. With leap 2024 → 1827 days.
  // The intended window is 2021-05-22 → 2026-05-21 (1826 days). So start = sameMonth + 1 day.
  const start = addOneDay(sameMonthDayNYrsPrior);
  const windowDays = inclusiveDays(start, prescribedDate);
  return { start, end: prescribedDate, totalDays: windowDays };
}

function addOneDay(iso: ISODate): ISODate {
  const dt = new Date(Date.UTC(
    Number(iso.slice(0, 4)),
    Number(iso.slice(5, 7)) - 1,
    Number(iso.slice(8, 10))
  ));
  dt.setUTCDate(dt.getUTCDate() + 1);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}` as ISODate;
}

/**
 * Compute the weekly average over a lookback window.
 *
 * Formula (per spec F8, F3a, research brief §1.2):
 *   weekly_avg = sum(gross_in_window) × 7 / (window_days - days_not_counted)
 *
 * Each wage row's contribution = grossPay × (overlap_days_with_window / row_days_total).
 */
export function weeklyAverageOverWindow(
  wageHistory: WagePeriod[],
  window: LookbackWindow,
  daysNotCounted: number
): Decimal {
  let sumGross = new Decimal(0);

  for (const row of wageHistory) {
    const rowDays = row.periodDays ?? inclusiveDays(row.periodStart, row.periodEnd);
    if (rowDays === 0) continue;
    const overlap = overlapDays(
      row.periodStart,
      row.periodEnd,
      window.start,
      window.end
    );
    if (overlap === 0) continue;

    const gross = d(row.grossPay);
    if (overlap === rowDays) {
      // Whole row within window — no proration
      sumGross = sumGross.plus(gross);
    } else {
      // Proportional fraction
      sumGross = sumGross.plus(gross.times(overlap).dividedBy(rowDays));
    }
  }

  const denominator = window.totalDays - daysNotCounted;
  if (denominator <= 0) {
    return new Decimal(0);
  }

  return mul(sumGross, 7).dividedBy(denominator);
}
