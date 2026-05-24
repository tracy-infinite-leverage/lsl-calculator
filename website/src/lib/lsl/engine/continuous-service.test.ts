import { describe, it, expect } from 'vitest';
import { asISODate } from './types';
import {
  computeContinuousService,
  computeDaysNotCountedInLookback,
} from './continuous-service';
import { NSW_SERVICE_PROFILE } from '../states/nsw/continuous-service-rules';

const P = NSW_SERVICE_PROFILE;

describe('computeContinuousService', () => {
  it('clean 10-yr employee (2016-05-21 → 2026-05-21 = 3653 days)', () => {
    const r = computeContinuousService(
      asISODate('2016-05-21'),
      asISODate('2026-05-21'),
      [],
      P
    );
    expect(r.daysOfContinuousService).toBe(3653);
    expect(r.yearsOfContinuousService.toFixed(4)).toBe('10.0014'); // 3653 / 365.25
  });

  it('AC9: 1-year UPL excludes 365 days from service', () => {
    const r = computeContinuousService(
      asISODate('2014-07-01'),
      asISODate('2025-07-01'),
      [
        {
          type: 'unpaid_parental_leave',
          startDate: asISODate('2017-07-01'),
          endDate: asISODate('2018-07-01'),
        },
      ],
      P
    );
    // elapsed 2014-07-01 → 2025-07-01 inclusive = 4019 days (incl 3 leap days: 2016, 2020, 2024)
    // UPL: 2017-07-01 → 2018-07-01 inclusive = 366 days
    // Service = 4019 - 366 = 3653 → ~10.00 yrs
    expect(r.daysNotCountedInService).toBe(366);
    expect(r.yearsOfContinuousService.toFixed(2)).toBe('10.00');
  });

  it('AC10: Workers Comp counts as service (not subtracted)', () => {
    const r = computeContinuousService(
      asISODate('2014-05-21'),
      asISODate('2026-05-21'),
      [
        {
          type: 'workers_comp_absence',
          startDate: asISODate('2026-03-01'),
          endDate: asISODate('2026-03-15'),
        },
      ],
      P
    );
    expect(r.daysNotCountedInService).toBe(0);
  });

  it('employer rehire gap > 60 days breaks service; start moves to rehire date', () => {
    const r = computeContinuousService(
      asISODate('2014-07-15'),
      asISODate('2026-05-21'),
      [
        {
          type: 'employer_initiated_termination_and_rehire',
          startDate: asISODate('2025-11-22'),
          endDate: asISODate('2026-02-22'), // 93-day gap
        },
      ],
      P
    );
    expect(r.effectiveServiceStart).toBe('2026-02-22');
    // 2026-02-22 → 2026-05-21 inclusive = 89 days
    expect(r.daysOfContinuousService).toBe(89);
    expect(r.warnings.some((w) => w.code === 'gap_exceeds_2mo')).toBe(true);
  });

  it('employer rehire gap ≤ 60 days preserves service; gap days excluded', () => {
    const r = computeContinuousService(
      asISODate('2015-04-01'),
      asISODate('2026-05-21'),
      [
        {
          type: 'employer_initiated_termination_and_rehire',
          startDate: asISODate('2026-03-15'),
          endDate: asISODate('2026-04-12'), // 29-day gap
        },
      ],
      P
    );
    expect(r.effectiveServiceStart).toBe('2015-04-01');
    // elapsed 2015-04-01 → 2026-05-21 = 4068 days; minus 29 day gap = 4039
    expect(r.daysNotCountedInService).toBe(29);
  });

  it('rehire gap exactly 60 days = at threshold (preserved, warning)', () => {
    const r = computeContinuousService(
      asISODate('2015-04-01'),
      asISODate('2026-05-21'),
      [
        {
          type: 'employer_initiated_termination_and_rehire',
          startDate: asISODate('2026-03-15'),
          endDate: asISODate('2026-05-13'), // 60-day gap inclusive
        },
      ],
      P
    );
    expect(r.effectiveServiceStart).toBe('2015-04-01');
    expect(r.warnings.some((w) => w.code === 'rehire_gap_at_threshold')).toBe(true);
  });

  it('voluntary resignation reset handled by setting startDate to rehire date (no event needed)', () => {
    const r = computeContinuousService(
      asISODate('2025-12-01'),
      asISODate('2026-05-21'),
      [],
      P
    );
    expect(r.daysOfContinuousService).toBe(172);
    expect(r.yearsOfContinuousService.toFixed(4)).toBe('0.4709');
  });

  it('transfer of business preserves prior service (no day-effect)', () => {
    const r = computeContinuousService(
      asISODate('2014-05-21'),
      asISODate('2026-05-21'),
      [
        {
          type: 'transfer_of_business',
          startDate: asISODate('2021-07-01'),
        },
      ],
      P
    );
    expect(r.daysNotCountedInService).toBe(0);
    // Citation surfaced
    expect(
      r.citations.some(
        (c) => c.rule === 'continuous-service.transfer-of-business-preserves'
      )
    ).toBe(true);
  });

  it('apprentice-to-trade within 12 months preserves service; gap subtracted', () => {
    const r = computeContinuousService(
      asISODate('2018-07-01'),
      asISODate('2026-05-21'),
      [
        {
          type: 'apprentice_to_tradesperson_transition',
          startDate: asISODate('2024-06-30'),
          endDate: asISODate('2024-10-01'), // 94-day gap
        },
      ],
      P
    );
    expect(r.effectiveServiceStart).toBe('2018-07-01');
    expect(r.daysNotCountedInService).toBe(94);
  });

  it('JobKeeper counts as service (not subtracted)', () => {
    const r = computeContinuousService(
      asISODate('2018-03-15'),
      asISODate('2026-05-21'),
      [
        {
          type: 'jobkeeper_or_covid_standdown',
          startDate: asISODate('2020-04-01'),
          endDate: asISODate('2020-09-27'),
        },
      ],
      P
    );
    expect(r.daysNotCountedInService).toBe(0);
  });

  it('industrial action excluded from service', () => {
    const r = computeContinuousService(
      asISODate('2016-05-22'),
      asISODate('2026-05-21'),
      [
        {
          type: 'industrial_action',
          startDate: asISODate('2025-06-01'),
          endDate: asISODate('2025-06-08'),
        },
      ],
      P
    );
    expect(r.daysNotCountedInService).toBe(8);
  });

  it('employer_stand_down (slackness) excluded from service', () => {
    const r = computeContinuousService(
      asISODate('2014-05-21'),
      asISODate('2026-05-21'),
      [
        {
          type: 'employer_stand_down',
          startDate: asISODate('2024-03-01'),
          endDate: asISODate('2024-05-01'), // 62 days
        },
      ],
      P
    );
    expect(r.daysNotCountedInService).toBe(62);
  });
});

describe('computeDaysNotCountedInLookback', () => {
  it('paid_leave does NOT subtract from lookback denom', () => {
    const days = computeDaysNotCountedInLookback(
      asISODate('2025-05-22'),
      asISODate('2026-05-21'),
      [
        {
          type: 'paid_leave',
          startDate: asISODate('2026-01-05'),
          endDate: asISODate('2026-01-23'),
        },
      ],
      P
    );
    expect(days).toBe(0);
  });

  it('workers_comp DOES subtract from lookback denom', () => {
    const days = computeDaysNotCountedInLookback(
      asISODate('2025-05-22'),
      asISODate('2026-05-21'),
      [
        {
          type: 'workers_comp_absence',
          startDate: asISODate('2026-03-01'),
          endDate: asISODate('2026-03-14'), // 14 days
        },
      ],
      P
    );
    expect(days).toBe(14);
  });

  it('UPL outside window does not subtract', () => {
    const days = computeDaysNotCountedInLookback(
      asISODate('2021-05-22'),
      asISODate('2026-05-21'),
      [
        {
          type: 'unpaid_parental_leave',
          startDate: asISODate('2017-07-01'),
          endDate: asISODate('2018-07-01'),
        },
      ],
      P
    );
    expect(days).toBe(0);
  });

  it('JobKeeper subtracts from lookback denom (PDF p.19)', () => {
    const days = computeDaysNotCountedInLookback(
      asISODate('2020-01-01'),
      asISODate('2021-12-31'),
      [
        {
          type: 'jobkeeper_or_covid_standdown',
          startDate: asISODate('2020-04-01'),
          endDate: asISODate('2020-09-27'),
        },
      ],
      P
    );
    // 2020-04-01 to 2020-09-27 inclusive
    expect(days).toBe(180);
  });

  it('rehire-gap subtracts from lookback denom (no income)', () => {
    const days = computeDaysNotCountedInLookback(
      asISODate('2025-05-22'),
      asISODate('2026-05-21'),
      [
        {
          type: 'employer_initiated_termination_and_rehire',
          startDate: asISODate('2026-03-15'),
          endDate: asISODate('2026-04-12'),
        },
      ],
      P
    );
    expect(days).toBe(29);
  });
});
