import { describe, it, expect } from 'vitest';
import { calculateNT, calculateNTSafe } from '../index';
import {
  asISODate,
  type Employee,
  type Trigger,
} from '@/lib/lsl/engine/types';
import {
  accrualNT,
  ntAccrualConstants,
  __INTERNAL as ACCRUAL_INTERNAL,
} from '../rules/accrual-table';
import {
  agePensionAgeForDob,
  ageAt,
  hasReachedAgePensionAge,
} from '../rules/age-pension-age';
import { evaluateNTCasualContinuity } from '../rules/casual-continuity';
import { Decimal } from '@/lib/lsl/engine/decimal';

/**
 * T9.2 narrow unit tests — one cluster per locked rule from the signed
 * docs/qa/test-cases-nt.md v1.0 (PM-SIGNED 2026-05-27). Full ~75-fixture
 * corpus lands in T9.3.
 *
 * Coverage:
 *   - Age Pension age lookup (s.10(2) / Cth SS Act 1991 s.23)
 *   - Accrual table — sub-7, 7-10 qualifying-reason gates, 10+ full,
 *     10+ misconduct complete-blocks-only truncation (TBD-NT-05)
 *   - Per-year `RP × HWW × 1.3` formula (s.11(3) — TBD-NT-01) with
 *     operator history, missing history, partial history
 *   - Commission 12-mo lookback (TBD-NT-10)
 *   - Continuous-service walker (WC / maternity / sick / LWP /
 *     industrial-dispute exclusions, transfer-of-business, apprentice
 *     12-mo)
 *   - Trigger-handlers: cash_out hard error (s.10(4) / TBD-NT-08),
 *     advance-leave gate (TBD-NT-08 leave-in-advance branch)
 *   - PH-inclusive advisory (s.9 / TBD-NT-09)
 *   - Casual continuity operator-flag handling (TBD-NT-03)
 *   - Related-corporation aggregation (TBD-NT-15)
 *   - Bonus inclusion advisory (TBD-NT-07)
 */

function fullTimeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 'TC',
    startDate: asISODate('2014-05-26'),
    endDate: asISODate('2026-05-26'),
    employmentType: 'full_time',
    statesOfService: ['NT'],
    governingJurisdiction: 'NT',
    currentWeeklyGross: '1000',
    wageHistory: [
      {
        periodStart: asISODate('2014-05-26'),
        periodEnd: asISODate('2026-05-26'),
        grossPay: '624000',
        frequency: 'weekly',
      },
    ],
    serviceEvents: [],
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Age Pension age lookup (TBD-NT-02)
// ─────────────────────────────────────────────────────────────────────────────

describe('NT T9.2 — Age Pension age lookup (TBD-NT-02 / Cth SS Act 1991 s.23)', () => {
  it('born ≤ 30 Jun 1952 → 65', () => {
    expect(agePensionAgeForDob(asISODate('1950-01-15'))).toBe(65);
    expect(agePensionAgeForDob(asISODate('1952-06-30'))).toBe(65);
  });

  it('born 1 Jul 1952 – 31 Dec 1953 → 65.5', () => {
    expect(agePensionAgeForDob(asISODate('1952-07-01'))).toBe(65.5);
    expect(agePensionAgeForDob(asISODate('1953-12-31'))).toBe(65.5);
  });

  it('born 1 Jan 1954 – 30 Jun 1955 → 66', () => {
    expect(agePensionAgeForDob(asISODate('1954-01-01'))).toBe(66);
    expect(agePensionAgeForDob(asISODate('1955-06-30'))).toBe(66);
  });

  it('born 1 Jul 1955 – 31 Dec 1956 → 66.5', () => {
    expect(agePensionAgeForDob(asISODate('1955-07-01'))).toBe(66.5);
    expect(agePensionAgeForDob(asISODate('1956-12-31'))).toBe(66.5);
  });

  it('born ≥ 1 Jan 1957 → 67', () => {
    expect(agePensionAgeForDob(asISODate('1957-01-01'))).toBe(67);
    expect(agePensionAgeForDob(asISODate('1960-06-15'))).toBe(67);
    expect(agePensionAgeForDob(asISODate('2000-01-01'))).toBe(67);
  });

  it('ageAt: birthday passed in the year → integer + small fraction', () => {
    const yrs = ageAt(asISODate('1960-01-15'), asISODate('2026-06-15'));
    expect(Math.floor(yrs)).toBe(66);
    expect(yrs).toBeGreaterThan(66);
    expect(yrs).toBeLessThan(67);
  });

  it('ageAt: birthday not yet reached in year → years-1', () => {
    const yrs = ageAt(asISODate('1960-12-15'), asISODate('2026-06-15'));
    expect(Math.floor(yrs)).toBe(65);
  });

  it('hasReachedAgePensionAge: 67yo born 1959 vs Age Pension age 67 → true', () => {
    expect(
      hasReachedAgePensionAge(asISODate('1959-01-01'), asISODate('2026-06-15'))
    ).toBe(true);
  });

  it('hasReachedAgePensionAge: 65yo born 1961 vs Age Pension age 67 → false', () => {
    expect(
      hasReachedAgePensionAge(asISODate('1961-01-01'), asISODate('2026-06-15'))
    ).toBe(false);
  });

  it('hasReachedAgePensionAge: undefined dob → false', () => {
    expect(
      hasReachedAgePensionAge(undefined, asISODate('2026-06-15'))
    ).toBe(false);
  });

  it('hasReachedAgePensionAge: 1955 cohort needs 66 — 67yo passes', () => {
    expect(
      hasReachedAgePensionAge(asISODate('1955-03-01'), asISODate('2026-06-15'))
    ).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Accrual table — sub-7 / 7-10 / 10+ / misconduct truncation
// ─────────────────────────────────────────────────────────────────────────────

describe('NT T9.2 — accrual table (s.8 / s.10)', () => {
  it('sub-7 yrs → no entitlement', () => {
    const employee = fullTimeEmployee({
      startDate: asISODate('2020-05-26'),
      endDate: asISODate('2026-05-26'),
    });
    const trigger: Trigger = {
      kind: 'termination',
      terminationDate: asISODate('2026-05-26'),
      reason: 'redundancy',
    };
    const result = calculateNT(employee, trigger);
    expect(result.status).toBe('computed');
    expect(result.outputs?.totalEntitlement.weeks.value.toFixed(2)).toBe('0.00');
    expect(result.warnings.map((w) => w.code)).toContain(
      'sub_7yr_no_entitlement_nt'
    );
  });

  it('7–10 yrs voluntary resignation → $0 binary cliff (TBD-NT-04 closed-list)', () => {
    const employee = fullTimeEmployee({
      startDate: asISODate('2018-05-26'),
      endDate: asISODate('2026-05-26'),
    });
    const trigger: Trigger = {
      kind: 'termination',
      terminationDate: asISODate('2026-05-26'),
      reason: 'voluntary_resignation',
    };
    const result = calculateNT(employee, trigger);
    expect(result.status).toBe('computed');
    expect(result.outputs?.totalEntitlement.weeks.value.toFixed(2)).toBe('0.00');
    expect(result.warnings.map((w) => w.code)).toContain(
      'sub_10yr_no_qualifying_reason_nt'
    );
  });

  it('7–10 yrs redundancy → pro-rata (qualifying reason)', () => {
    const employee = fullTimeEmployee({
      startDate: asISODate('2018-05-26'),
      endDate: asISODate('2026-05-26'),
    });
    const trigger: Trigger = {
      kind: 'termination',
      terminationDate: asISODate('2026-05-26'),
      reason: 'redundancy',
    };
    const result = calculateNT(employee, trigger);
    expect(result.status).toBe('computed');
    // Years are ~8.0 → 8.0 × 1.3 = 10.4 weeks (give or take fraction).
    const weeks = Number(result.outputs?.totalEntitlement.weeks.value.toFixed(2));
    expect(weeks).toBeGreaterThan(10);
    expect(weeks).toBeLessThan(11);
  });

  it('7–10 yrs illness/incapacity → pro-rata (qualifying reason)', () => {
    const employee = fullTimeEmployee({
      startDate: asISODate('2018-05-26'),
      endDate: asISODate('2026-05-26'),
    });
    const trigger: Trigger = {
      kind: 'termination',
      terminationDate: asISODate('2026-05-26'),
      reason: 'illness_incapacity',
    };
    const result = calculateNT(employee, trigger);
    expect(result.status).toBe('computed');
    expect(result.diagnostics?.payableIndicator).toBe('payable');
  });

  it('7–10 yrs death → pro-rata via s.10(3) cross-reference (TBD-NT-06)', () => {
    const employee = fullTimeEmployee({
      startDate: asISODate('2018-05-26'),
      endDate: asISODate('2026-05-26'),
    });
    const trigger: Trigger = {
      kind: 'termination',
      terminationDate: asISODate('2026-05-26'),
      reason: 'death',
    };
    const result = calculateNT(employee, trigger);
    expect(result.status).toBe('computed');
    expect(result.diagnostics?.payableIndicator).toBe('payable');
    // Citation for s.10(3) personal-representative must be present.
    const allCites = [
      ...(result.outputs?.totalEntitlement.weeks.citations ?? []),
      ...(result.outputs?.totalEntitlement.dollars.citations ?? []),
    ];
    expect(
      allCites.some(
        (c) =>
          c.section === 'NT LSL Act 1981 s.10(3)' &&
          c.rule.includes('personal-representative')
      )
    ).toBe(true);
  });

  it('7–10 yrs retirement WITH dob ≥ Age Pension age → qualifies', () => {
    const employee = fullTimeEmployee({
      startDate: asISODate('2018-05-26'),
      endDate: asISODate('2026-05-26'),
      dob: asISODate('1955-01-01'), // 71yo at termination — well past Age Pension age 66
    });
    const trigger: Trigger = {
      kind: 'termination',
      terminationDate: asISODate('2026-05-26'),
      reason: 'retirement',
    };
    const result = calculateNT(employee, trigger);
    expect(result.status).toBe('computed');
    expect(result.diagnostics?.payableIndicator).toBe('payable');
    expect(result.warnings.map((w) => w.code)).toContain(
      'nt_retirement_qualifying_age_pension_age'
    );
  });

  it('7–10 yrs retirement WITH dob < Age Pension age → does NOT qualify', () => {
    const employee = fullTimeEmployee({
      startDate: asISODate('2018-05-26'),
      endDate: asISODate('2026-05-26'),
      dob: asISODate('1970-01-01'), // 56yo at termination — below 67
    });
    const trigger: Trigger = {
      kind: 'termination',
      terminationDate: asISODate('2026-05-26'),
      reason: 'retirement',
    };
    const result = calculateNT(employee, trigger);
    expect(result.status).toBe('computed');
    expect(result.outputs?.totalEntitlement.weeks.value.toFixed(2)).toBe('0.00');
    expect(result.warnings.map((w) => w.code)).toContain(
      'sub_10yr_no_qualifying_reason_nt'
    );
  });

  it('7–10 yrs retirement WITHOUT dob + operator override → qualifies', () => {
    const employee = fullTimeEmployee({
      startDate: asISODate('2018-05-26'),
      endDate: asISODate('2026-05-26'),
      extraInputs: {
        nt_age_pension_age_at_termination_reached: true,
      },
    });
    const trigger: Trigger = {
      kind: 'termination',
      terminationDate: asISODate('2026-05-26'),
      reason: 'retirement',
    };
    const result = calculateNT(employee, trigger);
    expect(result.status).toBe('computed');
    expect(result.diagnostics?.payableIndicator).toBe('payable');
    expect(result.warnings.map((w) => w.code)).toContain(
      'nt_retirement_qualifying_age_pension_age'
    );
  });

  it('sub-10 yrs serious misconduct → $0 + sub_10yr_misconduct_excluded_nt', () => {
    const employee = fullTimeEmployee({
      startDate: asISODate('2018-05-26'),
      endDate: asISODate('2026-05-26'),
    });
    const trigger: Trigger = {
      kind: 'termination',
      terminationDate: asISODate('2026-05-26'),
      reason: 'serious_misconduct',
    };
    const result = calculateNT(employee, trigger);
    expect(result.status).toBe('computed');
    expect(result.outputs?.totalEntitlement.weeks.value.toFixed(2)).toBe('0.00');
    expect(result.warnings.map((w) => w.code)).toContain(
      'sub_10yr_misconduct_excluded_nt'
    );
  });

  it('10+ yrs any reason except misconduct → full payout', () => {
    const employee = fullTimeEmployee({
      startDate: asISODate('2014-05-26'),
      endDate: asISODate('2026-05-26'),
    });
    const trigger: Trigger = {
      kind: 'termination',
      terminationDate: asISODate('2026-05-26'),
      reason: 'voluntary_resignation',
    };
    const result = calculateNT(employee, trigger);
    expect(result.status).toBe('computed');
    expect(result.diagnostics?.payableIndicator).toBe('payable');
    // ~12 yrs → ~15.6 weeks payable (12 × 1.3).
    const weeks = Number(result.outputs?.totalEntitlement.weeks.value.toFixed(2));
    expect(weeks).toBeGreaterThan(15);
    expect(weeks).toBeLessThan(16);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. s.10(1A) misconduct complete-blocks-only truncation (TBD-NT-05)
// ─────────────────────────────────────────────────────────────────────────────

describe('NT T9.2 — s.10(1A) misconduct complete-blocks-only (TBD-NT-05)', () => {
  it('truncateToCompleted10Or15YrBlock: 9.99y → 0 (sub-10 forfeit handled elsewhere)', () => {
    const r = ACCRUAL_INTERNAL.truncateToCompleted10Or15YrBlock(new Decimal('9.99'));
    expect(r.toFixed(0)).toBe('0');
  });

  it('truncateToCompleted10Or15YrBlock: 10.0y → 10', () => {
    const r = ACCRUAL_INTERNAL.truncateToCompleted10Or15YrBlock(new Decimal('10.0'));
    expect(r.toFixed(0)).toBe('10');
  });

  it('truncateToCompleted10Or15YrBlock: 12.5y → 10', () => {
    const r = ACCRUAL_INTERNAL.truncateToCompleted10Or15YrBlock(new Decimal('12.5'));
    expect(r.toFixed(0)).toBe('10');
  });

  it('truncateToCompleted10Or15YrBlock: 14.999y → 10', () => {
    const r = ACCRUAL_INTERNAL.truncateToCompleted10Or15YrBlock(
      new Decimal('14.999')
    );
    expect(r.toFixed(0)).toBe('10');
  });

  it('truncateToCompleted10Or15YrBlock: 15.0y → 15', () => {
    const r = ACCRUAL_INTERNAL.truncateToCompleted10Or15YrBlock(new Decimal('15.0'));
    expect(r.toFixed(0)).toBe('15');
  });

  it('truncateToCompleted10Or15YrBlock: 16y → 15', () => {
    const r = ACCRUAL_INTERNAL.truncateToCompleted10Or15YrBlock(new Decimal('16'));
    expect(r.toFixed(0)).toBe('15');
  });

  it('truncateToCompleted10Or15YrBlock: 21y → 20', () => {
    const r = ACCRUAL_INTERNAL.truncateToCompleted10Or15YrBlock(new Decimal('21'));
    expect(r.toFixed(0)).toBe('20');
  });

  it('truncateToCompleted10Or15YrBlock: 29.99y → 25', () => {
    const r = ACCRUAL_INTERNAL.truncateToCompleted10Or15YrBlock(
      new Decimal('29.99')
    );
    expect(r.toFixed(0)).toBe('25');
  });

  it('12.5y misconduct termination → 10y payable (13 wks); advisory fires', () => {
    const employee = fullTimeEmployee({
      startDate: asISODate('2013-11-26'), // ~12.5 yrs to 2026-05-26
      endDate: asISODate('2026-05-26'),
    });
    const trigger: Trigger = {
      kind: 'termination',
      terminationDate: asISODate('2026-05-26'),
      reason: 'serious_misconduct',
    };
    const result = calculateNT(employee, trigger);
    expect(result.status).toBe('computed');
    expect(result.outputs?.totalEntitlement.weeks.value.toFixed(4)).toBe('13.0000');
    expect(result.warnings.map((w) => w.code)).toContain(
      'nt_10yr_plus_misconduct_complete_blocks_only'
    );
  });

  it('16y misconduct termination → 15y payable (19.5 wks)', () => {
    const employee = fullTimeEmployee({
      startDate: asISODate('2010-05-26'), // ~16 yrs to 2026-05-26
      endDate: asISODate('2026-05-26'),
    });
    const trigger: Trigger = {
      kind: 'termination',
      terminationDate: asISODate('2026-05-26'),
      reason: 'serious_misconduct',
    };
    const result = calculateNT(employee, trigger);
    expect(result.status).toBe('computed');
    expect(result.outputs?.totalEntitlement.weeks.value.toFixed(4)).toBe('19.5000');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Per-year `RP × HWW × 1.3` formula (s.11(3) — TBD-NT-01)
// ─────────────────────────────────────────────────────────────────────────────

describe('NT T9.2 — per-year `RP × HWW × 1.3` formula (s.11(3) — TBD-NT-01)', () => {
  it('10-yr FT no operator history → fallback fires nt_per_year_hours_history_missing', () => {
    const employee = fullTimeEmployee({
      startDate: asISODate('2016-05-26'),
      endDate: asISODate('2026-05-26'),
    });
    const trigger: Trigger = {
      kind: 'termination',
      terminationDate: asISODate('2026-05-26'),
      reason: 'redundancy',
    };
    const result = calculateNT(employee, trigger);
    expect(result.warnings.map((w) => w.code)).toContain(
      'nt_per_year_hours_history_missing'
    );
    expect(result.warnings.map((w) => w.code)).toContain(
      'nt_per_year_formula_applied'
    );
  });

  it('10-yr FT with constant 38hr operator history → exact per-year sum + no partial advisory', () => {
    const startISO = '2016-05-27';
    const endISO = '2026-05-26';
    // Build a year-by-year array covering each year of the 10-yr span.
    const history: Array<{
      yearStart: string;
      yearEnd: string;
      hoursPerWeek: number;
    }> = [];
    for (let i = 0; i < 10; i++) {
      const yStart = new Date(Date.UTC(2016 + i, 4, 27));
      const yEnd = new Date(Date.UTC(2017 + i, 4, 26));
      history.push({
        yearStart: yStart.toISOString().slice(0, 10),
        yearEnd: yEnd.toISOString().slice(0, 10),
        hoursPerWeek: 38,
      });
    }
    const employee = fullTimeEmployee({
      startDate: asISODate(startISO),
      endDate: asISODate(endISO),
      currentWeeklyGross: '1000',
      extraInputs: {
        nt_hours_per_week_by_year: history,
      },
    });
    const trigger: Trigger = {
      kind: 'termination',
      terminationDate: asISODate(endISO),
      reason: 'redundancy',
    };
    const result = calculateNT(employee, trigger);
    expect(result.status).toBe('computed');
    expect(result.warnings.map((w) => w.code)).not.toContain(
      'nt_per_year_hours_history_missing'
    );
    expect(result.warnings.map((w) => w.code)).toContain(
      'nt_per_year_formula_applied'
    );
    // Per-year: (1000/38) × 38 × 1.3 = 1300 per yr. 10 yrs → 13000.
    // Value of week: 13000 / (10 × 1.3) = 1000.
    expect(result.outputs?.valueOfWeek.value.toFixed(2)).toBe('1000.00');
  });

  it('per-year history with varying hours → value-of-week reflects average', () => {
    // 5 years FT 38hr, 5 years PT 19hr. Rate fixed at $1000/wk current.
    // RP_hourly = 1000/38 = 26.31578…
    // Year 1-5 each: 26.31578… × 38 × 1.3 = 1300
    // Year 6-10 each: 26.31578… × 19 × 1.3 = 650
    // Total dollars over 10 yrs ≈ 5 × 1300 + 5 × 650 = 6500 + 3250 = 9750
    // payable weeks = 10 × 1.3 = 13 → value/week = 9750/13 = 750
    const startISO = '2016-05-27';
    const endISO = '2026-05-26';
    const history: Array<{
      yearStart: string;
      yearEnd: string;
      hoursPerWeek: number;
    }> = [];
    for (let i = 0; i < 10; i++) {
      const yStart = new Date(Date.UTC(2016 + i, 4, 27));
      const yEnd = new Date(Date.UTC(2017 + i, 4, 26));
      history.push({
        yearStart: yStart.toISOString().slice(0, 10),
        yearEnd: yEnd.toISOString().slice(0, 10),
        hoursPerWeek: i < 5 ? 38 : 19,
      });
    }
    const employee = fullTimeEmployee({
      startDate: asISODate(startISO),
      endDate: asISODate(endISO),
      currentWeeklyGross: '1000',
      extraInputs: {
        nt_hours_per_week_by_year: history,
      },
    });
    const trigger: Trigger = {
      kind: 'termination',
      terminationDate: asISODate(endISO),
      reason: 'redundancy',
    };
    const result = calculateNT(employee, trigger);
    expect(result.status).toBe('computed');
    // Value of week should be ≈ 750 (allowing for inclusive-day rounding).
    const vow = Number(result.outputs?.valueOfWeek.value.toFixed(2));
    expect(vow).toBeGreaterThan(745);
    expect(vow).toBeLessThan(755);
  });

  it('partial operator history → nt_per_year_hours_history_partial fires', () => {
    // Supply only the first 5 years of a 10-yr span.
    const history: Array<{
      yearStart: string;
      yearEnd: string;
      hoursPerWeek: number;
    }> = [];
    for (let i = 0; i < 5; i++) {
      const yStart = new Date(Date.UTC(2016 + i, 4, 27));
      const yEnd = new Date(Date.UTC(2017 + i, 4, 26));
      history.push({
        yearStart: yStart.toISOString().slice(0, 10),
        yearEnd: yEnd.toISOString().slice(0, 10),
        hoursPerWeek: 38,
      });
    }
    const employee = fullTimeEmployee({
      startDate: asISODate('2016-05-27'),
      endDate: asISODate('2026-05-26'),
      extraInputs: {
        nt_hours_per_week_by_year: history,
      },
    });
    const trigger: Trigger = {
      kind: 'termination',
      terminationDate: asISODate('2026-05-26'),
      reason: 'redundancy',
    };
    const result = calculateNT(employee, trigger);
    expect(result.warnings.map((w) => w.code)).toContain(
      'nt_per_year_hours_history_partial'
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Commission 12-mo lookback (s.11 rate-varies — TBD-NT-10)
// ─────────────────────────────────────────────────────────────────────────────

describe('NT T9.2 — commission 12-mo lookback (s.11 rate-varies — TBD-NT-10)', () => {
  it('commission employee → 12-mo sum / 52 surfaces as value-of-week', () => {
    // 12 months (= engine's 364-day lookback) of $1300/wk commission → 52 ×
    // 1300 = $67,600. value-of-week = 67,600 / 52 = 1300.
    // Wage row spans the EXACT 364-day window: 2025-05-28 → 2026-05-26
    // (inclusive = 364 days). The engine anchors at terminationDate and
    // walks back 363 days exclusive (364 inclusive).
    const employee: Employee = {
      id: 'TC',
      startDate: asISODate('2014-05-26'),
      endDate: asISODate('2026-05-26'),
      employmentType: 'full_time',
      statesOfService: ['NT'],
      governingJurisdiction: 'NT',
      currentWeeklyGross: '0', // engine should use commission path
      categoryOverride: 'C',
      categoryOverrideConfirmed: true,
      wageHistory: [
        {
          periodStart: asISODate('2025-05-28'),
          periodEnd: asISODate('2026-05-26'),
          grossPay: '67600',
          frequency: 'weekly',
        },
      ],
      serviceEvents: [],
    };
    const trigger: Trigger = {
      kind: 'termination',
      terminationDate: asISODate('2026-05-26'),
      reason: 'redundancy',
    };
    const result = calculateNT(employee, trigger);
    expect(result.status).toBe('computed');
    expect(result.outputs?.valueOfWeek.value.toFixed(2)).toBe('1300.00');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Continuous service walker — s.12 event exclusions
// ─────────────────────────────────────────────────────────────────────────────

describe('NT T9.2 — continuous service walker (s.12)', () => {
  it('workers comp absence → excluded; advisory fires', () => {
    const employee = fullTimeEmployee({
      startDate: asISODate('2014-05-26'),
      endDate: asISODate('2026-05-26'),
      serviceEvents: [
        {
          type: 'workers_comp_absence',
          startDate: asISODate('2020-01-01'),
          endDate: asISODate('2020-12-31'),
        },
      ],
    });
    const trigger: Trigger = {
      kind: 'termination',
      terminationDate: asISODate('2026-05-26'),
      reason: 'redundancy',
    };
    const result = calculateNT(employee, trigger);
    expect(result.warnings.map((w) => w.code)).toContain(
      'nt_workers_comp_excluded'
    );
    expect(result.diagnostics?.daysNotCountedInService).toBeGreaterThan(360);
  });

  it('unpaid maternity → excluded; advisory fires', () => {
    const employee = fullTimeEmployee({
      startDate: asISODate('2014-05-26'),
      endDate: asISODate('2026-05-26'),
      serviceEvents: [
        {
          type: 'unpaid_parental_leave',
          startDate: asISODate('2022-01-01'),
          endDate: asISODate('2022-06-30'),
        },
      ],
    });
    const trigger: Trigger = {
      kind: 'termination',
      terminationDate: asISODate('2026-05-26'),
      reason: 'redundancy',
    };
    const result = calculateNT(employee, trigger);
    expect(result.warnings.map((w) => w.code)).toContain(
      'nt_unpaid_maternity_excluded'
    );
  });

  it('unpaid sick leave (LWP with sick note) → excluded under sick code', () => {
    const employee = fullTimeEmployee({
      startDate: asISODate('2014-05-26'),
      endDate: asISODate('2026-05-26'),
      serviceEvents: [
        {
          type: 'leave_without_pay',
          startDate: asISODate('2022-01-01'),
          endDate: asISODate('2022-03-31'),
          note: 'unpaid sick leave',
        },
      ],
    });
    const trigger: Trigger = {
      kind: 'termination',
      terminationDate: asISODate('2026-05-26'),
      reason: 'redundancy',
    };
    const result = calculateNT(employee, trigger);
    expect(result.warnings.map((w) => w.code)).toContain(
      'nt_unpaid_sick_leave_excluded'
    );
  });

  it('general LWP (no special note) → excluded under leave-without-pay code', () => {
    const employee = fullTimeEmployee({
      startDate: asISODate('2014-05-26'),
      endDate: asISODate('2026-05-26'),
      serviceEvents: [
        {
          type: 'leave_without_pay',
          startDate: asISODate('2022-01-01'),
          endDate: asISODate('2022-03-31'),
          note: 'sabbatical',
        },
      ],
    });
    const trigger: Trigger = {
      kind: 'termination',
      terminationDate: asISODate('2026-05-26'),
      reason: 'redundancy',
    };
    const result = calculateNT(employee, trigger);
    expect(result.warnings.map((w) => w.code)).toContain(
      'nt_leave_without_pay_excluded'
    );
  });

  it('industrial action → excluded; advisory fires', () => {
    const employee = fullTimeEmployee({
      startDate: asISODate('2014-05-26'),
      endDate: asISODate('2026-05-26'),
      serviceEvents: [
        {
          type: 'industrial_action',
          startDate: asISODate('2020-06-01'),
          endDate: asISODate('2020-06-14'),
        },
      ],
    });
    const trigger: Trigger = {
      kind: 'termination',
      terminationDate: asISODate('2026-05-26'),
      reason: 'redundancy',
    };
    const result = calculateNT(employee, trigger);
    expect(result.warnings.map((w) => w.code)).toContain(
      'nt_industrial_dispute_excluded'
    );
  });

  it('transfer of business → continuity preserved; advisory fires', () => {
    const employee = fullTimeEmployee({
      startDate: asISODate('2014-05-26'),
      endDate: asISODate('2026-05-26'),
      serviceEvents: [
        {
          type: 'transfer_of_business',
          startDate: asISODate('2020-06-01'),
          endDate: asISODate('2020-06-01'),
        },
      ],
    });
    const trigger: Trigger = {
      kind: 'termination',
      terminationDate: asISODate('2026-05-26'),
      reason: 'redundancy',
    };
    const result = calculateNT(employee, trigger);
    expect(result.warnings.map((w) => w.code)).toContain(
      'transfer_of_business_continuity_preserved_nt'
    );
  });

  it('apprentice → tradesperson within 12 months → preserved; advisory fires', () => {
    const employee = fullTimeEmployee({
      startDate: asISODate('2014-05-26'),
      endDate: asISODate('2026-05-26'),
      serviceEvents: [
        {
          type: 'apprentice_to_tradesperson_transition',
          startDate: asISODate('2018-01-01'),
          endDate: asISODate('2018-06-01'), // 5-month gap, within 12 mo
        },
      ],
    });
    const trigger: Trigger = {
      kind: 'termination',
      terminationDate: asISODate('2026-05-26'),
      reason: 'redundancy',
    };
    const result = calculateNT(employee, trigger);
    expect(result.warnings.map((w) => w.code)).toContain(
      'nt_apprentice_12mo_continuity_preserved'
    );
  });

  it('rehire within 2 months → continuity preserved (no gap advisory)', () => {
    const employee = fullTimeEmployee({
      startDate: asISODate('2014-05-26'),
      endDate: asISODate('2026-05-26'),
      serviceEvents: [
        {
          type: 'employer_initiated_termination_and_rehire',
          startDate: asISODate('2020-01-01'),
          endDate: asISODate('2020-02-15'), // 46-day gap, within 2-mo (61-day) tolerance
        },
      ],
    });
    const trigger: Trigger = {
      kind: 'termination',
      terminationDate: asISODate('2026-05-26'),
      reason: 'redundancy',
    };
    const result = calculateNT(employee, trigger);
    expect(result.warnings.map((w) => w.code)).not.toContain(
      'gap_exceeds_state_tolerance'
    );
  });

  it('rehire after 5 months (no slackness) → continuity broken', () => {
    const employee = fullTimeEmployee({
      startDate: asISODate('2014-05-26'),
      endDate: asISODate('2026-05-26'),
      serviceEvents: [
        {
          type: 'employer_initiated_termination_and_rehire',
          startDate: asISODate('2020-01-01'),
          endDate: asISODate('2020-06-01'), // ~5 months — exceeds 2-mo tolerance
        },
      ],
    });
    const trigger: Trigger = {
      kind: 'termination',
      terminationDate: asISODate('2026-05-26'),
      reason: 'redundancy',
    };
    const result = calculateNT(employee, trigger);
    expect(result.warnings.map((w) => w.code)).toContain(
      'gap_exceeds_state_tolerance'
    );
  });

  it('related-corporation service aggregation (TBD-NT-15)', () => {
    const employee = fullTimeEmployee({
      startDate: asISODate('2018-05-26'), // ~8 yrs direct service
      endDate: asISODate('2026-05-26'),
      extraInputs: {
        nt_related_corporation_service_years: 5, // +5 yrs from a related corp
      },
    });
    const trigger: Trigger = {
      kind: 'termination',
      terminationDate: asISODate('2026-05-26'),
      reason: 'redundancy',
    };
    const result = calculateNT(employee, trigger);
    expect(result.warnings.map((w) => w.code)).toContain(
      'nt_related_corporation_service_aggregated'
    );
    // Aggregated tenure ≈ 13 yrs → 13 × 1.3 ≈ 16.9 wks payable.
    const yrs = Number(
      result.diagnostics?.yearsOfContinuousService.toFixed(2)
    );
    expect(yrs).toBeGreaterThan(12);
    expect(yrs).toBeLessThan(14);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Trigger handlers — cash_out hard error, advance leave gate
// ─────────────────────────────────────────────────────────────────────────────

describe('NT T9.2 — trigger handlers (s.10(4) / TBD-NT-08)', () => {
  it('cash_out trigger → hard error status:failed + error.code', () => {
    const employee = fullTimeEmployee({
      startDate: asISODate('2014-05-26'),
      endDate: asISODate('2026-05-26'),
    });
    const trigger: Trigger = {
      kind: 'cash_out',
      cashOutDate: asISODate('2026-05-26'),
    };
    const result = calculateNTSafe(employee, trigger);
    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('nt_cashout_forbidden_s10_4');
    expect(result.outputs).toBeUndefined();
  });

  it('taking_leave with sub-10-yr tenure → $0 + nt_advance_leave_not_permitted', () => {
    const employee = fullTimeEmployee({
      startDate: asISODate('2020-05-26'),
      endDate: undefined,
    });
    const trigger: Trigger = {
      kind: 'taking_leave',
      leaveStartDate: asISODate('2026-05-26'),
    };
    const result = calculateNT(employee, trigger);
    expect(result.status).toBe('computed');
    expect(result.outputs?.totalEntitlement.weeks.value.toFixed(2)).toBe('0.00');
    expect(result.outputs?.totalEntitlement.dollars.value.toFixed(2)).toBe(
      '0.00'
    );
    expect(result.warnings.map((w) => w.code)).toContain(
      'nt_advance_leave_not_permitted'
    );
  });

  it('termination trigger → omits payable_by + emits as-soon-as-practicable advisory', () => {
    const employee = fullTimeEmployee({
      startDate: asISODate('2014-05-26'),
      endDate: asISODate('2026-05-26'),
    });
    const trigger: Trigger = {
      kind: 'termination',
      terminationDate: asISODate('2026-05-26'),
      reason: 'redundancy',
    };
    const result = calculateNT(employee, trigger);
    expect(result.payable_by).toBeUndefined();
    expect(result.warnings.map((w) => w.code)).toContain(
      'nt_payable_as_soon_as_practicable_advisory'
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. PH-inclusive in LSL (s.9 — TBD-NT-09)
// ─────────────────────────────────────────────────────────────────────────────

describe('NT T9.2 — PH-inclusive in LSL (s.9)', () => {
  it('taking_leave → nt_ph_inclusive_in_lsl advisory fires', () => {
    const employee = fullTimeEmployee({
      startDate: asISODate('2014-05-26'),
      endDate: undefined,
    });
    const trigger: Trigger = {
      kind: 'taking_leave',
      leaveStartDate: asISODate('2026-12-22'), // around Xmas PH
      leaveWeeks: 2,
    };
    const result = calculateNT(employee, trigger);
    expect(result.warnings.map((w) => w.code)).toContain('nt_ph_inclusive_in_lsl');
  });

  it('termination → does NOT emit PH-inclusive advisory (LSL period not relevant)', () => {
    const employee = fullTimeEmployee({
      startDate: asISODate('2014-05-26'),
      endDate: asISODate('2026-05-26'),
    });
    const trigger: Trigger = {
      kind: 'termination',
      terminationDate: asISODate('2026-05-26'),
      reason: 'redundancy',
    };
    const result = calculateNT(employee, trigger);
    expect(result.warnings.map((w) => w.code)).not.toContain(
      'nt_ph_inclusive_in_lsl'
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. Casual continuity (TBD-NT-03)
// ─────────────────────────────────────────────────────────────────────────────

describe('NT T9.2 — casual continuity evaluator (TBD-NT-03)', () => {
  it('FT employee → not-applicable, preserved', () => {
    const r = evaluateNTCasualContinuity('full_time', {});
    expect(r.verdict).toBe('preserved');
    expect(r.source).toBe('not_applicable');
  });

  it('casual + no flag → unverified (permissive default)', () => {
    const r = evaluateNTCasualContinuity('casual', {});
    expect(r.verdict).toBe('unverified');
    expect(r.source).toBe('default_permissive');
  });

  it('casual + flag true → preserved', () => {
    const r = evaluateNTCasualContinuity('casual', {
      nt_casual_continuity_preserved: true,
    });
    expect(r.verdict).toBe('preserved');
    expect(r.source).toBe('operator_flag');
  });

  it('casual + flag false → broken', () => {
    const r = evaluateNTCasualContinuity('casual', {
      nt_casual_continuity_preserved: false,
    });
    expect(r.verdict).toBe('broken');
    expect(r.source).toBe('operator_flag');
  });

  it('casual + no flag in orchestrator → nt_casual_continuity_preserved_default fires', () => {
    const employee = fullTimeEmployee({
      employmentType: 'casual',
      startDate: asISODate('2014-05-26'),
      endDate: asISODate('2026-05-26'),
    });
    const trigger: Trigger = {
      kind: 'termination',
      terminationDate: asISODate('2026-05-26'),
      reason: 'redundancy',
    };
    const result = calculateNT(employee, trigger);
    expect(result.warnings.map((w) => w.code)).toContain(
      'nt_casual_continuity_preserved_default'
    );
    expect(result.warnings.map((w) => w.code)).toContain(
      'nt_casual_loading_assumed_included_in_hourly_rate'
    );
  });

  it('casual + flag false in orchestrator → strict zeros + nt_casual_continuity_broken', () => {
    const employee = fullTimeEmployee({
      employmentType: 'casual',
      startDate: asISODate('2014-05-26'),
      endDate: asISODate('2026-05-26'),
      extraInputs: { nt_casual_continuity_preserved: false },
    });
    const trigger: Trigger = {
      kind: 'termination',
      terminationDate: asISODate('2026-05-26'),
      reason: 'redundancy',
    };
    const result = calculateNT(employee, trigger);
    expect(result.warnings.map((w) => w.code)).toContain(
      'nt_casual_continuity_broken'
    );
    expect(result.outputs?.totalEntitlement.weeks.value.toFixed(2)).toBe('0.00');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. Ordinary-pay s.7(2) inclusion/exclusion advisories
// ─────────────────────────────────────────────────────────────────────────────

describe('NT T9.2 — s.7(2) ordinary pay advisories', () => {
  it('every NT calc emits the s.7(2) inclusion/exclusion advisories', () => {
    const employee = fullTimeEmployee({
      startDate: asISODate('2014-05-26'),
      endDate: asISODate('2026-05-26'),
    });
    const trigger: Trigger = {
      kind: 'termination',
      terminationDate: asISODate('2026-05-26'),
      reason: 'redundancy',
    };
    const result = calculateNT(employee, trigger);
    const codes = result.warnings.map((w) => w.code);
    expect(codes).toContain('nt_overtime_excluded');
    expect(codes).toContain('nt_penalty_rates_excluded');
    expect(codes).toContain('nt_district_site_climatic_allowance_excluded');
    expect(codes).toContain(
      'nt_industry_leading_hand_skill_qualification_allowance_included'
    );
  });

  it('bonus tokens in note + operator flag true → bonus included advisory', () => {
    const employee = fullTimeEmployee({
      startDate: asISODate('2014-05-26'),
      endDate: asISODate('2026-05-26'),
      wageHistory: [
        {
          periodStart: asISODate('2014-05-26'),
          periodEnd: asISODate('2026-05-26'),
          grossPay: '624000',
          frequency: 'weekly',
          note: 'includes annual bonus',
        },
      ],
      extraInputs: { nt_bonus_usually_paid_with_pay: true },
    });
    const trigger: Trigger = {
      kind: 'termination',
      terminationDate: asISODate('2026-05-26'),
      reason: 'redundancy',
    };
    const result = calculateNT(employee, trigger);
    expect(result.warnings.map((w) => w.code)).toContain(
      'nt_bonus_usually_paid_with_pay_included'
    );
  });

  it('bonus tokens in note + no operator flag → bonus excluded advisory (default)', () => {
    const employee = fullTimeEmployee({
      startDate: asISODate('2014-05-26'),
      endDate: asISODate('2026-05-26'),
      wageHistory: [
        {
          periodStart: asISODate('2014-05-26'),
          periodEnd: asISODate('2026-05-26'),
          grossPay: '624000',
          frequency: 'weekly',
          note: 'incentive payment included',
        },
      ],
    });
    const trigger: Trigger = {
      kind: 'termination',
      terminationDate: asISODate('2026-05-26'),
      reason: 'redundancy',
    };
    const result = calculateNT(employee, trigger);
    expect(result.warnings.map((w) => w.code)).toContain(
      'nt_bonus_usually_paid_with_pay_excluded'
    );
  });

  it('board/lodging operator-supplied value → advisory fires', () => {
    const employee = fullTimeEmployee({
      startDate: asISODate('2014-05-26'),
      endDate: asISODate('2026-05-26'),
      extraInputs: { nt_board_lodging_cash_value_weekly: 20 },
    });
    const trigger: Trigger = {
      kind: 'termination',
      terminationDate: asISODate('2026-05-26'),
      reason: 'redundancy',
    };
    const result = calculateNT(employee, trigger);
    expect(result.warnings.map((w) => w.code)).toContain('nt_board_lodging_included');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. As-at snapshot — qualifying-period bypass (E1 spec D20)
// ─────────────────────────────────────────────────────────────────────────────

describe('NT T9.2 — as_at snapshot (E1 spec D20)', () => {
  it('as_at snapshot with sub-7-yr tenure → accrued_not_currently_payable', () => {
    const employee = fullTimeEmployee({
      startDate: asISODate('2022-05-26'),
      endDate: undefined,
    });
    const accrual = accrualNT(
      new Decimal('4'),
      employee,
      { kind: 'as_at', asAtDate: asISODate('2026-05-26') },
      new Decimal(0)
    );
    expect(accrual.payableIndicator).toBe('accrued_not_currently_payable');
    expect(accrual.payableWeeks.toFixed(4)).toBe(
      ntAccrualConstants.perYearWeeks.times(4).toFixed(4)
    );
  });

  it('as_at snapshot with 10+ yr tenure → payable', () => {
    const employee = fullTimeEmployee({
      startDate: asISODate('2014-05-26'),
      endDate: undefined,
    });
    const accrual = accrualNT(
      new Decimal('12'),
      employee,
      { kind: 'as_at', asAtDate: asISODate('2026-05-26') },
      new Decimal(0)
    );
    expect(accrual.payableIndicator).toBe('payable');
  });
});
