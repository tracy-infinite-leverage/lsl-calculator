import { citation } from '@/lib/lsl/engine/citation';
import type { Citation, Trigger } from '@/lib/lsl/engine/types';

/**
 * SA trigger-handlers — emit citations based on trigger kind.
 *
 * Like QLD/WA, SA's `cash_out` trigger does NOT hard-error — three advisory
 * codes are emitted from `index.ts` per TBD-SA-06 RESOLUTION.
 *
 * SA-headliner (F11/AC13): `taking_leave` emits the PH-INCLUSIVE citation —
 * public holidays falling within an LSL period count as days of LSL and do
 * NOT extend the leave. This is the SA-specific divergence from NSW/VIC/QLD/WA
 * (all of which apply exclusive PH-during-LSL).
 *
 * Sources: SA LSL Act 1987 s.5 (and s.5(3) for cash-out per TBD-SA-03 — Act-level
 * citation only, documented limitation pending RES-3 quarterly review).
 */
export function triggerCitationsSA(trigger: Trigger): Citation[] {
  switch (trigger.kind) {
    case 'taking_leave':
      return [
        citation(
          'SA LSL Act 1987 s.5',
          'trigger.taking-leave.ph-inclusive-no-extension',
          80
        ),
      ];
    case 'termination': {
      const out: Citation[] = [
        citation(
          'SA LSL Act 1987 s.5(3)',
          'trigger.termination.payable-immediately',
          81
        ),
      ];
      if (trigger.reason === 'death') {
        out.push(
          citation(
            'SA LSL Act 1987 s.5',
            'trigger.termination.death-vests-in-personal-representative',
            82
          )
        );
      }
      return out;
    }
    case 'as_at':
      return [
        citation(
          'SA LSL Act 1987 s.5',
          'trigger.as-at.snapshot',
          80,
          'as-at snapshot per E1 spec D20 — qualifying-period threshold NOT applied'
        ),
      ];
    case 'cash_out':
      // Advisory-only: engine still computes; warnings emitted from `index.ts`.
      // TBD-SA-03 RESOLUTION: cite at Act level (s.5) only — documented
      // limitation pending RES-3 quarterly review.
      return [
        citation(
          'SA LSL Act 1987 s.5',
          'cashout.post-10yr-written-agreement-required',
          80
        ),
      ];
  }
}
