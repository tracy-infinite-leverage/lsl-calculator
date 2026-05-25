import { Decimal, mul, sub } from '@/lib/lsl/engine/decimal';
import { citation } from '@/lib/lsl/engine/citation';
import type { Citation, Trigger } from '@/lib/lsl/engine/types';

/**
 * WA LSL Act 1958 s.8 accrual.
 *
 * Numerical accrual: 8.6667 weeks at 10 years of continuous employment, plus
 * 4.3333 weeks for each further 5 years (1/60 ratio — same as NSW, VIC, QLD).
 * Continuous accrual at 1/60 across all tenure bands ≥ 7 yrs per TBD-WA-04
 * RESOLVED — no discrete step at 15 yrs.
 *
 * Thresholds at 7, 10, 15, 20, 25 yrs inclusive at exact-day boundary
 * (TBD-WA-04 RESOLVED).
 *
 * Pro-rata at termination (s.8(3)):
 *   - 7+ yrs, ANY reason EXCEPT serious_misconduct → pro-rata payable.
 *     Includes voluntary_resignation, redundancy, employer dismissal not for
 *     misconduct, illness, domestic pressing necessity, poor_performance,
 *     unfair_dismissal, and death.
 *   - Sub-7-yr: zero entitlement regardless of reason.
 *
 * Serious-misconduct treatment:
 *   - Sub-10-yr → full forfeiture ($0).
 *   - 10+yr → PARTIAL forfeiture per TBD-WA-07 RESOLVED:
 *     payable = max(0, last_fully_accrued_block_weeks - leave_already_taken_against_that_block)
 *     The "last fully-accrued block" is 8.6667 wks at the 10-yr mark, or
 *     +4.3333 wks at each subsequent 5-yr mark. Accrual since the last
 *     milestone is forfeited entirely.
 *
 * As-at trigger bypasses qualifying-reason gates per E1 spec D20.
 *
 * Sources:
 *   - WA LSL Act 1958 ss.8(1), 8(3)
 *   - DEMIRS — long service leave guidance
 *   - APA LSL Masterclass PDF pp.65-79
 *   - docs/qa/test-cases-wa.md v1.0 PM-signed 2026-05-25
 */

const WA_ACCRUAL_PER_YEAR = new Decimal('8.6667').dividedBy(10); // 0.86667
const WA_FULL_QUALIFYING_YEARS = new Decimal('10.0000');
const WA_PRORATA_QUALIFYING_YEARS = new Decimal('7.0000');
const WA_FIRST_BLOCK_WEEKS = new Decimal('8.6667');
const WA_SUBSEQUENT_BLOCK_WEEKS = new Decimal('4.3333');

/**
 * For a given years-of-service ≥ 10, return the weeks accrued in the last
 * FULLY-ACCRUED block (the most recent milestone the employee crossed).
 *
 * At exactly 10 yrs → 8.6667 wks (10-yr milestone).
 * At [10, 15) yrs → 8.6667 wks (10-yr was the most recent milestone).
 * At exactly 15 yrs → 13.0000 wks (10-yr + 15-yr blocks both fully accrued).
 * At [15, 20) yrs → 13.0000 wks.
 * At exactly 20 yrs → 17.3333 wks. etc.
 *
 * NOTE: this is the cumulative weeks at the milestone, not just the most-
 * recent-block weeks alone. Per TBD-WA-07 RESOLVED, the "last fully accrued
 * entitlement" includes ALL blocks fully accrued up to and including the
 * most recent milestone — i.e., the total accrued up to milestone N.
 */
function lastFullyAccruedBlockWeeks(yearsOfService: Decimal): Decimal {
  // Floor to whole 5-yr increments past 10 (inclusive at exactly milestone).
  if (yearsOfService.lt(WA_FULL_QUALIFYING_YEARS)) return new Decimal(0);
  // milestonesAfter10 = floor((yearsOfService - 10) / 5)
  // (e.g. 10.0 → 0, 12.5 → 0, 15.0 → 1, 17.0 → 1, 20.0 → 2)
  const yearsBeyond10 = yearsOfService.minus(WA_FULL_QUALIFYING_YEARS);
  const milestonesBeyond10 = yearsBeyond10.dividedBy(5).floor();
  return WA_FIRST_BLOCK_WEEKS.plus(
    WA_SUBSEQUENT_BLOCK_WEEKS.times(milestonesBeyond10)
  );
}

export interface WAAccrualResult {
  grossWeeks: Decimal;
  payableWeeks: Decimal;
  priorLeaveTakenWeeks: Decimal;
  citations: Citation[];
  payableIndicator: 'payable' | 'accrued_not_currently_payable';
  /** Internal: did the sub-10-yr misconduct exclusion fire? */
  misconductExcludedSub10?: boolean;
  /** Internal: did the 10+yr partial-forfeiture path fire? */
  partialForfeiture10Plus?: boolean;
  /** Internal: weeks of the last fully-accrued block (for diagnostics on 10+yr misconduct). */
  lastFullyAccruedBlockWeeks?: Decimal;
  /** Internal: accrual since the last milestone (forfeited under partial-forfeiture). */
  accrualSinceLastMilestoneWeeks?: Decimal;
}

export function accrualWA(
  yearsOfService: Decimal,
  trigger: Trigger,
  priorLeaveTakenWeeks: Decimal = new Decimal(0)
): WAAccrualResult {
  const citations: Citation[] = [];
  const grossWeeks = mul(yearsOfService, WA_ACCRUAL_PER_YEAR);

  // ── As-at snapshot: bypass qualifying-reason gates per E1 spec D20.
  if (trigger.kind === 'as_at') {
    citations.push(
      citation(
        'WA LSL Act 1958 s.8',
        'accrual.snapshot.no-qualifying-reason-threshold',
        65,
        'as-at snapshot per E1 spec D20 — qualifying-period threshold NOT applied'
      )
    );
    let payable = sub(grossWeeks, priorLeaveTakenWeeks);
    if (payable.lt(0)) payable = new Decimal(0);
    const payableIndicator: 'payable' | 'accrued_not_currently_payable' =
      yearsOfService.lt(WA_PRORATA_QUALIFYING_YEARS)
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

  // ── Sub-7-yr: zero entitlement regardless of reason.
  if (yearsOfService.lt(WA_PRORATA_QUALIFYING_YEARS)) {
    citations.push(
      citation(
        'WA LSL Act 1958 s.8(3)',
        'accrual.sub-7yr-no-entitlement',
        66
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

  // ── 10+ yrs serious misconduct: PARTIAL forfeiture (WA-unique).
  if (
    trigger.kind === 'termination' &&
    trigger.reason === 'serious_misconduct' &&
    yearsOfService.gte(WA_FULL_QUALIFYING_YEARS)
  ) {
    const lastBlock = lastFullyAccruedBlockWeeks(yearsOfService);
    const accrualSinceLastMilestone = sub(grossWeeks, lastBlock);
    let payable = sub(lastBlock, priorLeaveTakenWeeks);
    if (payable.lt(0)) payable = new Decimal(0);
    citations.push(
      citation(
        'WA LSL Act 1958 s.8(3)',
        'trigger.termination.10yr-plus-misconduct-last-block-only',
        67
      )
    );
    return {
      grossWeeks,
      payableWeeks: payable,
      priorLeaveTakenWeeks,
      citations,
      payableIndicator: 'payable',
      partialForfeiture10Plus: true,
      lastFullyAccruedBlockWeeks: lastBlock,
      accrualSinceLastMilestoneWeeks: accrualSinceLastMilestone,
    };
  }

  // ── 7-10 yr serious misconduct: full forfeiture.
  if (
    trigger.kind === 'termination' &&
    trigger.reason === 'serious_misconduct'
  ) {
    citations.push(
      citation(
        'WA LSL Act 1958 s.8(3)',
        'accrual.7-to-10yr.serious-misconduct-excluded',
        67
      )
    );
    return {
      grossWeeks,
      payableWeeks: new Decimal(0),
      priorLeaveTakenWeeks,
      citations,
      payableIndicator: 'accrued_not_currently_payable',
      misconductExcludedSub10: true,
    };
  }

  // ── 10+ yrs, non-misconduct: full payout (any reason).
  if (yearsOfService.gte(WA_FULL_QUALIFYING_YEARS)) {
    citations.push(
      citation(
        'WA LSL Act 1958 s.8(1)',
        'accrual.qualifying-period-10yr',
        65
      )
    );
    if (trigger.kind === 'termination') {
      citations.push(
        citation(
          'WA LSL Act 1958 s.8(3)',
          'trigger.termination.any-reason-except-misconduct',
          65
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

  // ── 7-10 yrs, non-misconduct: pro-rata payable (any reason except misconduct).
  // For taking_leave and cash_out at 7-10 yrs we still compute (advisory model).
  if (trigger.kind === 'taking_leave' || trigger.kind === 'cash_out') {
    citations.push(
      citation(
        'WA LSL Act 1958 s.8(3)',
        'accrual.7-to-10yr.proportionate',
        66
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

  // Termination at 7-10 yrs for non-misconduct reason — pro-rata payable.
  if (trigger.kind === 'termination') {
    // All non-misconduct reasons qualify under s.8(3) "any reason other than
    // serious misconduct". Includes voluntary_resignation, redundancy,
    // employer_initiated_not_misconduct, illness_incapacity,
    // domestic_pressing_necessity, death, unfair_dismissal, poor_performance.
    let ruleKey = 'accrual.7-to-10yr.any-reason-except-misconduct';
    let note: string | undefined;
    if (trigger.reason === 'poor_performance') {
      ruleKey = 'accrual.7-to-10yr.poor-performance-qualifies';
      note =
        'WA s.8(3) only excludes serious misconduct — poor performance does NOT bar pro-rata (divergence from QLD s.95(3)(d)).';
    } else if (trigger.reason === 'death') {
      ruleKey = 'trigger.termination.death-pro-rata';
    }
    citations.push(
      citation('WA LSL Act 1958 s.8(3)', ruleKey, 66, note)
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

  // Defensive fallback.
  return {
    grossWeeks,
    payableWeeks: new Decimal(0),
    priorLeaveTakenWeeks,
    citations,
    payableIndicator: 'accrued_not_currently_payable',
  };
}

export const waAccrualConstants = {
  perYearWeeks: WA_ACCRUAL_PER_YEAR,
  fullQualifyingYears: WA_FULL_QUALIFYING_YEARS,
  prorataQualifyingYears: WA_PRORATA_QUALIFYING_YEARS,
  firstBlockWeeks: WA_FIRST_BLOCK_WEEKS,
  subsequentBlockWeeks: WA_SUBSEQUENT_BLOCK_WEEKS,
};

export { lastFullyAccruedBlockWeeks };
