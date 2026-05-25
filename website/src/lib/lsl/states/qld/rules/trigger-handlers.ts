import { citation } from '@/lib/lsl/engine/citation';
import type { Citation, Trigger } from '@/lib/lsl/engine/types';

/**
 * QLD trigger-handlers — emit citations based on trigger kind.
 *
 * Unlike VIC, QLD's `cash_out` trigger does NOT hard-error. The cashing-out
 * advisory citations are emitted alongside the standard accrual/ordinary-pay
 * citations because the engine returns a `status: 'computed'` Result. See
 * `index.ts` for the warning-emission side of that path (TBD-QLD-04
 * resolution).
 *
 * Sources: QLD IR Act 2016 ss.95, 97, 110, 134.
 */
export function triggerCitationsQLD(trigger: Trigger): Citation[] {
  switch (trigger.kind) {
    case 'taking_leave':
      return [
        citation(
          'QLD IR Act 2016 s.97',
          'trigger.taking-leave.public-holiday-exclusive',
          53
        ),
      ];
    case 'termination': {
      const out: Citation[] = [
        citation('QLD IR Act 2016 s.95', 'trigger.termination.payable', 49),
      ];
      if (trigger.reason === 'death') {
        out.push(
          citation(
            'QLD IR Act 2016 s.95(3)(a)',
            'trigger.termination.death.estate-payable',
            50
          )
        );
      }
      return out;
    }
    case 'as_at':
      return [
        citation(
          'QLD IR Act 2016 s.95',
          'trigger.as-at.snapshot',
          49,
          'as-at snapshot per E1 spec D20 — qualifying-period threshold NOT applied'
        ),
      ];
    case 'cash_out':
      // Advisory-only: engine still computes; warnings emitted from `index.ts`.
      return [
        citation(
          'QLD IR Act 2016 s.110',
          'cash-out.industrial-instrument-or-qirc-permission',
          58
        ),
      ];
  }
}
