import { citation } from '@/lib/lsl/engine/citation';
import type { Citation, Trigger } from '@/lib/lsl/engine/types';

/**
 * TAS trigger-handlers — emit citations based on trigger kind.
 *
 * TAS LSL Act 1976 s.12(9) — PH-EXCLUSIVE (parallel to NSW/VIC/QLD/WA/ACT;
 * OPPOSITE to SA).
 *
 * Cash-out: s.10 PERMITTED by agreement once 10-yr entitlement reached.
 * Sub-10-yr cash-out → not authorised (s.10 implied — no entitlement yet).
 *
 * Pay-on-termination: s.12(4) — "employee shall be deemed to have commenced
 * to take his leave on the date of termination". Engine surfaces
 * `payable_by = terminationDate` itself (TBD-TAS-08 RESOLVED — reuse the
 * ACT-introduced `Result.payable_by` field; for TAS the window is 0 days).
 */
export function triggerCitationsTAS(trigger: Trigger): Citation[] {
  switch (trigger.kind) {
    case 'taking_leave':
      return [
        citation(
          'TAS LSL Act 1976 s.12(9)',
          'trigger.taking-leave.ph-exclusive-extends-leave',
          98
        ),
        citation('TAS LSL Act 1976 s.12', 'trigger.taking-leave', 98),
      ];
    case 'termination': {
      const out: Citation[] = [
        citation(
          'TAS LSL Act 1976 s.12(4)',
          'termination.deemed-commenced-on-cessation-date',
          98
        ),
      ];
      if (trigger.reason === 'death') {
        out.push(
          citation('TAS LSL Act 1976 s.8(3)', 'trigger.termination.death', 97)
        );
      }
      return out;
    }
    case 'as_at':
      return [
        citation(
          'TAS LSL Act 1976 s.8',
          'trigger.as-at.snapshot',
          96,
          'as-at snapshot per E1 spec D20 — qualifying-period threshold NOT applied'
        ),
      ];
    case 'cash_out':
      return [
        citation(
          'TAS LSL Act 1976 s.10',
          'cashout.post-10yr-permitted-by-agreement',
          97
        ),
      ];
  }
}

/**
 * For TAS, `payable_by = terminationDate` itself per s.12(4) — the worker is
 * deemed to have commenced LSL on the date of termination, so the obligation
 * crystallises on that day. Helper returns the input date unchanged but is
 * kept as a function for parity with `payableByDate` in ACT and for future
 * compatibility if WorkSafe Tasmania amends the timing.
 */
export function payableByDateTAS(terminationDate: string): string {
  return terminationDate;
}
