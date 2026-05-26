import { Decimal, mul, sub } from '@/lib/lsl/engine/decimal';
import { citation } from '@/lib/lsl/engine/citation';
import type {
  Citation,
  TerminationReason,
  Trigger,
} from '@/lib/lsl/engine/types';

/**
 * NSW LSA s.4(2): accrual rate is 8.6667 weeks for 10 years of continuous service,
 * +4.3333 per additional 5 years. Linearised: `years × (8.6667 / 10)` per spec F11.
 */
const ACCRUAL_PER_YEAR = new Decimal('8.6667').dividedBy(10); // 0.86667

const QUALIFYING_5_TO_10_REASONS: readonly TerminationReason[] = [
  'employer_initiated_not_misconduct',
  'redundancy',
  'illness_incapacity',
  'domestic_pressing_necessity',
  'death',
];

export interface AccrualResult {
  /** Gross entitlement weeks (before subtracting prior leave taken). */
  grossWeeks: Decimal;
  /** Weeks payable to the employee (after pro-rata thresholds + leave-taken adjustment). */
  payableWeeks: Decimal;
  /** Weeks of prior LSL taken — informational. */
  priorLeaveTakenWeeks: Decimal;
  citations: Citation[];
  /**
   * "payable" means the employee can take or be paid out the weeks today (per the trigger).
   * "accrued_not_currently_payable" means there's accrual but the s.4(2)(iii) thresholds block
   * actual payout (e.g. <5yr at termination). Used in as_at mode for UX presentation.
   */
  payableIndicator: 'payable' | 'accrued_not_currently_payable';
}

/**
 * Compute accrual + pro-rata for NSW per s.4(2) and s.4(2)(iii).
 *
 * `priorLeaveTakenWeeks` is subtracted from gross to give payable weeks.
 *
 * Pro-rata thresholds (termination trigger only):
 *   - < 5 yrs: $0
 *   - 5 to < 10 yrs: pro-rata only for "qualifying" termination reasons (s.4(2)(iii))
 *   - 10+ yrs: pro-rata for ANY reason, including serious misconduct (per spec v0.5.0 §6)
 *
 * As-at mode: no thresholds — accrued value reported regardless. The `payableIndicator`
 * surfaces when this is "accrued, not currently payable".
 */
export function accrualNSW(
  yearsOfService: Decimal,
  trigger: Trigger,
  priorLeaveTakenWeeks: Decimal = new Decimal(0)
): AccrualResult {
  const citations: Citation[] = [];
  const grossWeeks = mul(yearsOfService, ACCRUAL_PER_YEAR);

  // The accrual formula is shared across triggers; emit the foundational citation.
  citations.push(
    citation('NSW LSA s.4(2)', 'accrual.years-x-8.6667-over-10', 13)
  );

  let payableWeeks: Decimal = new Decimal(0);
  let payableIndicator: 'payable' | 'accrued_not_currently_payable' = 'payable';

  if (trigger.kind === 'as_at') {
    // As-at: accrued value regardless of milestone. UX surfaces "not currently payable" when
    // pro-rata thresholds would otherwise block actual payout (per spec F11 + D20).
    payableWeeks = sub(grossWeeks, priorLeaveTakenWeeks);
    if (payableWeeks.lt(0)) payableWeeks = new Decimal(0);
    citations.push(
      citation(
        'NSW LSA s.4(2)',
        'accrual.snapshot.no-pro-rata-threshold',
        13,
        'as-at snapshot per F11 + D20 — pro-rata thresholds not applied'
      )
    );

    // Determine payable indicator: would this employee be paid out if it were a termination today?
    // The conservative rule: under 10 years and no qualifying-termination context → "not currently payable".
    if (yearsOfService.lt(10)) {
      // For sub-5yr, definitely not payable. For 5-10yr, depends on termination reason — but in
      // as_at mode we don't know, so we tag "accrued_not_currently_payable".
      if (yearsOfService.lt(5)) {
        payableIndicator = 'accrued_not_currently_payable';
      } else {
        payableIndicator = 'accrued_not_currently_payable';
      }
    }
    return { grossWeeks, payableWeeks, priorLeaveTakenWeeks, citations, payableIndicator };
  }

  if (trigger.kind === 'taking_leave') {
    // Taking leave: requires 10+ years (s.4(2)(b) general rule) — but the user is asking to draw
    // their accrued LSL, so we treat the accrual as payable.
    citations.push(
      citation('NSW LSA s.4(7)', 'trigger.taking-leave.payable-in-pay-period', 24)
    );
    payableWeeks = sub(grossWeeks, priorLeaveTakenWeeks);
    if (payableWeeks.lt(0)) payableWeeks = new Decimal(0);
    return { grossWeeks, payableWeeks, priorLeaveTakenWeeks, citations, payableIndicator };
  }

  // trigger.kind === 'termination' (the only remaining variant; calculateNSW
  // short-circuits 'cash_out' before reaching here)
  if (trigger.kind !== 'termination') {
    // Should be unreachable — defensive.
    return { grossWeeks, payableWeeks, priorLeaveTakenWeeks, citations, payableIndicator };
  }
  const reason = trigger.reason;

  if (yearsOfService.lt(5)) {
    // < 5 yrs: no pro-rata regardless of reason
    citations.push(
      citation('NSW LSA s.4(2)(iii)', 'accrual.less-than-5-yrs-no-entitlement', 25)
    );
    payableWeeks = new Decimal(0);
    payableIndicator = 'accrued_not_currently_payable';
    return { grossWeeks, payableWeeks, priorLeaveTakenWeeks, citations, payableIndicator };
  }

  if (yearsOfService.lt(10)) {
    // 5 to <10 yrs: pro-rata only for qualifying reasons (s.4(2)(iii))
    if (QUALIFYING_5_TO_10_REASONS.includes(reason)) {
      const ruleSuffix = reasonToRuleKey(reason);
      citations.push(
        citation(
          'NSW LSA s.4(2)(iii)(a)',
          `accrual.pro-rata.5-to-10.${ruleSuffix}`,
          25
        )
      );
      payableWeeks = sub(grossWeeks, priorLeaveTakenWeeks);
      if (payableWeeks.lt(0)) payableWeeks = new Decimal(0);
      return { grossWeeks, payableWeeks, priorLeaveTakenWeeks, citations, payableIndicator };
    }
    // Non-qualifying reason (voluntary_resignation, serious_misconduct in 5-10 band)
    citations.push(
      citation(
        'NSW LSA s.4(2)(iii)',
        'accrual.5-to-10.no-special-reason-no-entitlement',
        25
      )
    );
    payableWeeks = new Decimal(0);
    payableIndicator = 'accrued_not_currently_payable';
    return { grossWeeks, payableWeeks, priorLeaveTakenWeeks, citations, payableIndicator };
  }

  // 10+ yrs: pro-rata for any reason
  citations.push(
    citation(
      'NSW LSA s.4(2)(iii)',
      reason === 'serious_misconduct'
        ? 'accrual.10yr-plus.any-reason-incl-misconduct'
        : 'accrual.10yr-plus.any-reason',
      25
    )
  );
  payableWeeks = sub(grossWeeks, priorLeaveTakenWeeks);
  if (payableWeeks.lt(0)) payableWeeks = new Decimal(0);
  return { grossWeeks, payableWeeks, priorLeaveTakenWeeks, citations, payableIndicator };
}

function reasonToRuleKey(reason: TerminationReason): string {
  switch (reason) {
    case 'redundancy':
    case 'employer_initiated_not_misconduct':
      return 'redundancy';
    case 'illness_incapacity':
      return 'illness';
    case 'domestic_pressing_necessity':
      return 'domestic';
    case 'death':
      return 'death';
    // DEV-CROSS-1 additive enum values. NSW does not currently branch on these
    // for sub-10-yr pro-rata — they fall through to the non-qualifying path via
    // the QUALIFYING_5_TO_10_REASONS list. This switch is only reached for
    // 10+yr cases (where every reason pays out), so the rule key just needs to
    // be a stable string for citation labelling.
    case 'unfair_dismissal':
      return 'unfair-dismissal';
    case 'poor_performance':
      return 'poor-performance';
    case 'voluntary_resignation':
    case 'serious_misconduct':
      return reason;
    // DEV-CROSS (E2 Phase 7) — ACT-driven addition. NSW does not branch on
    // retirement; falls through to a stable citation key for labelling.
    case 'retirement':
      return 'retirement';
  }
}

export const accrualConstants = {
  perYearWeeks: ACCRUAL_PER_YEAR,
  tenYearMilestone: new Decimal('8.6667'),
  fiveYearIncrement: new Decimal('4.3333'),
};

