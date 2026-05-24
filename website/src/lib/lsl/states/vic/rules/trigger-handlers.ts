import { citation } from '@/lib/lsl/engine/citation';
import type { Citation, Trigger } from '@/lib/lsl/engine/types';

/**
 * VIC trigger-handlers — emit citations based on trigger kind.
 *
 * The cashing-out hard-error is emitted by `calculateVIC` itself BEFORE these
 * handlers run (because it returns status: 'failed' with no numeric outputs).
 * This file deals only with computed-result paths.
 *
 * Sources: VIC LSL Act 2018 ss.9, 10, 18, 20.
 */
export function triggerCitationsVIC(trigger: Trigger): Citation[] {
  switch (trigger.kind) {
    case 'taking_leave':
      return [
        citation(
          'VIC LSL Act 2018 s.18',
          'trigger.taking-leave.request',
          37
        ),
        citation(
          'VIC LSL Act 2018 s.20',
          'trigger.taking-leave.payment-timing',
          41
        ),
      ];
    case 'termination': {
      const out: Citation[] = [
        citation(
          'VIC LSL Act 2018 s.9(1)(b)',
          'trigger.termination.payable-on-day-of-termination',
          43
        ),
      ];
      if (trigger.reason === 'death') {
        out.push(
          citation(
            'VIC LSL Act 2018 s.10',
            'trigger.termination.death.estate-payable',
            43
          )
        );
      }
      return out;
    }
    case 'as_at':
      return [
        citation(
          'VIC LSL Act 2018 s.6',
          'trigger.as-at.snapshot',
          32,
          'as-at snapshot per E1 spec D20 — qualifying-period threshold NOT applied'
        ),
      ];
    case 'cash_out':
      // Cashing-out is a hard error for VIC — handled in calculateVIC, this
      // path is unreachable. Defensive: return empty.
      return [];
  }
}
