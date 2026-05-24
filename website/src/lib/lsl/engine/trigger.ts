import { CashOutNotSupportedError } from './errors';
import type { ISODate, Trigger } from './types';

/**
 * Resolve the "prescribed date" per NSW LSA s.4(5)–(7):
 *   - taking_leave: day before LSL commences
 *   - termination: termination date
 *   - as_at: as-at date
 *   - cash_out: cash-out date (only meaningful for states that support cashing-out;
 *     unsupported states short-circuit before reaching this function — see
 *     `CashOutNotSupportedError`)
 */
export function prescribedDate(trigger: Trigger): ISODate {
  switch (trigger.kind) {
    case 'taking_leave':
      return dayBefore(trigger.leaveStartDate);
    case 'termination':
      return trigger.terminationDate;
    case 'as_at':
      return trigger.asAtDate;
    case 'cash_out':
      // Shared engine has no view on which state allows cashing-out — the per-state
      // orchestrator must short-circuit before calling prescribedDate. Reaching here
      // is a programmer error.
      throw new CashOutNotSupportedError('shared engine');
  }
}

function dayBefore(iso: ISODate): ISODate {
  const dt = new Date(
    Date.UTC(
      Number(iso.slice(0, 4)),
      Number(iso.slice(5, 7)) - 1,
      Number(iso.slice(8, 10))
    )
  );
  dt.setUTCDate(dt.getUTCDate() - 1);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}` as ISODate;
}
