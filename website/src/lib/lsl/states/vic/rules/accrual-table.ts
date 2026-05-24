import { Decimal, mul, sub } from '@/lib/lsl/engine/decimal';
import { citation } from '@/lib/lsl/engine/citation';
import type { Citation, Trigger } from '@/lib/lsl/engine/types';

/**
 * VIC LSL Act 2018 s.6 accrual.
 *
 * Same numerical accrual ratio as NSW (8.6667/10 per year) — the per-year
 * weeks is identical. The qualifying threshold differs:
 *   - NSW: 10 years (with 5-year pro-rata window for limited reasons)
 *   - VIC: 7 years (after which ALL termination reasons pay out)
 *
 * Sub-7-year tenure: zero entitlement under VIC for ANY termination reason,
 * INCLUDING death, redundancy, and illness (no s.4(2)(iii)-equivalent in VIC).
 * 7-year boundary is inclusive at exactly 7 years 0 days (TBD-VIC-06).
 *
 * As-at trigger: bypasses the qualifying threshold for accrued-value snapshot
 * reporting (same pattern as NSW).
 *
 * Termination at >= 7 years: full payout regardless of reason. There is no
 * serious-misconduct forfeiture clause in VIC.
 *
 * Taking-leave: pays the accrued value at any tenure >= 7 years (TC-VIC-012).
 *
 * Sources:
 *   - VIC LSL Act 2018 ss.6, 9, 10
 *   - APA LSL Masterclass PDF pp.32, 43
 *   - docs/qa/test-cases-vic.md PM-signed 2026-05-24
 */

const VIC_ACCRUAL_PER_YEAR = new Decimal('8.6667').dividedBy(10); // 0.86667
const VIC_QUALIFYING_YEARS = new Decimal('7.0000');

export interface VICAccrualResult {
  grossWeeks: Decimal;
  payableWeeks: Decimal;
  priorLeaveTakenWeeks: Decimal;
  citations: Citation[];
  /**
   * "payable" means employee can take or be paid out today (per the trigger).
   * "accrued_not_currently_payable" means accrued but the 7-yr threshold blocks
   * actual payout today (used in as_at mode for UX presentation).
   */
  payableIndicator: 'payable' | 'accrued_not_currently_payable';
}

export function accrualVIC(
  yearsOfService: Decimal,
  trigger: Trigger,
  priorLeaveTakenWeeks: Decimal = new Decimal(0)
): VICAccrualResult {
  const citations: Citation[] = [];
  const grossWeeks = mul(yearsOfService, VIC_ACCRUAL_PER_YEAR);

  // Foundational accrual citation — emitted for ALL VIC calculations regardless of tenure.
  // For sub-7-year cases, this is replaced by the sub-7-yr-no-entitlement citation below.
  let payableWeeks: Decimal = new Decimal(0);
  let payableIndicator: 'payable' | 'accrued_not_currently_payable' = 'payable';

  if (trigger.kind === 'as_at') {
    // As-at: report accrued value regardless of qualifying threshold (per spec D20).
    citations.push(
      citation(
        'VIC LSL Act 2018 s.6',
        'accrual.snapshot.no-pro-rata-threshold',
        32,
        'as-at snapshot per F11 + D20 — qualifying-period threshold NOT applied'
      )
    );
    payableWeeks = sub(grossWeeks, priorLeaveTakenWeeks);
    if (payableWeeks.lt(0)) payableWeeks = new Decimal(0);
    payableIndicator = yearsOfService.lt(VIC_QUALIFYING_YEARS)
      ? 'accrued_not_currently_payable'
      : 'payable';
    return { grossWeeks, payableWeeks, priorLeaveTakenWeeks, citations, payableIndicator };
  }

  // Below the 7-year qualifying threshold: zero entitlement regardless of reason.
  if (yearsOfService.lt(VIC_QUALIFYING_YEARS)) {
    citations.push(
      citation(
        'VIC LSL Act 2018 s.6',
        'accrual.sub-7yr-no-entitlement-any-reason',
        43
      )
    );
    return {
      grossWeeks,
      payableWeeks: new Decimal(0),
      priorLeaveTakenWeeks,
      citations,
      payableIndicator: 'accrued_not_currently_payable',
    };
  }

  // >= 7 years: full accrual payable.
  citations.push(
    citation(
      'VIC LSL Act 2018 s.6',
      'accrual.qualifying-period-7yr-plus',
      32
    )
  );
  payableWeeks = sub(grossWeeks, priorLeaveTakenWeeks);
  if (payableWeeks.lt(0)) payableWeeks = new Decimal(0);

  if (trigger.kind === 'termination') {
    // VIC has no serious-misconduct forfeiture — emit the "any reason" citation explicitly
    // for the misconduct case so it's traceable.
    if (trigger.reason === 'serious_misconduct') {
      citations.push(
        citation(
          'VIC LSL Act 2018 s.9(1)(b)',
          'trigger.termination.any-reason-incl-misconduct',
          43
        )
      );
    }
  }

  return { grossWeeks, payableWeeks, priorLeaveTakenWeeks, citations, payableIndicator };
}

export const vicAccrualConstants = {
  perYearWeeks: VIC_ACCRUAL_PER_YEAR,
  qualifyingYears: VIC_QUALIFYING_YEARS,
};
