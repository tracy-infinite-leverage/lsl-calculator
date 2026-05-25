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
