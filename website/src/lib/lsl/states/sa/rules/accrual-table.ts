import { Decimal, mul, sub } from '@/lib/lsl/engine/decimal';
import { citation } from '@/lib/lsl/engine/citation';
import type { Citation, Trigger } from '@/lib/lsl/engine/types';

/**
 * SA LSL Act 1987 s.5 accrual.
 *
 * SA accrual is the MOST GENEROUS in Australia (F10/AC12):
 *   - 13 weeks at 10 yrs (vs NSW/VIC/QLD/WA 8.6667 wks at 10 yrs).
 *   - 1.3 wks per completed year of continuous service — 50% higher rate
 *     than other 4 encoded states (1/60 = 0.0867 wks/yr).
 *   - Continuous accrual at 1.3/yr from day one — no discrete step at 10 yrs;
 *     the 13-week figure at 10 yrs is the arithmetic outcome of 10 × 1.3.
 *
 * Per s.5(3) and s.5(1):
 *   - **10+ yr (s.5(1))**: automatic full payout regardless of termination
 *     reason — including `serious_misconduct`. SA mirrors NSW/VIC/QLD on this
 *     point — SA does NOT have a partial-forfeiture rule like WA s.8(3).
 *   - **7-10 yr (s.5(3))**: pro-rata payable for ANY reason except (a)
 *     serious & wilful misconduct, OR (b) unlawful termination by the worker
 *     (worker failed to give contractually-required notice on resignation).
 *     SA's second disqualifier is unique among the 5 encoded states.
 *   - **Sub-7-yr**: zero entitlement under any reason — universal floor.
 *
 * Higher-duties acting rule is handled in `value-of-week.ts` per TBD-SA-07.
 *
 * As-at trigger bypasses qualifying-reason gates per E1 spec D20 — reports
 * accrued value at any tenure, with `accrued_not_currently_payable` indicator
 * at sub-7-yr.
 *
 * Sources:
 *   - SA LSL Act 1987 s.5(1), s.5(3)
 *   - SafeWork SA — pro-rata entitlement / payment guidance
 *   - APA LSL Masterclass PDF pp.80-94
 *   - docs/qa/test-cases-sa.md v1.0 PM-signed 2026-05-25
 */

const SA_ACCRUAL_PER_YEAR = new Decimal('1.3'); // 1.3 wks/yr continuous
const SA_FULL_QUALIFYING_YEARS = new Decimal('10.0000');
const SA_PRORATA_QUALIFYING_YEARS = new Decimal('7.0000');

export interface SAAccrualResult {
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
  /** Internal: sub-10-yr misconduct exclusion fired. */
  misconductExcluded?: boolean;
  /** Internal: SA-unique unlawful-worker-termination exclusion fired (7-10 yr). */
  unlawfulWorkerTerminationExcluded?: boolean;
  /** Internal: 10+ yr misconduct case — engine paid in full (SA divergence from WA). */
  tenyrPlusMisconductFullPayout?: boolean;
}

export function accrualSA(
  yearsOfService: Decimal,
  trigger: Trigger,
  priorLeaveTakenWeeks: Decimal = new Decimal(0),
  workerNoticeCompliance: boolean = true
): SAAccrualResult {
  const citations: Citation[] = [];
  const grossWeeks = mul(yearsOfService, SA_ACCRUAL_PER_YEAR);

  // ── As-at snapshot: bypass qualifying-reason gates entirely.
  if (trigger.kind === 'as_at') {
    citations.push(
      citation(
        'SA LSL Act 1987 s.5',
        'accrual.snapshot.no-qualifying-reason-threshold',
        80,
        'as-at snapshot per E1 spec D20 — qualifying-period threshold NOT applied'
      )
    );
    let payable = sub(grossWeeks, priorLeaveTakenWeeks);
    if (payable.lt(0)) payable = new Decimal(0);
    const payableIndicator: 'payable' | 'accrued_not_currently_payable' =
      yearsOfService.lt(SA_PRORATA_QUALIFYING_YEARS)
        ? 'accrued_not_currently_payable'
        : 'payable';
    return {
      grossWeeks,
      payableWeeks: payable,
      priorLeaveTakenWeeks,
      citations,
      payableIndicator,
    };
  }

  // ── Sub-7-yr: zero entitlement under any reason.
  if (yearsOfService.lt(SA_PRORATA_QUALIFYING_YEARS)) {
    citations.push(
      citation(
        'SA LSL Act 1987 s.5(3)',
        'accrual.sub-7yr-no-entitlement',
        81
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

  // ── 10+ yrs: automatic payout regardless of reason — including misconduct
  //    and including notice non-compliance. SA divergence from WA: SA does
  //    NOT partial-forfeit at 10+ yr misconduct — full s.5(1) entitlement
  //    payable. The s.5(3) disqualifiers apply only to the pro-rata branch.
  if (yearsOfService.gte(SA_FULL_QUALIFYING_YEARS)) {
    let tenyrPlusMisconductFullPayout = false;

    // Base 10-yr 13-week entitlement citation — always present for 10+ yr.
    citations.push(
      citation(
        'SA LSL Act 1987 s.5(1)',
        'accrual.qualifying-period-10yr-13wks',
        80
      )
    );
    // Continuous-accrual past 10 yrs citation.
    citations.push(
      citation(
        'SA LSL Act 1987 s.5(1)',
        'accrual.continuous-1.3-per-year-after-10yrs',
        88
      )
    );

    if (
      trigger.kind === 'termination' &&
      trigger.reason === 'serious_misconduct'
    ) {
      citations.push(
        citation(
          'SA LSL Act 1987 s.5(1)',
          'accrual.10yr-full-entitlement-regardless-of-reason',
          80
        )
      );
      tenyrPlusMisconductFullPayout = true;
    } else if (trigger.kind === 'termination' && trigger.reason === 'death') {
      citations.push(
        citation(
          'SA LSL Act 1987 s.5',
          'trigger.termination.death-vests-in-personal-representative',
          82
        )
      );
    }

    let payable = sub(grossWeeks, priorLeaveTakenWeeks);
    if (payable.lt(0)) payable = new Decimal(0);
    return {
      grossWeeks,
      payableWeeks: payable,
      priorLeaveTakenWeeks,
      citations,
      payableIndicator: 'payable',
      tenyrPlusMisconductFullPayout,
    };
  }

  // ── 7-10 yrs: pro-rata gated on s.5(3) exceptions.
  // taking_leave + cash_out at 7-10 yrs: engine has computed value-of-week
  // and the user has asserted the trigger — we honour it. Cashing-out
  // advisories are emitted from `index.ts`.
  if (trigger.kind === 'taking_leave' || trigger.kind === 'cash_out') {
    citations.push(
      citation(
        'SA LSL Act 1987 s.5(3)',
        'accrual.7-to-10yr.any-reason-except-misconduct-or-unlawful-termination',
        81
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

  // Termination at 7-10 yrs — route through the s.5(3) exception gate.
  if (trigger.kind === 'termination') {
    const reason = trigger.reason;

    // s.5(3) misconduct exclusion (sub-10-yr).
    if (reason === 'serious_misconduct') {
      citations.push(
        citation(
          'SA LSL Act 1987 s.5(3)',
          'accrual.7-to-10yr.serious-misconduct-excluded',
          83
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

    // SA-unique s.5(3) unlawful-worker-termination exclusion (sub-10-yr).
    // Only applies to voluntary_resignation (the only path where notice
    // could matter) when the worker did NOT give required notice.
    if (reason === 'voluntary_resignation' && workerNoticeCompliance === false) {
      citations.push(
        citation(
          'SA LSL Act 1987 s.5(3)',
          'accrual.7-to-10yr.unlawful-worker-termination-excluded',
          81
        )
      );
      return {
        grossWeeks,
        payableWeeks: new Decimal(0),
        priorLeaveTakenWeeks,
        citations,
        payableIndicator: 'accrued_not_currently_payable',
        unlawfulWorkerTerminationExcluded: true,
      };
    }

    // All other termination reasons at 7-10 yrs qualify under SA's
    // "any reason except misconduct or unlawful-worker-termination" rule.
    // This is broader than QLD (which requires a qualifying reason) and
    // narrower than VIC (which pays out regardless).
    citations.push(
      citation(
        'SA LSL Act 1987 s.5(3)',
        'accrual.7-to-10yr.any-reason-except-misconduct-or-unlawful-termination',
        81
      )
    );
    if (reason === 'death') {
      citations.push(
        citation(
          'SA LSL Act 1987 s.5',
          'trigger.termination.death-vests-in-personal-representative',
          82
        )
      );
    }
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

  // Defensive: unknown trigger kind at 7-10 yrs.
  return {
    grossWeeks,
    payableWeeks: new Decimal(0),
    priorLeaveTakenWeeks,
    citations,
    payableIndicator: 'accrued_not_currently_payable',
  };
}

export const saAccrualConstants = {
  perYearWeeks: SA_ACCRUAL_PER_YEAR,
  fullQualifyingYears: SA_FULL_QUALIFYING_YEARS,
  prorataQualifyingYears: SA_PRORATA_QUALIFYING_YEARS,
};
