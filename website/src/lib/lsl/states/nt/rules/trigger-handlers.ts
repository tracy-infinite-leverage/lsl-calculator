import { citation } from '@/lib/lsl/engine/citation';
import type { Citation, Trigger } from '@/lib/lsl/engine/types';

/**
 * NT trigger-handlers — emit citations based on trigger kind.
 *
 * NT LSL Act 1981 s.9 — PH-INCLUSIVE (parallel to SA; OPPOSITE to NSW/VIC/QLD
 * /WA/ACT/TAS). A public holiday falling within an LSL period is PART of LSL;
 * the LSL period is NOT extended.
 *
 * Cash-out (s.10(4)): FORBIDDEN — handled in the orchestrator via
 * `NTCashOutForbiddenError` hard-error path (TBD-NT-08 RESOLVED Option (b)).
 * Reaching this function with `kind === 'cash_out'` is unreachable in the
 * normal NT calc path; if it does occur (defensive), surface the s.10(4)
 * citation.
 *
 * Pay-on-termination (s.10 operational reading): "as soon as practicable"
 * after cessation — engine OMITS the `payable_by` field (TBD-NT-09 RESOLVED
 * Option (b), parallel to NSW "forthwith"). The orchestrator surfaces the
 * `nt_payable_as_soon_as_practicable_advisory` instead of a date.
 */
export function triggerCitationsNT(trigger: Trigger): Citation[] {
  switch (trigger.kind) {
    case 'taking_leave':
      return [
        citation(
          'NT LSL Act 1981 s.9',
          'trigger.taking-leave.ph-inclusive-no-extension',
          0
        ),
        citation('NT LSL Act 1981 s.8', 'trigger.taking-leave', 0),
      ];
    case 'termination': {
      const out: Citation[] = [
        citation(
          'NT LSL Act 1981 s.10',
          'termination.pay-as-soon-as-practicable',
          0
        ),
      ];
      if (trigger.reason === 'death') {
        out.push(
          citation(
            'NT LSL Act 1981 s.10(3)',
            'trigger.termination.death.payable-to-personal-representative',
            0
          )
        );
      }
      return out;
    }
    case 'as_at':
      return [
        citation(
          'NT LSL Act 1981 s.8',
          'trigger.as-at.snapshot',
          0,
          'as-at snapshot per E1 spec D20 — qualifying-period threshold NOT applied'
        ),
      ];
    case 'cash_out':
      // Defensive — orchestrator short-circuits cash-out with hard error before
      // reaching this point. Surface the s.10(4) prohibition citation.
      return [
        citation(
          'NT LSL Act 1981 s.10(4)',
          'cashout.forbidden-no-payment-in-lieu',
          0
        ),
      ];
  }
}

/**
 * NT pay-on-termination is "as soon as practicable" — engine OMITS the
 * `payable_by` field entirely (TBD-NT-09 RESOLVED Option (b)). Helper returns
 * `undefined`; caller leaves the field unset and emits the
 * `nt_payable_as_soon_as_practicable_advisory` advisory instead.
 *
 * Kept as a function for parity with TAS/ACT `payableByDate*` shape and for
 * future compatibility if the operational interpretation tightens to a fixed
 * window.
 */
export function payableByDateNT(_terminationDate: string): string | undefined {
  void _terminationDate;
  return undefined;
}
