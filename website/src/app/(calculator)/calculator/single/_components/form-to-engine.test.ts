import { describe, it, expect } from 'vitest';
import { emptyFormState } from './types';
import { formToEngine, validateForm } from './form-to-engine';

/**
 * Tests for the DEV-CROSS-1 termination-enum refactor — specifically:
 *   - new enum values (`unfair_dismissal`, `poor_performance`) round-trip
 *     correctly through the form
 *   - `terminationInitiator` is only carried into the engine Trigger when
 *     (a) the reason requires it AND (b) the user supplied a value
 *   - validation requires initiator when reason === 'illness_incapacity'
 */
function baseFormState() {
  const s = emptyFormState();
  s.startDate = '2014-05-22';
  s.employmentType = 'full_time';
  s.statesOfService = ['QLD'];
  s.governingJurisdiction = 'QLD';
  s.currentWeeklyGross = '1500';
  s.wageHistory = [
    {
      id: 'a',
      periodStart: '2025-05-22',
      periodEnd: '2026-05-21',
      grossPay: '78000',
      frequency: 'weekly',
      periodDays: '',
      note: '',
    },
  ];
  s.triggerKind = 'termination';
  s.terminationDate = '2026-05-21';
  return s;
}

describe('form-to-engine — DEV-CROSS-1 termination-enum refactor', () => {
  describe('new enum values round-trip', () => {
    it('unfair_dismissal converts to a valid Trigger', () => {
      const s = baseFormState();
      s.terminationReason = 'unfair_dismissal';
      const { trigger } = formToEngine(s);
      expect(trigger.kind).toBe('termination');
      if (trigger.kind === 'termination') {
        expect(trigger.reason).toBe('unfair_dismissal');
        expect(trigger.terminationInitiator).toBeUndefined();
      }
    });

    it('poor_performance converts to a valid Trigger', () => {
      const s = baseFormState();
      s.terminationReason = 'poor_performance';
      const { trigger } = formToEngine(s);
      expect(trigger.kind).toBe('termination');
      if (trigger.kind === 'termination') {
        expect(trigger.reason).toBe('poor_performance');
        expect(trigger.terminationInitiator).toBeUndefined();
      }
    });
  });

  describe('terminationInitiator propagation', () => {
    it('carries terminationInitiator when reason=illness_incapacity AND value supplied', () => {
      const s = baseFormState();
      s.terminationReason = 'illness_incapacity';
      s.terminationInitiator = 'employer';
      const { trigger } = formToEngine(s);
      if (trigger.kind === 'termination') {
        expect(trigger.terminationInitiator).toBe('employer');
      }
    });

    it('omits terminationInitiator when reason=illness_incapacity but value not supplied', () => {
      const s = baseFormState();
      s.terminationReason = 'illness_incapacity';
      s.terminationInitiator = '';
      const { trigger } = formToEngine(s);
      if (trigger.kind === 'termination') {
        // Field is omitted (not undefined-via-assignment). The engine
        // defaults to 'employee' in that case.
        expect(trigger.terminationInitiator).toBeUndefined();
      }
    });

    it('omits terminationInitiator for reasons that do not require it (voluntary_resignation)', () => {
      const s = baseFormState();
      s.terminationReason = 'voluntary_resignation';
      // Even if the user previously selected an initiator (e.g. localStorage
      // had stale state from a prior illness_incapacity selection), we drop it
      // on translate because the reason no longer needs it.
      s.terminationInitiator = 'employer';
      const { trigger } = formToEngine(s);
      if (trigger.kind === 'termination') {
        expect(trigger.terminationInitiator).toBeUndefined();
      }
    });

    it('omits terminationInitiator for new reasons (unfair_dismissal, poor_performance)', () => {
      for (const reason of ['unfair_dismissal', 'poor_performance'] as const) {
        const s = baseFormState();
        s.terminationReason = reason;
        s.terminationInitiator = 'employer'; // stale carry-over
        const { trigger } = formToEngine(s);
        if (trigger.kind === 'termination') {
          expect(trigger.terminationInitiator).toBeUndefined();
        }
      }
    });
  });

  describe('validation — terminationInitiator required for illness_incapacity', () => {
    it('flags missing initiator when termination reason is illness_incapacity', () => {
      const s = baseFormState();
      s.terminationReason = 'illness_incapacity';
      s.terminationInitiator = '';
      const v = validateForm(s);
      expect(v.ok).toBe(false);
      expect(v.fieldErrors.terminationInitiator).toBeDefined();
    });

    it('passes when initiator is supplied for illness_incapacity', () => {
      const s = baseFormState();
      s.terminationReason = 'illness_incapacity';
      s.terminationInitiator = 'employee';
      const v = validateForm(s);
      expect(v.fieldErrors.terminationInitiator).toBeUndefined();
    });

    it('does NOT require initiator for other reasons (voluntary_resignation)', () => {
      const s = baseFormState();
      s.terminationReason = 'voluntary_resignation';
      s.terminationInitiator = '';
      const v = validateForm(s);
      expect(v.fieldErrors.terminationInitiator).toBeUndefined();
    });

    it('does NOT require initiator for new reasons (unfair_dismissal, poor_performance)', () => {
      for (const reason of ['unfair_dismissal', 'poor_performance'] as const) {
        const s = baseFormState();
        s.terminationReason = reason;
        s.terminationInitiator = '';
        const v = validateForm(s);
        expect(v.fieldErrors.terminationInitiator).toBeUndefined();
      }
    });
  });
});

/**
 * Tests for the DEV-CROSS-2 schema extension — specifically:
 *   - `mealsAndAccommodationCashValueWeekly` round-trips from the form to the
 *     engine Employee shape when a positive number is supplied; otherwise
 *     omitted entirely.
 *   - Per-event optional flags (slacknessOfTrade / paidConcurrent /
 *     returnToWorkProgram / reasonableExpectationOfReturn) are only carried
 *     into the engine event when (a) the event type matches AND (b) the user
 *     ticked the flag.
 *   - reasonableExpectationOfReturn requires the secondary casual gate.
 *   - Validation flags non-numeric meals/accommodation cash value.
 */
describe('form-to-engine — DEV-CROSS-2 schema extension', () => {
  describe('Employee.mealsAndAccommodationCashValueWeekly', () => {
    it('is attached when the user supplies a positive number', () => {
      const s = baseFormState();
      s.mealsAndAccommodationCashValueWeekly = '125.50';
      const { employee } = formToEngine(s);
      expect(employee.mealsAndAccommodationCashValueWeekly).toBe(125.5);
    });

    it('is omitted when the field is empty', () => {
      const s = baseFormState();
      s.mealsAndAccommodationCashValueWeekly = '';
      const { employee } = formToEngine(s);
      expect(employee.mealsAndAccommodationCashValueWeekly).toBeUndefined();
    });

    it('is omitted when the user supplies 0', () => {
      const s = baseFormState();
      s.mealsAndAccommodationCashValueWeekly = '0';
      const { employee } = formToEngine(s);
      expect(employee.mealsAndAccommodationCashValueWeekly).toBeUndefined();
    });

    it('validation: rejects a non-numeric value', () => {
      const s = baseFormState();
      s.mealsAndAccommodationCashValueWeekly = 'abc';
      const v = validateForm(s);
      expect(v.ok).toBe(false);
      expect(v.fieldErrors.mealsAndAccommodationCashValueWeekly).toBeDefined();
    });

    it('validation: accepts empty (optional field)', () => {
      const s = baseFormState();
      s.mealsAndAccommodationCashValueWeekly = '';
      const v = validateForm(s);
      expect(v.fieldErrors.mealsAndAccommodationCashValueWeekly).toBeUndefined();
    });
  });

  describe('ServiceEvent.slacknessOfTrade', () => {
    it('is attached when user ticks it on an employer-rehire event', () => {
      const s = baseFormState();
      s.serviceEvents = [
        {
          id: 'a',
          type: 'employer_initiated_termination_and_rehire',
          startDate: '2020-01-01',
          endDate: '2020-01-30',
          note: '',
          slacknessOfTrade: true,
        },
      ];
      const { employee } = formToEngine(s);
      expect(employee.serviceEvents[0].slacknessOfTrade).toBe(true);
    });

    it('is omitted when user does not tick it', () => {
      const s = baseFormState();
      s.serviceEvents = [
        {
          id: 'a',
          type: 'employer_initiated_termination_and_rehire',
          startDate: '2020-01-01',
          endDate: '2020-01-30',
          note: '',
          slacknessOfTrade: false,
        },
      ];
      const { employee } = formToEngine(s);
      expect(employee.serviceEvents[0].slacknessOfTrade).toBeUndefined();
    });

    it('is omitted when the event type is NOT a rehire (stale carry-over)', () => {
      // Mirror DEV-CROSS-1's "stale carry-over" pattern — if a user switched
      // the event type, the flag should not propagate.
      const s = baseFormState();
      s.serviceEvents = [
        {
          id: 'a',
          type: 'paid_leave',
          startDate: '2020-01-01',
          endDate: '2020-01-30',
          note: '',
          slacknessOfTrade: true,
        },
      ];
      const { employee } = formToEngine(s);
      expect(employee.serviceEvents[0].slacknessOfTrade).toBeUndefined();
    });
  });

  describe('ServiceEvent WC flags', () => {
    it('attaches paidConcurrent + returnToWorkProgram when ticked on WC event', () => {
      const s = baseFormState();
      s.serviceEvents = [
        {
          id: 'a',
          type: 'workers_comp_absence',
          startDate: '2022-06-01',
          endDate: '2022-09-01',
          note: '',
          paidConcurrent: true,
          returnToWorkProgram: true,
        },
      ];
      const { employee } = formToEngine(s);
      expect(employee.serviceEvents[0].paidConcurrent).toBe(true);
      expect(employee.serviceEvents[0].returnToWorkProgram).toBe(true);
    });

    it('omits both when the event type is NOT WC', () => {
      const s = baseFormState();
      s.serviceEvents = [
        {
          id: 'a',
          type: 'paid_leave',
          startDate: '2022-06-01',
          endDate: '2022-09-01',
          note: '',
          paidConcurrent: true,
          returnToWorkProgram: true,
        },
      ];
      const { employee } = formToEngine(s);
      expect(employee.serviceEvents[0].paidConcurrent).toBeUndefined();
      expect(employee.serviceEvents[0].returnToWorkProgram).toBeUndefined();
    });

    it('omits when the user does not tick either', () => {
      const s = baseFormState();
      s.serviceEvents = [
        {
          id: 'a',
          type: 'workers_comp_absence',
          startDate: '2022-06-01',
          endDate: '2022-09-01',
          note: '',
        },
      ];
      const { employee } = formToEngine(s);
      expect(employee.serviceEvents[0].paidConcurrent).toBeUndefined();
      expect(employee.serviceEvents[0].returnToWorkProgram).toBeUndefined();
    });
  });

  describe('ServiceEvent.reasonableExpectationOfReturn — casual-only', () => {
    it('attaches when employmentType=casual AND event=UPL AND ticked', () => {
      const s = baseFormState();
      s.employmentType = 'casual';
      s.serviceEvents = [
        {
          id: 'a',
          type: 'unpaid_parental_leave',
          startDate: '2023-01-01',
          endDate: '2023-09-01',
          note: '',
          reasonableExpectationOfReturn: true,
        },
      ];
      const { employee } = formToEngine(s);
      expect(employee.serviceEvents[0].reasonableExpectationOfReturn).toBe(true);
    });

    it('omits when employmentType=full_time even if user ticked it', () => {
      // The conditional UI hides the checkbox for non-casuals; this asserts
      // form-to-engine also strips it if stale state survives.
      const s = baseFormState();
      s.employmentType = 'full_time';
      s.serviceEvents = [
        {
          id: 'a',
          type: 'unpaid_parental_leave',
          startDate: '2023-01-01',
          endDate: '2023-09-01',
          note: '',
          reasonableExpectationOfReturn: true,
        },
      ];
      const { employee } = formToEngine(s);
      expect(employee.serviceEvents[0].reasonableExpectationOfReturn).toBeUndefined();
    });

    it('omits when the event is NOT UPL', () => {
      const s = baseFormState();
      s.employmentType = 'casual';
      s.serviceEvents = [
        {
          id: 'a',
          type: 'leave_without_pay',
          startDate: '2023-01-01',
          endDate: '2023-09-01',
          note: '',
          reasonableExpectationOfReturn: true,
        },
      ];
      const { employee } = formToEngine(s);
      expect(employee.serviceEvents[0].reasonableExpectationOfReturn).toBeUndefined();
    });
  });
});
