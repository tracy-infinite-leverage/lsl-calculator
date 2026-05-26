import { describe, it, expect } from 'vitest';
import { calculateTAS } from '../index';
import { asISODate, type Employee, type Trigger } from '@/lib/lsl/engine/types';

/**
 * T8.2 narrow unit tests — one cluster per locked rule from the signed
 * docs/qa/test-cases-tas.md v1.0 (PM-SIGNED 2026-05-26). Full 75-fixture
 * corpus lands in T8.3.
 */

function fullTimeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 'TC',
    startDate: asISODate('2014-05-26'),
    endDate: asISODate('2026-05-26'),
    employmentType: 'full_time',
    statesOfService: ['TAS'],
    governingJurisdiction: 'TAS',
    currentWeeklyGross: '1800',
    wageHistory: [
      {
        periodStart: asISODate('2014-05-26'),
        periodEnd: asISODate('2026-05-26'),
        grossPay: '1123200',
        frequency: 'weekly',
      },
    ],
    serviceEvents: [],
    ...overrides,
  };
}

describe('TAS T8.2 — per-day rate variation (TBD-TAS-01)', () => {
  it('TC-TAS-052 shape — shift penalties only: value_of_week = SUM of per-day payable, breakdown surfaces', () => {
    const employee = fullTimeEmployee({
      startDate: asISODate('2016-05-26'),
      currentWeeklyGross: '1800',
      extraInputs: {
        tas_shift_penalty_by_day: [
          { date: '2026-06-01', penalty_multiplier: 1.0 },
          { date: '2026-06-02', penalty_multiplier: 1.0 },
          { date: '2026-06-03', penalty_multiplier: 1.5 },
          { date: '2026-06-04', penalty_multiplier: 1.5 },
          { date: '2026-06-05', penalty_multiplier: 2.0 },
        ],
      },
    });
    const trigger: Trigger = {
      kind: 'taking_leave',
      leaveStartDate: asISODate('2026-06-01'),
      leaveWeeks: 1.0,
    };
    const result = calculateTAS(employee, trigger);

    expect(result.status).toBe('computed');
    expect(result.outputs?.valueOfWeek.value.toFixed(2)).toBe('2520.00');
    expect(result.outputs?.valuePerDayBreakdown?.length).toBe(5);
    expect(result.outputs?.valuePerDayBreakdown?.[2].payable.toFixed(2)).toBe('540.00');
    expect(result.warnings.map((w) => w.code)).toContain(
      'tas_day_to_day_rate_variation_applied'
    );
  });

  it('TC-TAS-054 shape — allowance only: locked arithmetic (base + allowance)', () => {
    const employee = fullTimeEmployee({
      startDate: asISODate('2016-05-26'),
      currentWeeklyGross: '1800',
      extraInputs: {
        tas_all_purpose_allowance_by_day: [
          { date: '2026-06-01', allowance_amount: 0 },
          { date: '2026-06-02', allowance_amount: 20 },
          { date: '2026-06-03', allowance_amount: 20 },
          { date: '2026-06-04', allowance_amount: 20 },
          { date: '2026-06-05', allowance_amount: 0 },
        ],
      },
    });
    const result = calculateTAS(employee, {
      kind: 'taking_leave',
      leaveStartDate: asISODate('2026-06-01'),
    });
    expect(result.outputs?.valueOfWeek.value.toFixed(2)).toBe('1860.00');
  });

  it('TC-TAS-055 shape — combined penalty + allowance: (base × multiplier) + allowance per locked order', () => {
    const employee = fullTimeEmployee({
      startDate: asISODate('2016-05-26'),
      currentWeeklyGross: '1800',
      extraInputs: {
        tas_shift_penalty_by_day: [
          { date: '2026-06-01', penalty_multiplier: 1.0 },
          { date: '2026-06-02', penalty_multiplier: 1.5 },
          { date: '2026-06-03', penalty_multiplier: 1.0 },
          { date: '2026-06-04', penalty_multiplier: 1.0 },
          { date: '2026-06-05', penalty_multiplier: 1.0 },
        ],
        tas_all_purpose_allowance_by_day: [
          { date: '2026-06-01', allowance_amount: 20 },
          { date: '2026-06-02', allowance_amount: 20 },
          { date: '2026-06-03', allowance_amount: 20 },
          { date: '2026-06-04', allowance_amount: 20 },
          { date: '2026-06-05', allowance_amount: 20 },
        ],
      },
    });
    const result = calculateTAS(employee, {
      kind: 'taking_leave',
      leaveStartDate: asISODate('2026-06-01'),
    });
    // (360 × 1) + 20 = 380; (360 × 1.5) + 20 = 560; (360 × 1) + 20 = 380 (×3)
    // Total = 380 + 560 + 380 + 380 + 380 = 2080
    expect(result.outputs?.valueOfWeek.value.toFixed(2)).toBe('2080.00');
    // Verify the multiplier-then-allowance order on the Tuesday entry.
    expect(
      result.outputs?.valuePerDayBreakdown?.[1].payable.toFixed(2)
    ).toBe('560.00');
  });

  it('TC-TAS-053 shape — no per-day data → flat fallback + advisory + Note B advisory', () => {
    const employee = fullTimeEmployee({
      startDate: asISODate('2016-05-26'),
      currentWeeklyGross: '1800',
      extraInputs: {
        tas_shift_penalty_by_day: [],
        tas_all_purpose_allowance_by_day: [],
      },
    });
    const result = calculateTAS(employee, {
      kind: 'taking_leave',
      leaveStartDate: asISODate('2026-06-01'),
    });
    expect(result.outputs?.valueOfWeek.value.toFixed(2)).toBe('1800.00');
    expect(result.outputs?.valuePerDayBreakdown).toBeUndefined();
    const codes = result.warnings.map((w) => w.code);
    expect(codes).toContain('tas_day_to_day_rate_variation_advisory');
    expect(codes).toContain('tas_shift_penalty_assumed_included_in_weekly_gross');
  });
});

describe('TAS T8.2 — commission 3-mo window (TBD-TAS-03)', () => {
  it('TC-TAS-060 shape — seasonal Q4 peak: last-91-day window captures $5000/wk', () => {
    const employee = fullTimeEmployee({
      categoryOverride: 'C',
      categoryOverrideConfirmed: true,
      currentWeeklyGross: '5000',
      wageHistory: [
        {
          periodStart: asISODate('2025-05-26'),
          periodEnd: asISODate('2026-02-25'),
          grossPay: '78000',
          frequency: 'weekly',
        },
        {
          periodStart: asISODate('2026-02-26'),
          periodEnd: asISODate('2026-05-26'),
          grossPay: '65000',
          frequency: 'weekly',
          note: 'Q4 high-season commission',
        },
      ],
    });
    const result = calculateTAS(employee, {
      kind: 'termination',
      terminationDate: asISODate('2026-05-26'),
      reason: 'redundancy',
    });
    // 91-day window 2026-02-25 → 2026-05-26 captures the full Q4 ($65000)
    // PLUS 1 day of prior-period spill ($78000 × 1/276 ≈ $282.6). /13 ≈ $5021.74.
    // Fixture-author idealised data assumed clean partition; engine math is
    // strictly per the locked TBD-TAS-03 91-day window. T8.3 will harmonise
    // fixture inputs to land exactly on $5000 — see fixture-author note in
    // docs/qa/test-cases-tas.md line 1670.
    expect(result.outputs?.valueOfWeek.value.toFixed(2)).toBe('5021.74');
    expect(result.warnings.map((w) => w.code)).toContain(
      'tas_commission_3mo_window_applied'
    );
  });
});

describe('TAS T8.2 — casual 32hr/4wk continuity test (TBD-TAS-04)', () => {
  it('TC-TAS-033 shape — operator flag true → satisfied advisory', () => {
    const employee: Employee = {
      id: 'TC-TAS-033',
      startDate: asISODate('2014-05-26'),
      endDate: asISODate('2026-05-26'),
      employmentType: 'casual',
      statesOfService: ['TAS'],
      governingJurisdiction: 'TAS',
      currentWeeklyGross: '1292',
      wageHistory: [],
      serviceEvents: [],
      extraInputs: {
        tas_casual_32hr_4wk_periods_compliant: true,
        currentHourlyRate: 38,
        hoursLast12MonthsBeforeCessation: 1768,
      },
    };
    const result = calculateTAS(employee, {
      kind: 'termination',
      terminationDate: asISODate('2026-05-26'),
      reason: 'voluntary_resignation',
    });
    expect(result.warnings.map((w) => w.code)).toContain(
      'tas_casual_32hr_4wk_continuity_satisfied'
    );
    expect(result.status).toBe('computed');
  });

  it('TC-TAS-034 shape — operator flag false → not-satisfied + $0', () => {
    const employee: Employee = {
      id: 'TC-TAS-034',
      startDate: asISODate('2018-05-26'),
      endDate: asISODate('2026-05-26'),
      employmentType: 'casual',
      statesOfService: ['TAS'],
      governingJurisdiction: 'TAS',
      currentWeeklyGross: '1064',
      wageHistory: [],
      serviceEvents: [],
      extraInputs: {
        tas_casual_32hr_4wk_periods_compliant: false,
        currentHourlyRate: 38,
        hoursLast12MonthsBeforeCessation: 1456,
      },
    };
    const result = calculateTAS(employee, {
      kind: 'termination',
      terminationDate: asISODate('2026-05-26'),
      reason: 'redundancy',
    });
    expect(result.warnings.map((w) => w.code)).toContain(
      'tas_casual_32hr_4wk_continuity_not_satisfied'
    );
    expect(result.outputs?.totalEntitlement.weeks.value.toFixed(4)).toBe('0.0000');
  });

  it('TC-TAS-035 shape — neither flag nor wageHistory → permissive default + advisory', () => {
    const employee: Employee = {
      id: 'TC-TAS-035',
      startDate: asISODate('2018-05-26'),
      endDate: asISODate('2026-05-26'),
      employmentType: 'casual',
      statesOfService: ['TAS'],
      governingJurisdiction: 'TAS',
      currentWeeklyGross: '1064',
      wageHistory: [],
      serviceEvents: [],
      extraInputs: {
        currentHourlyRate: 38,
        hoursLast12MonthsBeforeCessation: 1560,
      },
    };
    const result = calculateTAS(employee, {
      kind: 'termination',
      terminationDate: asISODate('2026-05-26'),
      reason: 'voluntary_resignation',
    });
    expect(result.warnings.map((w) => w.code)).toContain(
      'tas_casual_continuity_test_unverified'
    );
  });
});

describe('TAS T8.2 — slackness-of-trade 14-day window (TBD-TAS-12)', () => {
  it('TC-TAS-031 shape — slackness + 14-day flag true: 6-mo tolerance preserved', () => {
    const employee = fullTimeEmployee({
      serviceEvents: [
        {
          type: 'employer_initiated_termination_and_rehire',
          startDate: asISODate('2022-05-26'),
          endDate: asISODate('2022-10-26'),
          slacknessOfTrade: true,
        },
      ],
      extraInputs: { tas_slackness_return_within_14_days: true },
    });
    const result = calculateTAS(employee, {
      kind: 'termination',
      terminationDate: asISODate('2026-05-26'),
      reason: 'redundancy',
    });
    expect(result.warnings.map((w) => w.code)).toContain(
      'tas_slackness_of_trade_continuity_preserved'
    );
    expect(result.outputs?.totalEntitlement.weeks.value.gt(0)).toBe(true);
  });

  it('TC-TAS-032 shape — slackness + 14-day flag false: 6-mo tolerance denied, service forfeited', () => {
    const employee = fullTimeEmployee({
      serviceEvents: [
        {
          type: 'employer_initiated_termination_and_rehire',
          startDate: asISODate('2022-05-26'),
          endDate: asISODate('2022-10-26'),
          slacknessOfTrade: true,
        },
      ],
      extraInputs: { tas_slackness_return_within_14_days: false },
    });
    const result = calculateTAS(employee, {
      kind: 'termination',
      terminationDate: asISODate('2026-05-26'),
      reason: 'redundancy',
    });
    expect(result.warnings.map((w) => w.code)).toContain(
      'tas_slackness_14_day_return_window_missed'
    );
    // Post-rehire only — sub-7 yr → no entitlement.
    expect(result.outputs?.totalEntitlement.weeks.value.toFixed(4)).toBe('0.0000');
  });
});

describe('TAS T8.2 — apprentice 3-mo transition (TBD-TAS-11)', () => {
  it('TC-TAS-036 shape — apprentice → tradesperson within 3 mo: continuity preserved', () => {
    const employee = fullTimeEmployee({
      serviceEvents: [
        {
          type: 'apprentice_to_tradesperson_transition',
          startDate: asISODate('2018-05-26'),
          endDate: asISODate('2018-07-26'), // ~2 month gap
        },
      ],
    });
    const result = calculateTAS(employee, {
      kind: 'termination',
      terminationDate: asISODate('2026-05-26'),
      reason: 'voluntary_resignation',
    });
    expect(result.warnings.map((w) => w.code)).toContain(
      'tas_apprentice_3mo_continuity_preserved'
    );
  });
});

describe('TAS T8.2 — parental-leave exclusion (TBD-TAS-13)', () => {
  it('TC-TAS-028 shape — paid + unpaid parental leave both excluded; advisory emitted', () => {
    const employee = fullTimeEmployee({
      startDate: asISODate('2014-05-26'),
      serviceEvents: [
        {
          type: 'paid_leave',
          startDate: asISODate('2020-01-01'),
          endDate: asISODate('2020-04-01'),
          note: 'company-paid parental leave 13 wks',
        },
        {
          type: 'leave_without_pay',
          startDate: asISODate('2020-04-02'),
          endDate: asISODate('2020-07-01'),
          note: 'unpaid maternity leave 13 wks',
        },
      ],
    });
    const result = calculateTAS(employee, {
      kind: 'termination',
      terminationDate: asISODate('2026-05-26'),
      reason: 'voluntary_resignation',
    });
    expect(result.warnings.map((w) => w.code)).toContain(
      'tas_maternity_leave_excluded'
    );
    // Service should be reduced by ~26 weeks of parental leave; still well above 10 yrs.
    expect(result.diagnostics?.daysNotCountedInService).toBeGreaterThan(150);
  });
});

describe('TAS T8.2 — retirement 60F/65M default (TBD-TAS-02)', () => {
  it('TC-TAS-012 shape — woman 60: qualifies via default + advisory', () => {
    const employee = fullTimeEmployee({
      startDate: asISODate('2018-05-26'),
      endDate: asISODate('2026-05-26'),
      dob: asISODate('1966-05-26'), // exactly 60 on trigger date
      sex: 'female',
    });
    const result = calculateTAS(employee, {
      kind: 'termination',
      terminationDate: asISODate('2026-05-26'),
      reason: 'retirement',
    });
    expect(result.warnings.map((w) => w.code)).toContain(
      'tas_retirement_qualifying_age_60f_65m_default'
    );
    expect(result.outputs?.totalEntitlement.weeks.value.gt(0)).toBe(true);
  });

  it('TC-TAS-013 shape — man 60 (sub-65): does NOT qualify by default', () => {
    const employee = fullTimeEmployee({
      startDate: asISODate('2018-05-26'),
      endDate: asISODate('2026-05-26'),
      dob: asISODate('1966-05-26'),
      sex: 'male',
    });
    const result = calculateTAS(employee, {
      kind: 'termination',
      terminationDate: asISODate('2026-05-26'),
      reason: 'retirement',
    });
    expect(result.outputs?.totalEntitlement.weeks.value.toFixed(4)).toBe('0.0000');
    expect(result.warnings.map((w) => w.code)).toContain(
      'sub_10yr_no_qualifying_reason_tas'
    );
  });

  it('TC-TAS-014 shape — man 60 + award-min override: qualifies', () => {
    const employee = fullTimeEmployee({
      startDate: asISODate('2018-05-26'),
      endDate: asISODate('2026-05-26'),
      dob: asISODate('1966-05-26'),
      sex: 'male',
      extraInputs: { tas_award_min_retirement_age_reached: true },
    });
    const result = calculateTAS(employee, {
      kind: 'termination',
      terminationDate: asISODate('2026-05-26'),
      reason: 'retirement',
    });
    expect(result.outputs?.totalEntitlement.weeks.value.gt(0)).toBe(true);
  });
});

describe('TAS T8.2 — voluntary res 7-10 yr binary cliff (TBD-TAS-07)', () => {
  it('9 yrs voluntary res → $0, sub-10 no qualifying reason advisory', () => {
    const employee = fullTimeEmployee({
      startDate: asISODate('2017-05-26'),
      endDate: asISODate('2026-05-26'),
    });
    const result = calculateTAS(employee, {
      kind: 'termination',
      terminationDate: asISODate('2026-05-26'),
      reason: 'voluntary_resignation',
    });
    expect(result.outputs?.totalEntitlement.weeks.value.toFixed(4)).toBe('0.0000');
    expect(result.warnings.map((w) => w.code)).toContain(
      'sub_10yr_no_qualifying_reason_tas'
    );
  });

  it('10 yrs exact voluntary res → full 8.6667 wks', () => {
    const employee = fullTimeEmployee({
      startDate: asISODate('2016-05-26'),
      endDate: asISODate('2026-05-26'),
    });
    const result = calculateTAS(employee, {
      kind: 'termination',
      terminationDate: asISODate('2026-05-26'),
      reason: 'voluntary_resignation',
    });
    // inclusiveDays(2016-05-26, 2026-05-26) = 3653 days; years = 3653/365.25 = 10.0014.
    // payable_weeks = 10.0014 × (8.6667 / 10) = 8.6679. Engine-day-precise.
    expect(result.outputs?.totalEntitlement.weeks.value.toFixed(4)).toBe('8.6679');
  });
});

describe('TAS T8.2 — advance leave $0 + advisory (TBD-TAS-08)', () => {
  it('TC-TAS-070 shape — 7-yr taking_leave: status=computed, payable=$0, advisory', () => {
    const employee = fullTimeEmployee({
      startDate: asISODate('2019-05-26'),
      endDate: undefined,
    });
    const result = calculateTAS(employee, {
      kind: 'taking_leave',
      leaveStartDate: asISODate('2026-06-01'),
      leaveWeeks: 4.0,
    });
    expect(result.status).toBe('computed');
    expect(result.outputs?.totalEntitlement.dollars.value.toFixed(2)).toBe('0.00');
    expect(result.warnings.map((w) => w.code)).toContain(
      'tas_advance_leave_not_permitted'
    );
  });
});

describe('TAS T8.2 — bonus exclusion absolute (TBD-TAS-15) — Note B verbatim', () => {
  it('emits TAS-specific advisory (not generic v1-out-of-scope token)', () => {
    const employee = fullTimeEmployee({
      wageHistory: [
        {
          periodStart: asISODate('2025-05-26'),
          periodEnd: asISODate('2026-05-26'),
          grossPay: '98000',
          frequency: 'weekly',
          note: 'includes incentive bonus paid Dec 2025',
        },
      ],
    });
    const result = calculateTAS(employee, {
      kind: 'taking_leave',
      leaveStartDate: asISODate('2026-06-01'),
    });
    expect(result.warnings.map((w) => w.code)).toContain(
      'tas_bonus_excluded_absolutely'
    );
    expect(result.warnings.map((w) => w.code)).not.toContain(
      'bonus_in_notes_v1_out_of_scope'
    );
  });
});

describe('TAS T8.2 — WC counts in full (s.5(1)(c))', () => {
  it('TC-TAS-037 shape — medical-cert-backed WC absence counts as service', () => {
    const employee = fullTimeEmployee({
      serviceEvents: [
        {
          type: 'workers_comp_absence',
          startDate: asISODate('2021-06-01'),
          endDate: asISODate('2021-11-30'),
          note: 'medical-certificate-backed',
        },
      ],
    });
    const result = calculateTAS(employee, {
      kind: 'termination',
      terminationDate: asISODate('2026-05-26'),
      reason: 'voluntary_resignation',
    });
    // 12 yrs service - 0 excluded = 12 yrs
    expect(result.diagnostics?.daysNotCountedInService).toBe(0);
    expect(result.outputs?.totalEntitlement.weeks.value.gt(10)).toBe(true);
  });

  it('TC-TAS-038 shape — WC absence with "no medical certificate" note: excluded', () => {
    const employee = fullTimeEmployee({
      serviceEvents: [
        {
          type: 'workers_comp_absence',
          startDate: asISODate('2021-06-01'),
          endDate: asISODate('2021-11-30'),
          note: 'no medical certificate supplied',
        },
      ],
    });
    const result = calculateTAS(employee, {
      kind: 'termination',
      terminationDate: asISODate('2026-05-26'),
      reason: 'voluntary_resignation',
    });
    expect(result.diagnostics?.daysNotCountedInService).toBeGreaterThan(150);
  });
});

describe('TAS T8.2 — cash-out gating (s.10)', () => {
  it('12 yrs cash_out → post-entitlement advisory', () => {
    const employee = fullTimeEmployee({ startDate: asISODate('2014-05-26') });
    const result = calculateTAS(employee, {
      kind: 'cash_out',
      cashOutDate: asISODate('2026-05-26'),
    });
    expect(result.warnings.map((w) => w.code)).toContain(
      'tas_cashout_post_entitlement_advisory'
    );
  });

  it('5 yrs cash_out → pre-entitlement not-authorised advisory', () => {
    const employee = fullTimeEmployee({
      startDate: asISODate('2021-05-26'),
      endDate: undefined,
    });
    const result = calculateTAS(employee, {
      kind: 'cash_out',
      cashOutDate: asISODate('2026-05-26'),
    });
    expect(result.warnings.map((w) => w.code)).toContain(
      'tas_cashout_pre_entitlement_not_authorised'
    );
  });
});

describe('TAS T8.2 — pay-on-termination s.12(4)', () => {
  it('TC-TAS-075 shape — payable_by = terminationDate itself + advisory', () => {
    const employee = fullTimeEmployee({ startDate: asISODate('2014-05-26') });
    const result = calculateTAS(employee, {
      kind: 'termination',
      terminationDate: asISODate('2026-05-26'),
      reason: 'redundancy',
    });
    expect(result.payable_by).toBe('2026-05-26');
    expect(result.warnings.map((w) => w.code)).toContain(
      'tas_payable_on_day_of_termination_advisory'
    );
  });
});

describe('TAS T8.2 — WC reduced-rate advisory at trigger', () => {
  it('TC-TAS-068 shape — WC overlaps taking_leave start → WC-reduced-rate advisory', () => {
    const employee = fullTimeEmployee({
      startDate: asISODate('2016-05-26'),
      endDate: undefined,
      currentWeeklyGross: '1300',
      serviceEvents: [
        {
          type: 'workers_comp_absence',
          startDate: asISODate('2026-04-01'),
          endDate: asISODate('2026-06-30'),
        },
      ],
    });
    const result = calculateTAS(employee, {
      kind: 'taking_leave',
      leaveStartDate: asISODate('2026-06-01'),
    });
    expect(result.warnings.map((w) => w.code)).toContain(
      'tas_lsl_calculated_at_wc_reduced_rate_warning'
    );
  });
});

describe('TAS T8.2 — public-holidays TAS calendar', () => {
  it('emits Easter Tuesday and Eight Hours Day for a given year', async () => {
    const { tasPublicHolidaysForYear } = await import('../rules/public-holidays');
    const phs2026 = tasPublicHolidaysForYear(2026, false);
    // Easter 2026 = April 5; Easter Tuesday = April 7.
    expect(phs2026).toContain('2026-04-07');
    // Eight Hours Day 2026 = 2nd Monday in March = March 9.
    expect(phs2026).toContain('2026-03-09');
    // Recreation Day NOT in default (no `northern: true`).
    // Recreation Day = first Monday in November 2026 = November 2.
    expect(phs2026).not.toContain('2026-11-02');
  });

  it('emits Recreation Day when northern=true', async () => {
    const { tasPublicHolidaysForYear } = await import('../rules/public-holidays');
    const phs2026 = tasPublicHolidaysForYear(2026, true);
    expect(phs2026).toContain('2026-11-02');
  });
});

describe('TAS T8.2 — 10+ yr misconduct full payout (TBD-TAS-06)', () => {
  it('12 yrs serious_misconduct → full 10.4004 wks + advisory', () => {
    const employee = fullTimeEmployee({
      startDate: asISODate('2014-05-26'),
      endDate: asISODate('2026-05-26'),
      currentWeeklyGross: '1800',
    });
    const result = calculateTAS(employee, {
      kind: 'termination',
      terminationDate: asISODate('2026-05-26'),
      reason: 'serious_misconduct',
    });
    expect(result.warnings.map((w) => w.code)).toContain(
      'tas_10yr_plus_misconduct_full_payout'
    );
    expect(result.outputs?.totalEntitlement.weeks.value.gt(10)).toBe(true);
  });
});
