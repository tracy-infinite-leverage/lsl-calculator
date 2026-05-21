import { Decimal, d, div, mul } from './decimal';
import { inclusiveDays } from './dates';
import type { PayFrequency, WagePeriod, Warning } from './types';

export interface NormalisedPeriod {
  periodStart: WagePeriod['periodStart'];
  periodEnd: WagePeriod['periodEnd'];
  grossPay: Decimal;
  /** Computed period length in days (inclusive). */
  periodDays: number;
  /** Weekly-normalised gross for this period. */
  weeklyGross: Decimal;
  frequency: PayFrequency;
}

export interface NormaliseResult {
  periods: NormalisedPeriod[];
  warnings: Warning[];
}

/**
 * Per F3a: normalise pay-period gross totals to a weekly average.
 *   - weekly: weekly_gross = period_total
 *   - fortnightly: weekly_gross = period_total / 2
 *   - monthly: weekly_gross = period_total × 12 / 52
 *   - other: weekly_gross = period_total × 7 / period_days
 *
 * Mixed-frequency wage histories surface a warning.
 */
export function normaliseWageHistory(periods: WagePeriod[]): NormaliseResult {
  const warnings: Warning[] = [];
  const out: NormalisedPeriod[] = [];

  const seenFreqs = new Set<PayFrequency>();

  for (const p of periods) {
    seenFreqs.add(p.frequency);
    const gross = d(p.grossPay);
    const periodDays =
      p.periodDays !== undefined ? p.periodDays : inclusiveDays(p.periodStart, p.periodEnd);

    let weekly: Decimal;
    switch (p.frequency) {
      case 'weekly':
        weekly = gross;
        break;
      case 'fortnightly':
        weekly = div(gross, 2);
        break;
      case 'monthly':
        weekly = div(mul(gross, 12), 52);
        break;
      case 'other':
        if (!p.periodDays || p.periodDays <= 0) {
          throw new Error(
            `WagePeriod with frequency=other requires positive periodDays (${p.periodStart}..${p.periodEnd})`
          );
        }
        weekly = div(mul(gross, 7), p.periodDays);
        break;
    }

    out.push({
      periodStart: p.periodStart,
      periodEnd: p.periodEnd,
      grossPay: gross,
      periodDays,
      weeklyGross: weekly,
      frequency: p.frequency,
    });
  }

  if (seenFreqs.size > 1) {
    warnings.push({
      code: 'mixed_frequency',
      message: `Wage history contains ${seenFreqs.size} distinct pay frequencies; normalised per segment.`,
    });
  }

  return { periods: out, warnings };
}

/** Inferred frequency from period gaps; high confidence if all gaps consistent. */
export function inferFrequency(
  periods: Pick<WagePeriod, 'periodStart' | 'periodEnd'>[]
): { frequency: PayFrequency | null; confidence: 'high' | 'low' } {
  if (periods.length === 0) return { frequency: null, confidence: 'low' };
  const lens = periods.map((p) => inclusiveDays(p.periodStart, p.periodEnd));
  const allEqual = lens.every((x) => x === lens[0]);
  const len = lens[0];

  if (!allEqual) return { frequency: null, confidence: 'low' };
  if (len === 7) return { frequency: 'weekly', confidence: 'high' };
  if (len === 14) return { frequency: 'fortnightly', confidence: 'high' };
  if (len >= 28 && len <= 31) return { frequency: 'monthly', confidence: 'high' };
  return { frequency: 'other', confidence: 'low' };
}
