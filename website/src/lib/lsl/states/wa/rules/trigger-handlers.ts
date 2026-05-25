import { citation } from '@/lib/lsl/engine/citation';
import type { Citation, Trigger } from '@/lib/lsl/engine/types';

/**
 * WA trigger-handlers — emit citations based on trigger kind.
 *
 * Cash-out is ADVISORY (not blocking) per TBD-WA-15 RESOLVED — engine always
 * computes value, warnings emitted in `index.ts`. Three distinct advisory
 * codes per TBD-WA-03 RESOLVED (`wa_cashout_post_accrual_advisory`,
 * `wa_cashout_pre_accrual_not_authorised`, `wa_cashout_no_entitlement_to_cash_out`).
 *
 * Sources: WA LSL Act 1958 ss.5, 8, 9.
 */
export function triggerCitationsWA(trigger: Trigger): Citation[] {
  switch (trigger.kind) {
    case 'taking_leave':
      return [
        citation(
          'WA LSL Act 1958 s.9',
          'trigger.taking-leave.public-holiday-exclusive'
        ),
      ];
    case 'termination': {
      const out: Citation[] = [
        citation('WA LSL Act 1958 s.8', 'trigger.termination.payable', 65),
      ];
      if (trigger.reason === 'death') {
        out.push(
          citation(
            'WA LSL Act 1958 s.8(3)',
            'trigger.termination.death-pro-rata',
            67
          )
        );
      }
      return out;
    }
    case 'as_at':
      return [
        citation(
          'WA LSL Act 1958 s.8',
          'trigger.as-at.snapshot',
          65,
          'as-at snapshot per E1 spec D20 — qualifying-period threshold NOT applied'
        ),
      ];
    case 'cash_out':
      // Advisory-only: engine still computes; warnings emitted from `index.ts`.
      return [
        citation(
          'WA LSL Act 1958 s.5',
          'cash-out.post-accrual-written-agreement'
        ),
      ];
  }
}
