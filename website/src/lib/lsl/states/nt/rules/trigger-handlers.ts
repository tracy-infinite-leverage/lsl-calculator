import { citation } from '@/lib/lsl/engine/citation';
import { NTCashOutForbiddenError } from '@/lib/lsl/engine/errors';
import type { Citation, Trigger } from '@/lib/lsl/engine/types';

/**
 * NT trigger-handlers — T9.1 SCAFFOLD.
 *
 * NT LSL Act 1981 s.9 — PH-INCLUSIVE (PARALLEL to SA; OPPOSITE to NSW/VIC/QLD/
 * WA/TAS/ACT). A public holiday falling within an LSL period is part of LSL;
 * the period is NOT extended.
 *
 * Cash-out: s.10(4) — FORBIDDEN. Per TBD-NT-08 RESOLVED Option (b), engine
 * raises a hard error (`status: failed` + `error.code:
 * 'nt_cashout_forbidden_s10_4'`). Cross-state parallel to VIC s.34 cash-out
 * prohibition.
 *
 * Pay-on-termination: s.10 says "as soon as practicable" after cessation.
 * Per TBD-NT-09 RESOLVED Option (b), engine OMITS `payable_by` and emits
 * `nt_payable_as_soon_as_practicable_advisory`. Parallel to NSW "forthwith"
 * treatment.
 */
export function triggerCitationsNT(trigger: Trigger): Citation[] {
  switch (trigger.kind) {
    case 'taking_leave':
      return [
        citation(
          'NT LSL Act 1981 s.9',
          'trigger.taking-leave.ph-inclusive-in-lsl',
          0
        ),
        citation('NT LSL Act 1981 s.8', 'trigger.taking-leave', 0),
      ];
    case 'termination': {
      const out: Citation[] = [
        citation(
          'NT LSL Act 1981 s.10',
          'termination.payable-as-soon-as-practicable',
          0
        ),
      ];
      if (trigger.reason === 'death') {
        out.push(
          citation(
            'NT LSL Act 1981 s.10(3)',
            'trigger.termination.death.personal-representative',
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
      // Citation emitted alongside the hard error in the orchestrator. Kept
      // here for completeness — caller surfaces the s.10(4) section ref.
      return [
        citation('NT LSL Act 1981 s.10(4)', 'cashout.forbidden-s10-4', 0),
      ];
  }
}

/**
 * NT cash-out gate per s.10(4) and TBD-NT-08 RESOLVED Option (b). Cross-state
 * parallel to VIC s.34 (same engine semantics — different statutory mechanism).
 * Engine refuses `cash_out` triggers with a hard error — no numeric output.
 *
 * T9.1 SCAFFOLD: throws `NTCashOutForbiddenError`. The orchestrator's
 * `calculateNTSafe` catches and writes `status: failed` +
 * `error.code: 'nt_cashout_forbidden_s10_4'`.
 */
export function refuseCashOutNT(): never {
  throw new NTCashOutForbiddenError();
}
