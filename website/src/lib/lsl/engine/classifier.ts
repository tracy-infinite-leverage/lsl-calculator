import { Decimal, d, div } from './decimal';
import type { Category, Employee } from './types';
import { normaliseWageHistory } from './normalise';

export interface ClassifierResult {
  category: Category;
  ambiguous: boolean;
  signals: string[];
}

const BORDERLINE_LOW = 0.05;
const VARIABLE_THRESHOLD = 0.1;

/**
 * Decide pay-pattern category from `employment_type + wage-history period count + gross variance`
 * only (per spec v0.5.0 §5 — no hours signals collected).
 *
 *   - full_time / part_time with low gross CV → Category A
 *   - part_time / casual with gross CV > 0.10 → Category B
 *   - 0.05 < CV ≤ 0.10 → ambiguous=true (borderline)
 *   - Category C is set only via explicit `categoryOverride` (varied-rate work like piece work,
 *     commission — not auto-detectable without hours signals).
 *
 * Per spec v0.5.0 §F8, Categories B and C share the same math; the classifier output drives
 * citation language only.
 */
export function classify(employee: Employee): ClassifierResult {
  const signals: string[] = [];

  // Explicit user override wins.
  if (employee.categoryOverride && employee.categoryOverrideConfirmed) {
    signals.push(`user_override=${employee.categoryOverride}`);
    return {
      category: employee.categoryOverride,
      ambiguous: false,
      signals,
    };
  }

  const cv = grossCV(employee);
  signals.push(`gross_cv=${cv.toFixed(4)}`);
  signals.push(`employment_type=${employee.employmentType}`);

  if (employee.employmentType === 'full_time') {
    // Full-time → A by default. If gross CV high, mark ambiguous (might be C — commission).
    const ambiguous = cv.gt(VARIABLE_THRESHOLD);
    if (ambiguous) signals.push('high_gross_cv_for_full_time');
    return { category: 'A', ambiguous, signals };
  }

  if (employee.employmentType === 'part_time') {
    if (cv.lte(BORDERLINE_LOW)) {
      return { category: 'A', ambiguous: false, signals };
    }
    if (cv.lte(VARIABLE_THRESHOLD)) {
      // Borderline — Category A but ambiguous
      signals.push('borderline_cv');
      return { category: 'A', ambiguous: true, signals };
    }
    return { category: 'B', ambiguous: false, signals };
  }

  // casual
  signals.push('casual_default_B');
  return { category: 'B', ambiguous: false, signals };
}

/** Coefficient of variation of weekly-normalised gross across wage history. */
export function grossCV(employee: Employee): Decimal {
  const { periods } = normaliseWageHistory(employee.wageHistory);
  if (periods.length < 2) return new Decimal(0);
  const weeklies = periods.map((p) => p.weeklyGross);
  const mean = weeklies
    .reduce<Decimal>((acc, v) => acc.plus(v), new Decimal(0))
    .dividedBy(weeklies.length);
  if (mean.isZero()) return new Decimal(0);
  const variance = weeklies
    .reduce<Decimal>(
      (acc, v) => acc.plus(v.minus(mean).pow(2)),
      new Decimal(0)
    )
    .dividedBy(weeklies.length);
  const stddev = variance.sqrt();
  return div(stddev, mean);
}
