import { citation } from '@/lib/lsl/engine/citation';
import type { Citation, Trigger } from '@/lib/lsl/engine/types';

/**
 * Citations attached based on trigger kind per NSW LSA s.4(5)–(7).
 */
export function triggerCitations(trigger: Trigger): Citation[] {
  switch (trigger.kind) {
    case 'taking_leave':
      return [
        citation(
          'NSW LSA s.4(7)',
          'trigger.taking-leave.payable-in-pay-period',
          24
        ),
      ];
    case 'termination': {
      const out: Citation[] = [
        citation('NSW LSA s.4(5)(a)', 'trigger.termination.forthwith', 26),
      ];
      if (trigger.reason === 'death') {
        out.push(
          citation(
            'NSW LSA s.4(5)(b)',
            'trigger.termination.estate-on-request',
            26
          )
        );
      }
      return out;
    }
    case 'as_at':
      return [
        citation(
          'NSW LSA s.4(2)',
          'trigger.as-at.snapshot',
          13,
          'as-at snapshot per F11 + D20'
        ),
      ];
    case 'cash_out':
      // NSW does not encode cashing-out — calculateNSW short-circuits before
      // calling here. Defensive: return empty citations if the path is ever
      // reached.
      return [];
  }
}
