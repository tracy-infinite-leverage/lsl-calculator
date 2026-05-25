import { describe, it, expect } from 'vitest';
import { calculate } from '../dispatch';
import { asISODate } from './types';
import type { Employee, Trigger, TerminationReason } from './types';

/**
 * Cross-state assurance for the DEV-CROSS-1 termination-enum refactor.
 *
 * The new enum values (`unfair_dismissal`, `poor_performance`) and the new
 * optional `terminationInitiator` field are *additive*: NSW + VIC + QLD must
 * all accept them without throwing, and their behaviour for the new values
 * must match the documented fall-through (typically "non-qualifying =
 * voluntary_resignation behaviour" for sub-10yr cases).
 *
 * These tests deliberately do NOT pin numeric outputs to byte-level — the
 * per-state gold-standard suites cover that. Here we cover the enum-coverage
 * contract.
 */
function baseEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 'EMP-001',
    startDate: asISODate('2014-05-22'),
    endDate: asISODate('2026-05-21'),
    employmentType: 'full_time',
    statesOfService: ['NSW'],
    currentWeeklyGross: '1500',
    wageHistory: [
      {
        periodStart: asISODate('2025-05-22'),
        periodEnd: asISODate('2026-05-21'),
        grossPay: '78000',
        frequency: 'other',
        periodDays: 365,
      },
    ],
    serviceEvents: [],
    ...overrides,
  };
}

const ALL_NEW_REASONS: TerminationReason[] = ['unfair_dismissal', 'poor_performance'];
const ALL_REASONS: TerminationReason[] = [
  'voluntary_resignation',
  'employer_initiated_not_misconduct',
  'redundancy',
  'serious_misconduct',
  'illness_incapacity',
  'domestic_pressing_necessity',
  'death',
  'unfair_dismissal',
  'poor_performance',
];

describe('TerminationReason enum — additive cross-state coverage', () => {
  describe('NSW accepts every enum value without throwing', () => {
    for (const reason of ALL_REASONS) {
      it(`reason="${reason}" returns a Result (no throw)`, () => {
        const employee = baseEmployee({
          statesOfService: ['NSW'],
          governingJurisdiction: 'NSW',
        });
        const trigger: Trigger = {
          kind: 'termination',
          terminationDate: asISODate('2026-05-21'),
          reason,
        };
        expect(() => calculate(employee, trigger)).not.toThrow();
        const r = calculate(employee, trigger);
        expect(r.status).toBe('computed');
      });
    }
  });

  describe('VIC accepts every enum value without throwing', () => {
    for (const reason of ALL_REASONS) {
      it(`reason="${reason}" returns a Result (no throw)`, () => {
        const employee = baseEmployee({
          statesOfService: ['VIC'],
          governingJurisdiction: 'VIC',
        });
        const trigger: Trigger = {
          kind: 'termination',
          terminationDate: asISODate('2026-05-21'),
          reason,
        };
        expect(() => calculate(employee, trigger)).not.toThrow();
        const r = calculate(employee, trigger);
        expect(r.status).toBe('computed');
      });
    }
  });

  describe('QLD accepts every enum value without throwing', () => {
    for (const reason of ALL_REASONS) {
      it(`reason="${reason}" returns a Result (no throw)`, () => {
        const employee = baseEmployee({
          statesOfService: ['QLD'],
          governingJurisdiction: 'QLD',
        });
        const trigger: Trigger = {
          kind: 'termination',
          terminationDate: asISODate('2026-05-21'),
          reason,
        };
        expect(() => calculate(employee, trigger)).not.toThrow();
        const r = calculate(employee, trigger);
        expect(r.status).toBe('computed');
      });
    }
  });

  describe('NSW behaviour for new enum values at sub-10yr (5-10yr band) — no entitlement', () => {
    // At 8 yrs (between 5 and 10), only QUALIFYING reasons pay out in NSW.
    // unfair_dismissal and poor_performance are NOT in the qualifying set, so
    // they MUST produce 0 payable weeks — same as voluntary_resignation.
    for (const reason of ALL_NEW_REASONS) {
      it(`reason="${reason}" at 8yr → 0 weeks (non-qualifying)`, () => {
        const employee = baseEmployee({
          // 8-yr tenure (2018-05-22 → 2026-05-21)
          startDate: asISODate('2018-05-22'),
          statesOfService: ['NSW'],
          governingJurisdiction: 'NSW',
          endDate: asISODate('2026-05-21'),
        });
        const trigger: Trigger = {
          kind: 'termination',
          terminationDate: asISODate('2026-05-21'),
          reason,
        };
        const r = calculate(employee, trigger);
        expect(r.status).toBe('computed');
        expect(r.outputs?.totalEntitlement.weeks.value.toString()).toBe('0');
        expect(r.diagnostics?.payableIndicator).toBe('accrued_not_currently_payable');
      });
    }
  });

  describe('VIC behaviour for new enum values at 8yr — full payout (no reason gate above 7yr)', () => {
    for (const reason of ALL_NEW_REASONS) {
      it(`reason="${reason}" at 8yr → payable (VIC has no reason gate above 7yr)`, () => {
        const employee = baseEmployee({
          startDate: asISODate('2018-05-22'),
          statesOfService: ['VIC'],
          governingJurisdiction: 'VIC',
          endDate: asISODate('2026-05-21'),
        });
        const trigger: Trigger = {
          kind: 'termination',
          terminationDate: asISODate('2026-05-21'),
          reason,
        };
        const r = calculate(employee, trigger);
        expect(r.status).toBe('computed');
        expect(r.diagnostics?.payableIndicator).toBe('payable');
        expect(Number(r.outputs?.totalEntitlement.weeks.value.toString())).toBeGreaterThan(0);
      });
    }
  });

  describe('QLD behaviour for new enum values at 8yr', () => {
    it('unfair_dismissal at 8yr → payable (s.95(3)(e))', () => {
      const employee = baseEmployee({
        startDate: asISODate('2018-05-22'),
        statesOfService: ['QLD'],
        governingJurisdiction: 'QLD',
        endDate: asISODate('2026-05-21'),
      });
      const trigger: Trigger = {
        kind: 'termination',
        terminationDate: asISODate('2026-05-21'),
        reason: 'unfair_dismissal',
      };
      const r = calculate(employee, trigger);
      expect(r.status).toBe('computed');
      expect(r.diagnostics?.payableIndicator).toBe('payable');
      expect(Number(r.outputs?.totalEntitlement.weeks.value.toString())).toBeGreaterThan(0);
      // Citation should reference s.95(3)(e).
      const allCitations = [
        ...(r.outputs?.totalEntitlement.weeks.citations ?? []),
        ...(r.outputs?.totalEntitlement.dollars.citations ?? []),
      ];
      const hasUnfairDismissalCitation = allCitations.some((c) =>
        c.section.includes('s.95(3)(e)')
      );
      expect(hasUnfairDismissalCitation).toBe(true);
    });

    it('poor_performance at 8yr → 0 weeks (s.95(3)(d) excludes performance)', () => {
      const employee = baseEmployee({
        startDate: asISODate('2018-05-22'),
        statesOfService: ['QLD'],
        governingJurisdiction: 'QLD',
        endDate: asISODate('2026-05-21'),
      });
      const trigger: Trigger = {
        kind: 'termination',
        terminationDate: asISODate('2026-05-21'),
        reason: 'poor_performance',
      };
      const r = calculate(employee, trigger);
      expect(r.status).toBe('computed');
      expect(r.outputs?.totalEntitlement.weeks.value.toString()).toBe('0');
      expect(r.diagnostics?.payableIndicator).toBe('accrued_not_currently_payable');
      // Should emit the sub_10yr_no_qualifying_reason_qld warning.
      expect(
        r.warnings.some((w) => w.code === 'sub_10yr_no_qualifying_reason_qld')
      ).toBe(true);
    });
  });
});

describe('terminationInitiator — additive cross-state coverage', () => {
  it('NSW ignores terminationInitiator (no behaviour change)', () => {
    const employee = baseEmployee({
      startDate: asISODate('2014-05-22'),
      statesOfService: ['NSW'],
      governingJurisdiction: 'NSW',
      endDate: asISODate('2026-05-21'),
    });
    const withoutInitiator: Trigger = {
      kind: 'termination',
      terminationDate: asISODate('2026-05-21'),
      reason: 'illness_incapacity',
    };
    const withInitiator: Trigger = {
      kind: 'termination',
      terminationDate: asISODate('2026-05-21'),
      reason: 'illness_incapacity',
      terminationInitiator: 'employer',
    };
    const r1 = calculate(employee, withoutInitiator);
    const r2 = calculate(employee, withInitiator);
    // NSW result is byte-identical (modulo the trigger payload, which IS
    // expected to differ because the initiator round-trips through `result.trigger`).
    expect(r1.outputs).toEqual(r2.outputs);
    expect(r1.warnings).toEqual(r2.warnings);
    expect(r1.status).toBe(r2.status);
  });

  it('VIC ignores terminationInitiator (no behaviour change)', () => {
    const employee = baseEmployee({
      startDate: asISODate('2014-05-22'),
      statesOfService: ['VIC'],
      governingJurisdiction: 'VIC',
      endDate: asISODate('2026-05-21'),
    });
    const withoutInitiator: Trigger = {
      kind: 'termination',
      terminationDate: asISODate('2026-05-21'),
      reason: 'illness_incapacity',
    };
    const withInitiator: Trigger = {
      kind: 'termination',
      terminationDate: asISODate('2026-05-21'),
      reason: 'illness_incapacity',
      terminationInitiator: 'employer',
    };
    const r1 = calculate(employee, withoutInitiator);
    const r2 = calculate(employee, withInitiator);
    expect(r1.outputs).toEqual(r2.outputs);
    expect(r1.warnings).toEqual(r2.warnings);
    expect(r1.status).toBe(r2.status);
  });

  describe('QLD disambiguates illness_incapacity by initiator (citation only)', () => {
    it('omitted initiator defaults to employee-initiated → s.95(3)(b) citation', () => {
      const employee = baseEmployee({
        startDate: asISODate('2018-05-22'), // 8 yrs
        statesOfService: ['QLD'],
        governingJurisdiction: 'QLD',
        endDate: asISODate('2026-05-21'),
      });
      const trigger: Trigger = {
        kind: 'termination',
        terminationDate: asISODate('2026-05-21'),
        reason: 'illness_incapacity',
        // no initiator → defaults to employee
      };
      const r = calculate(employee, trigger);
      const allCitations = [
        ...(r.outputs?.totalEntitlement.weeks.citations ?? []),
        ...(r.outputs?.totalEntitlement.dollars.citations ?? []),
      ];
      expect(allCitations.some((c) => c.section.includes('s.95(3)(b)'))).toBe(true);
      expect(allCitations.some((c) => c.section.includes('s.95(3)(c)'))).toBe(false);
    });

    it('employee-initiated illness → s.95(3)(b) citation', () => {
      const employee = baseEmployee({
        startDate: asISODate('2018-05-22'),
        statesOfService: ['QLD'],
        governingJurisdiction: 'QLD',
        endDate: asISODate('2026-05-21'),
      });
      const trigger: Trigger = {
        kind: 'termination',
        terminationDate: asISODate('2026-05-21'),
        reason: 'illness_incapacity',
        terminationInitiator: 'employee',
      };
      const r = calculate(employee, trigger);
      const allCitations = [
        ...(r.outputs?.totalEntitlement.weeks.citations ?? []),
        ...(r.outputs?.totalEntitlement.dollars.citations ?? []),
      ];
      expect(allCitations.some((c) => c.section.includes('s.95(3)(b)'))).toBe(true);
      expect(allCitations.some((c) => c.section.includes('s.95(3)(c)'))).toBe(false);
    });

    it('employer-initiated illness → s.95(3)(c) citation (different sub-paragraph, same dollars)', () => {
      const employee = baseEmployee({
        startDate: asISODate('2018-05-22'),
        statesOfService: ['QLD'],
        governingJurisdiction: 'QLD',
        endDate: asISODate('2026-05-21'),
      });
      const baseTrigger: Trigger = {
        kind: 'termination',
        terminationDate: asISODate('2026-05-21'),
        reason: 'illness_incapacity',
      };
      const employerTrigger: Trigger = {
        ...baseTrigger,
        kind: 'termination',
        terminationInitiator: 'employer',
      };

      const employeeResult = calculate(employee, baseTrigger);
      const employerResult = calculate(employee, employerTrigger);

      // Same dollars, same weeks — citation differs only.
      expect(employeeResult.outputs?.totalEntitlement.dollars.value.toString()).toBe(
        employerResult.outputs?.totalEntitlement.dollars.value.toString()
      );
      expect(employeeResult.outputs?.totalEntitlement.weeks.value.toString()).toBe(
        employerResult.outputs?.totalEntitlement.weeks.value.toString()
      );

      const employerCitations = [
        ...(employerResult.outputs?.totalEntitlement.weeks.citations ?? []),
        ...(employerResult.outputs?.totalEntitlement.dollars.citations ?? []),
      ];
      expect(employerCitations.some((c) => c.section.includes('s.95(3)(c)'))).toBe(true);
      expect(employerCitations.some((c) => c.section.includes('s.95(3)(b)'))).toBe(false);
    });
  });
});
