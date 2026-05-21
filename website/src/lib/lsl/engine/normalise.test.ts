import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { asISODate, type WagePeriod } from './types';
import { normaliseWageHistory, inferFrequency } from './normalise';
import { displayAUD } from './decimal';

describe('normaliseWageHistory — AC4 (equivalent at weekly/fortnightly/monthly)', () => {
  it('weekly $5,200 → $5,200/wk', () => {
    const r = normaliseWageHistory([
      {
        periodStart: asISODate('2025-05-22'),
        periodEnd: asISODate('2025-05-28'),
        grossPay: 5200,
        frequency: 'weekly',
      },
    ]);
    expect(displayAUD(r.periods[0].weeklyGross)).toBe('5200.00');
  });

  it('fortnightly $10,400 → $5,200/wk', () => {
    const r = normaliseWageHistory([
      {
        periodStart: asISODate('2025-05-22'),
        periodEnd: asISODate('2025-06-04'),
        grossPay: 10400,
        frequency: 'fortnightly',
      },
    ]);
    expect(displayAUD(r.periods[0].weeklyGross)).toBe('5200.00');
  });

  it('monthly $22,533.33 → ~$5,200/wk (within rounding)', () => {
    const r = normaliseWageHistory([
      {
        periodStart: asISODate('2025-05-01'),
        periodEnd: asISODate('2025-05-31'),
        grossPay: 22533.33,
        frequency: 'monthly',
      },
    ]);
    expect(displayAUD(r.periods[0].weeklyGross)).toBe('5200.00');
  });

  it('other (28-day period) $20,800 → $5,200/wk', () => {
    const r = normaliseWageHistory([
      {
        periodStart: asISODate('2025-05-01'),
        periodEnd: asISODate('2025-05-28'),
        grossPay: 20800,
        frequency: 'other',
        periodDays: 28,
      },
    ]);
    expect(displayAUD(r.periods[0].weeklyGross)).toBe('5200.00');
  });

  it('mixed-frequency surfaces warning', () => {
    const periods: WagePeriod[] = [
      {
        periodStart: asISODate('2025-01-01'),
        periodEnd: asISODate('2025-01-07'),
        grossPay: 5200,
        frequency: 'weekly',
      },
      {
        periodStart: asISODate('2025-02-01'),
        periodEnd: asISODate('2025-02-14'),
        grossPay: 10400,
        frequency: 'fortnightly',
      },
    ];
    const r = normaliseWageHistory(periods);
    expect(r.warnings.some((w) => w.code === 'mixed_frequency')).toBe(true);
  });

  it('other without periodDays throws', () => {
    expect(() =>
      normaliseWageHistory([
        {
          periodStart: asISODate('2025-05-01'),
          periodEnd: asISODate('2025-05-28'),
          grossPay: 20800,
          frequency: 'other',
        },
      ])
    ).toThrow();
  });
});

describe('inferFrequency', () => {
  it('all 7-day gaps → weekly high confidence', () => {
    const periods = [
      { periodStart: asISODate('2025-05-22'), periodEnd: asISODate('2025-05-28') },
      { periodStart: asISODate('2025-05-29'), periodEnd: asISODate('2025-06-04') },
    ];
    expect(inferFrequency(periods)).toEqual({ frequency: 'weekly', confidence: 'high' });
  });

  it('all 14-day gaps → fortnightly high', () => {
    const periods = [
      { periodStart: asISODate('2025-05-22'), periodEnd: asISODate('2025-06-04') },
      { periodStart: asISODate('2025-06-05'), periodEnd: asISODate('2025-06-18') },
    ];
    expect(inferFrequency(periods)).toEqual({ frequency: 'fortnightly', confidence: 'high' });
  });
});

describe('AC4 property test: equivalent gross at any frequency yields ~$5,200/wk', () => {
  it('weekly === fortnightly within 1c', () => {
    fc.assert(
      fc.property(fc.float({ min: 100, max: 10_000, noNaN: true, noDefaultInfinity: true }), (weeklyGross) => {
        const w = normaliseWageHistory([
          {
            periodStart: asISODate('2025-05-22'),
            periodEnd: asISODate('2025-05-28'),
            grossPay: weeklyGross.toString(),
            frequency: 'weekly',
          },
        ]);
        const f = normaliseWageHistory([
          {
            periodStart: asISODate('2025-05-22'),
            periodEnd: asISODate('2025-06-04'),
            grossPay: (weeklyGross * 2).toString(),
            frequency: 'fortnightly',
          },
        ]);
        const diff = w.periods[0].weeklyGross.minus(f.periods[0].weeklyGross).abs();
        expect(diff.lt('0.01')).toBe(true);
      })
    );
  });
});
