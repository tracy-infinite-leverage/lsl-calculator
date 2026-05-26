import { citation } from '@/lib/lsl/engine/citation';
import type { Citation, Trigger } from '@/lib/lsl/engine/types';

/**
 * ACT trigger-handlers — emit citations based on trigger kind.
 *
 * ACT s.9 PH-EXCLUSIVE (parallel to NSW/VIC/QLD/WA/TAS; OPPOSITE to SA).
 * Cash-out advisory: three codes from `index.ts` per TBD-ACT-12 RESOLVED.
 * `payable_by = terminationDate + 90 days` per s.11A(4)(b) — LONGEST in
 * Australia. Surfaced on `Result.payable_by`.
 */
export function triggerCitationsACT(trigger: Trigger): Citation[] {
  switch (trigger.kind) {
    case 'taking_leave':
      return [
        citation(
          'ACT LSL Act 1976 s.9',
          'trigger.taking-leave.ph-exclusive-extends-leave',
          112
        ),
        citation(
          'ACT LSL Act 1976 s.6',
          'trigger.taking-leave',
          110
        ),
      ];
    case 'termination': {
      const out: Citation[] = [
        citation(
          'ACT LSL Act 1976 s.11A(4)(b)',
          'termination.payable-within-90-days',
          112
        ),
      ];
      if (trigger.reason === 'death') {
        out.push(
          citation(
            'ACT LSL Act 1976 s.11C',
            'trigger.termination.death',
            118
          )
        );
      }
      return out;
    }
    case 'as_at':
      return [
        citation(
          'ACT LSL Act 1976 s.4',
          'trigger.as-at.snapshot',
          114,
          'as-at snapshot per E1 spec D20 — qualifying-period threshold NOT applied'
        ),
      ];
    case 'cash_out':
      return [
        citation(
          'ACT LSL Act 1976 s.8(c)',
          'cashout.post-7yr-permitted-by-agreement',
          120,
          'v1 cites s.8(c); WorkSafe ACT operational guidance interprets this clause as the cash-out authority'
        ),
      ];
  }
}

export function payableByDate(
  terminationDate: string,
  windowDays: number
): string {
  const dt = new Date(
    Date.UTC(
      Number(terminationDate.slice(0, 4)),
      Number(terminationDate.slice(5, 7)) - 1,
      Number(terminationDate.slice(8, 10))
    )
  );
  dt.setUTCDate(dt.getUTCDate() + windowDays);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
