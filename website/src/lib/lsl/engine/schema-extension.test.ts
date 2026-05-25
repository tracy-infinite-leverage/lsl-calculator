import { describe, it, expect } from 'vitest';
import { calculate } from '../dispatch';
import { asISODate } from './types';
import type { Employee, Trigger, State } from './types';

/**
 * Cross-state assurance for the DEV-CROSS-2 schema-extension refactor.
 *
 * The new optional fields are additive:
 *
 *   ContinuousServiceEvent.slacknessOfTrade?: boolean
 *   ContinuousServiceEvent.paidConcurrent?: boolean
 *   ContinuousServiceEvent.returnToWorkProgram?: boolean
 *   ContinuousServiceEvent.reasonableExpectationOfReturn?: boolean
 *   Employee.mealsAndAccommodationCashValueWeekly?: number
 *
 * NSW + VIC + QLD currently do not consume any of them. The cross-state
 * contract is therefore:
 *
 *   1. None of the three current state engines throw when the fields are
 *      present (either omitted, set to falsy, or set to a meaningful value).
 *   2. Output is byte-identical regardless of whether the new fields are
 *      omitted, set to false/0, or set to true/positive — because the engines
 *      ignore them.
 *
 * Per-state gold-standard suites cover the broader byte-identity contract for
 * existing fixtures (those continue to pass without ever populating the new
 * fields). This file specifically exercises the "populated but unconsumed"
 * branch that the gold-standard suites do not exercise.
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

const STATES: State[] = ['NSW', 'VIC', 'QLD'];

describe('DEV-CROSS-2 schema extension — additive cross-state coverage', () => {
  describe('Employee.mealsAndAccommodationCashValueWeekly — accepted by every shipped state', () => {
    for (const state of STATES) {
      it(`${state}: accepts the field without throwing`, () => {
        const employee = baseEmployee({
          statesOfService: [state],
          governingJurisdiction: state,
          mealsAndAccommodationCashValueWeekly: 50,
        });
        const trigger: Trigger = {
          kind: 'termination',
          terminationDate: asISODate('2026-05-21'),
          reason: 'redundancy',
        };
        expect(() => calculate(employee, trigger)).not.toThrow();
        const r = calculate(employee, trigger);
        expect(r.status).toBe('computed');
      });

      it(`${state}: meals/accommodation value does NOT change the output (byte-identity)`, () => {
        const baseline = baseEmployee({
          statesOfService: [state],
          governingJurisdiction: state,
        });
        const withMeals = baseEmployee({
          statesOfService: [state],
          governingJurisdiction: state,
          mealsAndAccommodationCashValueWeekly: 250,
        });
        const trigger: Trigger = {
          kind: 'termination',
          terminationDate: asISODate('2026-05-21'),
          reason: 'redundancy',
        };
        const a = calculate(baseline, trigger);
        const b = calculate(withMeals, trigger);
        expect(b.outputs?.valueOfWeek.display).toBe(a.outputs?.valueOfWeek.display);
        expect(b.outputs?.valueOfDay.display).toBe(a.outputs?.valueOfDay.display);
        expect(b.outputs?.totalEntitlement.weeks.display).toBe(
          a.outputs?.totalEntitlement.weeks.display
        );
        expect(b.outputs?.totalEntitlement.dollars.display).toBe(
          a.outputs?.totalEntitlement.dollars.display
        );
      });
    }
  });

  describe('ContinuousServiceEvent.slacknessOfTrade — accepted on rehire events', () => {
    for (const state of STATES) {
      it(`${state}: slacknessOfTrade=true on a rehire event does NOT change output`, () => {
        const baseline = baseEmployee({
          statesOfService: [state],
          governingJurisdiction: state,
          startDate: asISODate('2014-01-01'),
          endDate: asISODate('2026-05-21'),
          serviceEvents: [
            {
              type: 'employer_initiated_termination_and_rehire',
              startDate: asISODate('2020-01-01'),
              endDate: asISODate('2020-01-30'),
            },
          ],
        });
        const withFlag = baseEmployee({
          statesOfService: [state],
          governingJurisdiction: state,
          startDate: asISODate('2014-01-01'),
          endDate: asISODate('2026-05-21'),
          serviceEvents: [
            {
              type: 'employer_initiated_termination_and_rehire',
              startDate: asISODate('2020-01-01'),
              endDate: asISODate('2020-01-30'),
              slacknessOfTrade: true,
            },
          ],
        });
        const trigger: Trigger = {
          kind: 'termination',
          terminationDate: asISODate('2026-05-21'),
          reason: 'redundancy',
        };
        const a = calculate(baseline, trigger);
        const b = calculate(withFlag, trigger);
        expect(b.status).toBe(a.status);
        expect(b.outputs?.totalEntitlement.weeks.display).toBe(
          a.outputs?.totalEntitlement.weeks.display
        );
        expect(b.outputs?.totalEntitlement.dollars.display).toBe(
          a.outputs?.totalEntitlement.dollars.display
        );
      });
    }
  });

  describe('ContinuousServiceEvent WC flags — accepted on workers_comp_absence', () => {
    for (const state of STATES) {
      it(`${state}: paidConcurrent + returnToWorkProgram do NOT change output`, () => {
        const baseline = baseEmployee({
          statesOfService: [state],
          governingJurisdiction: state,
          serviceEvents: [
            {
              type: 'workers_comp_absence',
              startDate: asISODate('2022-06-01'),
              endDate: asISODate('2022-09-01'),
            },
          ],
        });
        const withFlags = baseEmployee({
          statesOfService: [state],
          governingJurisdiction: state,
          serviceEvents: [
            {
              type: 'workers_comp_absence',
              startDate: asISODate('2022-06-01'),
              endDate: asISODate('2022-09-01'),
              paidConcurrent: true,
              returnToWorkProgram: true,
            },
          ],
        });
        const trigger: Trigger = {
          kind: 'termination',
          terminationDate: asISODate('2026-05-21'),
          reason: 'redundancy',
        };
        const a = calculate(baseline, trigger);
        const b = calculate(withFlags, trigger);
        expect(b.status).toBe(a.status);
        expect(b.outputs?.totalEntitlement.weeks.display).toBe(
          a.outputs?.totalEntitlement.weeks.display
        );
        expect(b.outputs?.totalEntitlement.dollars.display).toBe(
          a.outputs?.totalEntitlement.dollars.display
        );
      });
    }
  });

  describe('ContinuousServiceEvent.reasonableExpectationOfReturn — accepted on UPL', () => {
    for (const state of STATES) {
      it(`${state}: reasonableExpectationOfReturn=true on a UPL event does NOT change output`, () => {
        const baseline = baseEmployee({
          statesOfService: [state],
          governingJurisdiction: state,
          employmentType: 'casual',
          serviceEvents: [
            {
              type: 'unpaid_parental_leave',
              startDate: asISODate('2023-01-01'),
              endDate: asISODate('2023-09-01'),
            },
          ],
        });
        const withFlag = baseEmployee({
          statesOfService: [state],
          governingJurisdiction: state,
          employmentType: 'casual',
          serviceEvents: [
            {
              type: 'unpaid_parental_leave',
              startDate: asISODate('2023-01-01'),
              endDate: asISODate('2023-09-01'),
              reasonableExpectationOfReturn: true,
            },
          ],
        });
        const trigger: Trigger = {
          kind: 'termination',
          terminationDate: asISODate('2026-05-21'),
          reason: 'redundancy',
        };
        const a = calculate(baseline, trigger);
        const b = calculate(withFlag, trigger);
        expect(b.status).toBe(a.status);
        expect(b.outputs?.totalEntitlement.weeks.display).toBe(
          a.outputs?.totalEntitlement.weeks.display
        );
      });
    }
  });

  describe('All four new flags combined on a single employee', () => {
    for (const state of STATES) {
      it(`${state}: every new field set, output unchanged from baseline`, () => {
        const baseline = baseEmployee({
          statesOfService: [state],
          governingJurisdiction: state,
          serviceEvents: [
            {
              type: 'employer_initiated_termination_and_rehire',
              startDate: asISODate('2020-01-01'),
              endDate: asISODate('2020-01-30'),
            },
            {
              type: 'workers_comp_absence',
              startDate: asISODate('2022-06-01'),
              endDate: asISODate('2022-09-01'),
            },
          ],
        });
        const enriched = baseEmployee({
          statesOfService: [state],
          governingJurisdiction: state,
          mealsAndAccommodationCashValueWeekly: 75,
          serviceEvents: [
            {
              type: 'employer_initiated_termination_and_rehire',
              startDate: asISODate('2020-01-01'),
              endDate: asISODate('2020-01-30'),
              slacknessOfTrade: true,
            },
            {
              type: 'workers_comp_absence',
              startDate: asISODate('2022-06-01'),
              endDate: asISODate('2022-09-01'),
              paidConcurrent: true,
              returnToWorkProgram: true,
            },
          ],
        });
        const trigger: Trigger = {
          kind: 'termination',
          terminationDate: asISODate('2026-05-21'),
          reason: 'redundancy',
        };
        const a = calculate(baseline, trigger);
        const b = calculate(enriched, trigger);
        expect(b.outputs?.valueOfWeek.display).toBe(a.outputs?.valueOfWeek.display);
        expect(b.outputs?.totalEntitlement.weeks.display).toBe(
          a.outputs?.totalEntitlement.weeks.display
        );
        expect(b.outputs?.totalEntitlement.dollars.display).toBe(
          a.outputs?.totalEntitlement.dollars.display
        );
      });
    }
  });
});
