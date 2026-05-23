import { describe, it, expect } from 'vitest';
import { asISODate } from './types';
import { inclusiveDays, overlapDays, subtractYears, exclusiveDays } from './dates';

describe('dates', () => {
  it('inclusiveDays: same-day = 1', () => {
    expect(inclusiveDays(asISODate('2026-05-21'), asISODate('2026-05-21'))).toBe(1);
  });

  it('inclusiveDays: 1-year span 2025-05-22 → 2026-05-21 = 365', () => {
    expect(inclusiveDays(asISODate('2025-05-22'), asISODate('2026-05-21'))).toBe(365);
  });

  it('inclusiveDays: 1-year span over leap day 2024-02-28 → 2025-02-27 = 366', () => {
    expect(inclusiveDays(asISODate('2024-02-28'), asISODate('2025-02-27'))).toBe(366);
  });

  it('inclusiveDays: 5-year span 2021-05-22 → 2026-05-21 includes 2024 leap = 1826', () => {
    expect(inclusiveDays(asISODate('2021-05-22'), asISODate('2026-05-21'))).toBe(1826);
  });

  it('overlapDays: full containment = full row days', () => {
    const o = overlapDays(
      asISODate('2025-01-01'),
      asISODate('2025-12-31'),
      asISODate('2024-06-01'),
      asISODate('2026-06-01')
    );
    expect(o).toBe(365);
  });

  it('overlapDays: no overlap = 0', () => {
    const o = overlapDays(
      asISODate('2020-01-01'),
      asISODate('2020-12-31'),
      asISODate('2022-01-01'),
      asISODate('2022-12-31')
    );
    expect(o).toBe(0);
  });

  it('overlapDays: partial overlap', () => {
    const o = overlapDays(
      asISODate('2025-06-01'),
      asISODate('2025-12-31'),
      asISODate('2025-09-01'),
      asISODate('2026-02-28')
    );
    // 2025-09-01 to 2025-12-31 inclusive
    expect(o).toBe(122);
  });

  it('subtractYears: 5-year window start computes correctly', () => {
    expect(subtractYears(asISODate('2026-05-21'), 5)).toBe('2021-05-21');
  });

  it('exclusiveDays: same-day = 0', () => {
    expect(exclusiveDays(asISODate('2026-05-21'), asISODate('2026-05-21'))).toBe(0);
  });
});
