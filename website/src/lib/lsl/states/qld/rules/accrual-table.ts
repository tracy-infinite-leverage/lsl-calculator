import { Decimal, mul, sub } from '@/lib/lsl/engine/decimal';
import { citation } from '@/lib/lsl/engine/citation';
import type { Citation, Trigger } from '@/lib/lsl/engine/types';

/**
 * QLD IR Act 2016 ss.95(2), 95(3), 95(4) accrual.
 *
 * Numerical accrual ratio is identical to NSW and VIC (8.6667 / 10 per year =
 * 1/60). The QLD-specific divergences are in the **qualifying gates** and the
 * **misconduct treatment**:
 *
 *   - **10+ yr (s.95(2)(a))**: automatic full payout regardless of termination
 *     reason — including `serious_misconduct`. QLD has NO misconduct exception
 *     at 10+ years (per Business QLD interpretive note + TC-QLD-022).
 *   - **7–10 yr (s.95(3)/(4))**: pro-rata payable ONLY if termination is for a
 *     qualifying reason — death, illness/domestic-pressing-necessity,
 *     redundancy / dismissal not for conduct/capacity/performance, or unfair
 *     dismissal. Voluntary resignation does NOT qualify. Serious misconduct
 *     does NOT qualify (s.95(3)(d) excludes conduct/capacity/performance).
 *   - **Sub-7-yr**: zero entitlement under any reason. Engine returns $0 with
 *     a `sub_7yr_no_entitlement_qld` advisory directing the user to review
 *     industrial instruments or EAs for top-ups.
 *
 * Accrual is **continuous at 1/60** across all tenure bands ≥ 10 yrs (per
 * TBD-QLD-01 resolution — no discrete step at 15 yrs; the 13-week figure at
 * 15 yrs is the arithmetic outcome of `15 × 8.6667 / 10`, not a separate
 * band).
 *
 * Thresholds at 7, 10, and 15 yrs are inclusive at exact-day boundary —
 * `years_of_continuous_service >= 7.0000` (etc.) — same convention as VIC's
 * resolved TBD-VIC-06.
 *
 * As-at trigger bypasses qualifying-reason gates per E1 spec D20 — reports
 * accrued value at any tenure, with `accrued_not_currently_payable` indicator
 * at sub-7-yr.
 *
 * Sources:
 *   - QLD IR Act 2016 ss.95(2)(a), 95(2)(b), 95(3)(a)-(e), 95(4)
 *   - Business QLD — "LSL Entitlements" plain-English summary
 *   - APA LSL Masterclass PDF pp.49-51
 *   - docs/qa/test-cases-qld.md v1.0 PM-signed 2026-05-25
 */

const QLD_ACCRUAL_PER_YEAR = new Decimal('8.6667').dividedBy(10); // 0.86667
const QLD_FULL_QUALIFYING_YEARS = new Decimal('10.0000');
const QLD_PRORATA_QUALIFYING_YEARS = new Decimal('7.0000');

/** Set of `TerminationReason` enum values that qualify under s.95(3) for sub-10-yr pro-rata. */
const QLD_QUALIFYING_REASONS = new Set([
  'death', // s.95(3)(a)
  'illness_incapacity', // s.95(3)(b) (employee-initiated path) — DEV-CROSS-1 will refine
  'redundancy', // s.95(3)(d) (dismissal not for conduct/capacity/performance)
  'employer_initiated_not_misconduct', // s.95(3)(d) — supported by existing enum
  'domestic_pressing_necessity', // s.95(3)(b) — supported by existing enum
]);

export interface QLDAccrualResult {
  grossWeeks: Decimal;
  payableWeeks: Decimal;
  priorLeaveTakenWeeks: Decimal;
  citations: Citation[];
  /**
   * "payable" means the employee can take or be paid out today (per the
   * trigger). "accrued_not_currently_payable" means accrued but the 7-yr
   * threshold blocks actual payout today (used in as_at mode for UX
   * presentation).
   */
  payableIndicator: 'payable' | 'accrued_not_currently_payable';
  /** Internal: did the sub-10-yr misconduct exclusion fire? Drives warning emission upstream. */
  misconductExcluded?: boolean;
  /** Internal: did the sub-10-yr no-qualifying-reason exclusion fire? */
  noQualifyingReason?: boolean;
}

export function accrualQLD(
  yearsOfService: Decimal,
  trigger: Trigger,
  priorLeaveTakenWeeks: Decimal = new Decimal(0)
): QLDAccrualResult {
  const citations: Citation[] = [];
  const grossWeeks = mul(yearsOfService, QLD_ACCRUAL_PER_YEAR);

  // ── As-at snapshot: bypass qualifying-reason gates entirely.
  if (trigger.kind === 'as_at') {
    citations.push(
      citation(
        'QLD IR Act 2016 s.95',
        'accrual.snapshot.no-qualifying-reason-threshold',
        49,
        'as-at snapshot per E1 spec D20 — qualifying-period threshold NOT applied'
      )
    );
    let payable = sub(grossWeeks, priorLeaveTakenWeeks);
    if (payable.lt(0)) payable = new Decimal(0);
    const payableIndicator: 'payable' | 'accrued_not_currently_payable' =
      yearsOfService.lt(QLD_PRORATA_QUALIFYING_YEARS) ? 'accrued_not_currently_payable' : 'payable';
    return {
      grossWeeks,
      payableWeeks: payable,
      priorLeaveTakenWeeks,
      citations,
      payableIndicator,
    };
  }

  // ── Sub-7-yr: zero entitlement under any reason.
  if (yearsOfService.lt(QLD_PRORATA_QUALIFYING_YEARS)) {
    citations.push(
      citation(
        'QLD IR Act 2016 s.95(3)',
        'accrual.sub-7yr-no-entitlement-any-reason',
        50
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

  // ── 10+ yrs: automatic payout regardless of reason — including misconduct.
  if (yearsOfService.gte(QLD_FULL_QUALIFYING_YEARS)) {
    let label = 'accrual.10yr-automatic-any-reason';
    let note: string | undefined;
    if (trigger.kind === 'termination' && trigger.reason === 'serious_misconduct') {
      // Diagnostic citation: at 10+ yrs misconduct does NOT exclude payout (QLD divergence).
      label = 'accrual.10yr-automatic-any-reason-incl-misconduct';
      note =
        'QLD has no misconduct exception at 10+ yrs per s.95(2) (Business QLD interpretive note)';
    }
    citations.push(
      citation('QLD IR Act 2016 s.95(2)(a)', label, 49, note)
    );
    let payable = sub(grossWeeks, priorLeaveTakenWeeks);
    if (payable.lt(0)) payable = new Decimal(0);
    return {
      grossWeeks,
      payableWeeks: payable,
      priorLeaveTakenWeeks,
      citations,
      payableIndicator: 'payable',
    };
  }

  // ── 7–10 yrs: pro-rata gated on qualifying reason (s.95(3)/(4)).
  // taking_leave + cash_out at 7–10 yrs: treat as if a qualifying-reason
  // termination — the engine has computed value-of-week and the user has
  // asserted the trigger; we honour it. (TC-QLD-049/050 expect a computed
  // 6.9333 wks at 8 yrs cash-out.)
  if (trigger.kind === 'taking_leave' || trigger.kind === 'cash_out') {
    citations.push(
      citation(
        'QLD IR Act 2016 s.95(3)',
        'accrual.7-to-10yr.proportionate',
        50
      )
    );
    citations.push(
      citation(
        'QLD IR Act 2016 s.95(4)',
        'accrual.proportionate-payment-formula',
        50
      )
    );
    let payable = sub(grossWeeks, priorLeaveTakenWeeks);
    if (payable.lt(0)) payable = new Decimal(0);
    return {
      grossWeeks,
      payableWeeks: payable,
      priorLeaveTakenWeeks,
      citations,
      payableIndicator: 'payable',
    };
  }

  // Termination at 7-10 yrs — route through the qualifying-reason gate.
  if (trigger.kind === 'termination') {
    const reason = trigger.reason;

    // s.95(3)(d) misconduct exclusion (sub-10-yr).
    if (reason === 'serious_misconduct') {
      citations.push(
        citation(
          'QLD IR Act 2016 s.95(3)(d)',
          'accrual.7-to-10yr.dismissal-for-conduct-excluded',
          50
        )
      );
      return {
        grossWeeks,
        payableWeeks: new Decimal(0),
        priorLeaveTakenWeeks,
        citations,
        payableIndicator: 'accrued_not_currently_payable',
        misconductExcluded: true,
      };
    }

    // Voluntary resignation does NOT qualify under s.95(3)/(4).
    if (reason === 'voluntary_resignation') {
      citations.push(
        citation(
          'QLD IR Act 2016 s.95(3)',
          'accrual.7-to-10yr.qualifying-reasons-only',
          50
        )
      );
      citations.push(
        citation(
          'QLD IR Act 2016 s.95(4)',
          'accrual.7-to-10yr.qualifying-reasons-list',
          50
        )
      );
      return {
        grossWeeks,
        payableWeeks: new Decimal(0),
        priorLeaveTakenWeeks,
        citations,
        payableIndicator: 'accrued_not_currently_payable',
        noQualifyingReason: true,
      };
    }

    // Qualifying reasons → pro-rata payable per s.95(4).
    if (QLD_QUALIFYING_REASONS.has(reason)) {
      let ruleKey = 'accrual.7-to-10yr.qualifying-reason';
      let section = 'QLD IR Act 2016 s.95(3)';
      switch (reason) {
        case 'death':
          section = 'QLD IR Act 2016 s.95(3)(a)';
          ruleKey = 'accrual.7-to-10yr.death-of-employee';
          break;
        case 'illness_incapacity':
          // Per docs/qa/test-cases-qld.md TC-QLD-004: employee-initiated illness
          // resignation is the default v1 path under s.95(3)(b). Employer-initiated
          // illness dismissal (s.95(3)(c), TC-QLD-005) is DEFERRED to DEV-CROSS-1.
          section = 'QLD IR Act 2016 s.95(3)(b)';
          ruleKey = 'accrual.7-to-10yr.employee-illness-or-pressing-necessity';
          break;
        case 'domestic_pressing_necessity':
          section = 'QLD IR Act 2016 s.95(3)(b)';
          ruleKey = 'accrual.7-to-10yr.domestic-pressing-necessity';
          break;
        case 'redundancy':
        case 'employer_initiated_not_misconduct':
          section = 'QLD IR Act 2016 s.95(3)(d)';
          ruleKey = 'accrual.7-to-10yr.dismissal-not-for-conduct';
          break;
      }
      citations.push(citation(section, ruleKey, 50));
      citations.push(
        citation(
          'QLD IR Act 2016 s.95(4)',
          'accrual.proportionate-payment-formula',
          50
        )
      );
      let payable = sub(grossWeeks, priorLeaveTakenWeeks);
      if (payable.lt(0)) payable = new Decimal(0);
      return {
        grossWeeks,
        payableWeeks: payable,
        priorLeaveTakenWeeks,
        citations,
        payableIndicator: 'payable',
      };
    }

    // Fallthrough for any other reason — treat as non-qualifying.
    citations.push(
      citation(
        'QLD IR Act 2016 s.95(3)',
        'accrual.7-to-10yr.qualifying-reasons-only',
        50
      )
    );
    return {
      grossWeeks,
      payableWeeks: new Decimal(0),
      priorLeaveTakenWeeks,
      citations,
      payableIndicator: 'accrued_not_currently_payable',
      noQualifyingReason: true,
    };
  }

  // Defensive: unknown trigger kind at 7-10 yrs. Return zero with no payout.
  return {
    grossWeeks,
    payableWeeks: new Decimal(0),
    priorLeaveTakenWeeks,
    citations,
    payableIndicator: 'accrued_not_currently_payable',
  };
}

export const qldAccrualConstants = {
  perYearWeeks: QLD_ACCRUAL_PER_YEAR,
  fullQualifyingYears: QLD_FULL_QUALIFYING_YEARS,
  prorataQualifyingYears: QLD_PRORATA_QUALIFYING_YEARS,
};
