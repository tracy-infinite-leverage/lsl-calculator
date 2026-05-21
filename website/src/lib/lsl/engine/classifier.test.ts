import { describe, it, expect } from 'vitest';
import { asISODate, type Employee } from './types';
import { classify } from './classifier';

function baseEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 't',
    startDate: asISODate('2015-01-01'),
    employmentType: 'full_time',
    statesOfService: ['NSW'],
    currentWeeklyGross: 1500,
    wageHistory: [],
    serviceEvents: [],
    ...overrides,
  };
}

describe('classifier', () => {
  it('full_time stable gross → A unambiguously', () => {
    const e = baseEmployee({
      employmentType: 'full_time',
      wageHistory: Array.from({ length: 52 }, (_, i) => ({
        periodStart: asISODate('2025-01-01'),
        periodEnd: asISODate('2025-01-07'),
        grossPay: 1900,
        frequency: 'weekly' as const,
      })),
    });
    const r = classify(e);
    expect(r.category).toBe('A');
    expect(r.ambiguous).toBe(false);
  });

  it('casual → B by default', () => {
    const e = baseEmployee({
      employmentType: 'casual',
      wageHistory: [
        {
          periodStart: asISODate('2025-01-01'),
          periodEnd: asISODate('2025-12-31'),
          grossPay: 50000,
          frequency: 'other' as const,
          periodDays: 365,
        },
      ],
    });
    const r = classify(e);
    expect(r.category).toBe('B');
  });

  it('part_time low CV → A unambiguously', () => {
    const e = baseEmployee({
      employmentType: 'part_time',
      wageHistory: Array.from({ length: 5 }, () => ({
        periodStart: asISODate('2025-01-01'),
        periodEnd: asISODate('2025-01-07'),
        grossPay: 1000,
        frequency: 'weekly' as const,
      })),
    });
    const r = classify(e);
    expect(r.category).toBe('A');
    expect(r.ambiguous).toBe(false);
  });

  it('part_time borderline CV (0.05<CV≤0.10) → A but ambiguous', () => {
    // ~8% CV: 1000, 1080, 1100, 920, 900 — std/mean ~ 0.085
    const e = baseEmployee({
      employmentType: 'part_time',
      wageHistory: [1000, 1080, 1100, 920, 900].map((g) => ({
        periodStart: asISODate('2025-01-01'),
        periodEnd: asISODate('2025-01-07'),
        grossPay: g,
        frequency: 'weekly' as const,
      })),
    });
    const r = classify(e);
    expect(r.category).toBe('A');
    expect(r.ambiguous).toBe(true);
  });

  it('part_time high CV → B', () => {
    const e = baseEmployee({
      employmentType: 'part_time',
      wageHistory: [500, 1500, 800, 1200, 600].map((g) => ({
        periodStart: asISODate('2025-01-01'),
        periodEnd: asISODate('2025-01-07'),
        grossPay: g,
        frequency: 'weekly' as const,
      })),
    });
    const r = classify(e);
    expect(r.category).toBe('B');
  });

  it('user override C wins (e.g. piece-worker / commission)', () => {
    const e = baseEmployee({
      employmentType: 'full_time',
      categoryOverride: 'C',
      categoryOverrideConfirmed: true,
    });
    const r = classify(e);
    expect(r.category).toBe('C');
    expect(r.ambiguous).toBe(false);
  });

  it('full_time with high gross CV → A but ambiguous (might be C)', () => {
    const e = baseEmployee({
      employmentType: 'full_time',
      wageHistory: [71600, 75000, 69997, 75102, 68363].map((g) => ({
        periodStart: asISODate('2024-01-01'),
        periodEnd: asISODate('2024-12-31'),
        grossPay: g,
        frequency: 'other' as const,
        periodDays: 365,
      })),
    });
    const r = classify(e);
    expect(r.category).toBe('A');
    // Rinaldo's CV ~0.042 — not above 0.10, so not ambiguous on gross alone.
    expect(r.ambiguous).toBe(false);
  });
});
