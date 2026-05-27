import { Decimal, mul, sub } from '@/lib/lsl/engine/decimal';
import { citation } from '@/lib/lsl/engine/citation';
import type { Citation, Employee, Trigger } from '@/lib/lsl/engine/types';
import type { NTExtraInputs } from '../extra-inputs';
import { hasReachedAgePensionAge } from './age-pension-age';

/**
 * NT LSL Act 1981 s.8 accrual — T9.2.
 *
 * Numerical accrual: **13 weeks at 10 years** of continuous service per s.8.
 * Continuous at **1.3 wks/yr** thereafter (= `Years × 13/10`) — TIES WITH SA
 * as the most generous accrual ratio in Australia. The Act lists a discrete
 * step at 15 yrs (+6.5 wks) but this is mathematically equivalent to the
 * continuous 1.3 wks/yr applied past year 10.
 *
 * Pro-rata at termination (s.10(2) — 7–10 yr band, NT closed list):
 *   - Qualifying reasons: retirement (Age Pension age — TBD-NT-02 RESOLVED;
 *     dob lookup against Cth SS Act 1991 s.23 + operator override flag),
 *     employer-not-misconduct dismissal (TBD-NT-04), illness/incapacity/
 *     domestic-pressing-necessity.
 *   - Death 7–10 yrs: NOT NAMED in s.10(2) — covered separately under s.10(3)
 *     (TBD-NT-06 RESOLVED: s.10(3) "this section" cross-references both
 *     s.10(1) AND s.10(2); death at 7–10 yrs → pro-rata to personal
 *     representative).
 *   - voluntary_resignation 7–10 yrs: NOT qualifying — binary 10-yr cliff per
 *     TBD-NT-04 RESOLVED Option (a). Parallel to TAS TBD-TAS-07 and ACT
 *     closed-list.
 *   - serious_misconduct sub-10-yr: pro-rata forfeited per s.10.
 *   - Sub-7-yr: zero entitlement.
 *
 * 10+ yr full payout (s.10(1)):
 *   - ANY reason qualifies EXCEPT s.10(1A) serious & wilful misconduct, which
 *     restricts payment to complete 10y/15y blocks only (NT UNIQUE — TBD-NT-05).
 *     Engine truncates years to the nearest completed 10y or 15y multiple,
 *     NOT to nearest whole year. e.g. 12.5y → 10y block; 16y → 15y block;
 *     21y → 20y block (the "10y/15y multiples" reading per s.10(1A) is
 *     "completed 5-yr blocks starting at 10" — so 20y, 25y, 30y all count).
 *     Different from NSW/VIC/QLD/SA/ACT/TAS (full payout) and from WA (5-yr
 *     block partial-forfeiture).
 *   - Death 10+ yrs: payable to personal representative per s.10(3).
 *
 * NT per-year `RP × HWW × 1.3` formula (s.11(3)):
 *   - Engine sums per-year `(rate × hours_per_week × 1.3)` across each
 *     completed year of service when `extraInputs.nt_hours_per_week_by_year`
 *     is supplied. Lives in `value-of-week.ts`. Accrual-table surfaces
 *     `effectiveYearsForPayout` (the locked tenure used by the per-year sum)
 *     so the misconduct truncation interacts cleanly with the formula.
 *
 * Advance leave (taking_leave sub-10-yr): refused upstream in orchestrator
 * (returns $0 + `nt_advance_leave_not_permitted` advisory; parallel to TAS
 * TBD-TAS-08 and ACT TBD-ACT-14 RESOLVED — `status: computed` semantics, not
 * a hard error).
 *
 * As-at trigger bypasses qualifying-reason gates per E1 spec D20.
 *
 * Sources:
 *   - NT LSL Act 1981 s.8, s.10(1), s.10(1A), s.10(2), s.10(3), s.10(4),
 *     s.11(3)
 *   - Cth Social Security Act 1991 s.23 (Age Pension age table — see
 *     `./age-pension-age.ts`)
 *   - APA LSL Masterclass — NT section
 *   - docs/qa/test-cases-nt.md v1.0 PM-signed 2026-05-27
 */

const NT_ACCRUAL_PER_YEAR = new Decimal('13').dividedBy(10); // 1.3 wks/yr
const NT_FULL_QUALIFYING_YEARS = new Decimal('10.0000');
const NT_PRORATA_QUALIFYING_YEARS = new Decimal('7.0000');
const NT_15YR_BLOCK_YEARS = new Decimal('15.0000');
const NT_ACT_PAGE = 0; // NT Act page anchors TBD — RES-3 confirmation pending.

type QualifyingReason =
  | 'illness_incapacity'
  | 'domestic_pressing_necessity'
  | 'death'
  | 'redundancy'
  | 'employer_initiated_not_misconduct'
  | 'unfair_dismissal';

const QUALIFYING_REASONS: ReadonlySet<QualifyingReason> = new Set([
  'illness_incapacity',
  'domestic_pressing_necessity',
  'death',
  'redundancy',
  'employer_initiated_not_misconduct',
  // Unfair dismissal: employer-initiated, not-misconduct → qualifies for
  // 7–10 yr pro-rata under s.10(2). Cross-state precedent: NSW/VIC/QLD/WA/SA/
  // ACT/TAS all wire it (TAS T8.3 reconciliation Item 1 2026-05-26 added it
  // for parity).
  'unfair_dismissal',
]);

function isQualifyingReason(reason: string): reason is QualifyingReason {
  return (QUALIFYING_REASONS as ReadonlySet<string>).has(reason);
}

export interface NTAccrualResult {
  grossWeeks: Decimal;
  payableWeeks: Decimal;
  priorLeaveTakenWeeks: Decimal;
  citations: Citation[];
  payableIndicator: 'payable' | 'accrued_not_currently_payable';
  /**
   * Years of service used when computing the dollar payout (== `yearsOfService`
   * for the normal full/pro-rata paths; truncated to the nearest completed
   * 10y/15y/20y/25y/30y block for the s.10(1A) misconduct path). Exposed so
   * the per-year `RP × HWW × 1.3` formula in `value-of-week.ts` can sum the
   * correct year-bucket subset.
   */
  effectiveYearsForPayout: Decimal;
  sub7YrNoEntitlement?: boolean;
  sub10YrNoQualifyingReason?: boolean;
  sub10YrMisconductExcluded?: boolean;
  tenYrPlusMisconductCompleteBlocksOnly?: boolean;
  retirementAgePensionAgeApplied?: boolean;
  /**
   * True when the operator supplied `nt_age_pension_age_at_termination_reached: true`
   * to bypass the dob lookup. Surfaced as a separate advisory.
   */
  retirementGateBypassedByOverride?: boolean;
}

/**
 * Truncate years-of-service to the nearest completed 10y/15y/20y/25y/30y…
 * multiple per s.10(1A) misconduct treatment.
 *
 * The Act's "10 or 15 years" phrasing locks the minimum (10) and the second
 * cliff (15); thereafter the natural reading is "completed 5-yr blocks
 * starting at 10". Worked examples in the signed test-cases-nt.md line 591:
 *   - 10.0 yrs misconduct → 10 yrs payable
 *   - 14.999 yrs misconduct → 10 yrs payable
 *   - 15.000 yrs misconduct → 15 yrs payable
 *   - 21 yrs misconduct → 20 yrs payable
 *   - 29.99 yrs misconduct → 25 yrs payable
 * (sub-10y misconduct is forfeit — not reached by this function.)
 */
function truncateToCompleted10Or15YrBlock(years: Decimal): Decimal {
  const ten = new Decimal(10);
  const five = new Decimal(5);
  if (years.lt(ten)) return new Decimal(0);
  const above10 = years.minus(ten);
  const completedFiveYrBlocks = above10.dividedBy(five).floor();
  return ten.plus(completedFiveYrBlocks.times(five));
}

export function accrualNT(
  yearsOfService: Decimal,
  employee: Employee,
  trigger: Trigger,
  priorLeaveTakenWeeks: Decimal = new Decimal(0)
): NTAccrualResult {
  const citations: Citation[] = [];
  const grossWeeks = mul(yearsOfService, NT_ACCRUAL_PER_YEAR);
  const extras = (employee.extraInputs ?? {}) as NTExtraInputs;

  // ── as_at snapshot — E1 spec D20 bypass.
  if (trigger.kind === 'as_at') {
    citations.push(
      citation(
        'NT LSL Act 1981 s.8',
        'accrual.snapshot.no-qualifying-reason-threshold',
        NT_ACT_PAGE,
        'as-at snapshot per E1 spec D20 — qualifying-period threshold NOT applied'
      )
    );
    let payable = sub(grossWeeks, priorLeaveTakenWeeks);
    if (payable.lt(0)) payable = new Decimal(0);
    const payableIndicator: 'payable' | 'accrued_not_currently_payable' =
      yearsOfService.lt(NT_PRORATA_QUALIFYING_YEARS)
        ? 'accrued_not_currently_payable'
        : 'payable';
    return {
      grossWeeks,
      payableWeeks: payable,
      priorLeaveTakenWeeks,
      citations,
      payableIndicator,
      effectiveYearsForPayout: yearsOfService,
    };
  }

  // ── Sub-7-yr — universal floor, zero entitlement.
  if (yearsOfService.lt(NT_PRORATA_QUALIFYING_YEARS)) {
    citations.push(
      citation(
        'NT LSL Act 1981 s.10(2)',
        'accrual.sub-7yr-no-entitlement',
        NT_ACT_PAGE
      )
    );
    return {
      grossWeeks,
      payableWeeks: new Decimal(0),
      priorLeaveTakenWeeks,
      citations,
      payableIndicator: 'accrued_not_currently_payable',
      sub7YrNoEntitlement: true,
      effectiveYearsForPayout: new Decimal(0),
    };
  }

  // ── 10+ yr full-payout branch — ANY reason qualifies EXCEPT s.10(1A)
  // serious misconduct (which truncates to complete 10y/15y blocks only).
  if (yearsOfService.gte(NT_FULL_QUALIFYING_YEARS)) {
    citations.push(
      citation(
        'NT LSL Act 1981 s.10(1)',
        'accrual.qualifying-period-10yr-13wks',
        NT_ACT_PAGE
      )
    );
    citations.push(
      citation(
        'NT LSL Act 1981 s.8',
        'accrual.continuous-1.3-per-year',
        NT_ACT_PAGE
      )
    );

    // ── s.10(1A) — serious & wilful misconduct at 10+ yrs truncates to
    // complete 10y/15y blocks. NT UNIQUE — TBD-NT-05 RESOLVED Option (a)
    // strict literal reading.
    if (
      trigger.kind === 'termination' &&
      trigger.reason === 'serious_misconduct'
    ) {
      citations.push(
        citation(
          'NT LSL Act 1981 s.10(1A)',
          'accrual.10yr-plus-misconduct-complete-blocks-only',
          NT_ACT_PAGE
        )
      );
      const effectiveYears = truncateToCompleted10Or15YrBlock(yearsOfService);
      const blockWeeks = mul(effectiveYears, NT_ACCRUAL_PER_YEAR);
      let payable = sub(blockWeeks, priorLeaveTakenWeeks);
      if (payable.lt(0)) payable = new Decimal(0);
      return {
        grossWeeks,
        payableWeeks: payable,
        priorLeaveTakenWeeks,
        citations,
        payableIndicator: 'payable',
        tenYrPlusMisconductCompleteBlocksOnly: true,
        effectiveYearsForPayout: effectiveYears,
      };
    }

    if (trigger.kind === 'termination' && trigger.reason === 'death') {
      citations.push(
        citation(
          'NT LSL Act 1981 s.10(3)',
          'trigger.termination.death.10yr-plus.personal-representative',
          NT_ACT_PAGE
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
      effectiveYearsForPayout: yearsOfService,
    };
  }

  // ── 7–10 yr pro-rata branch — qualifying-reason gate.
  if (trigger.kind === 'taking_leave' || trigger.kind === 'cash_out') {
    // Informational pro-rata surface — orchestrator handles the advance-leave
    // refusal (taking_leave) and cash-out forbidden hard-error (cash_out).
    citations.push(
      citation(
        'NT LSL Act 1981 s.10(2)',
        'accrual.7-to-10yr.pro-rata-informational',
        NT_ACT_PAGE
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
      effectiveYearsForPayout: yearsOfService,
    };
  }

  if (trigger.kind === 'termination') {
    const reason = trigger.reason;

    if (reason === 'serious_misconduct') {
      citations.push(
        citation(
          'NT LSL Act 1981 s.10',
          'accrual.7-to-10yr.serious-misconduct-excluded',
          NT_ACT_PAGE
        )
      );
      return {
        grossWeeks,
        payableWeeks: new Decimal(0),
        priorLeaveTakenWeeks,
        citations,
        payableIndicator: 'accrued_not_currently_payable',
        sub10YrMisconductExcluded: true,
        effectiveYearsForPayout: new Decimal(0),
      };
    }

    // ── Retirement: TBD-NT-02 RESOLVED Option (b) primary + Option (c)
    // override layered. Operator override bypasses the dob lookup.
    if (reason === 'retirement') {
      const overrideTriggered =
        extras.nt_age_pension_age_at_termination_reached === true;
      const reachedByDob = hasReachedAgePensionAge(
        employee.dob,
        trigger.terminationDate
      );

      if (overrideTriggered || reachedByDob) {
        citations.push(
          citation(
            'NT LSL Act 1981 s.10(2)',
            'accrual.7-to-10yr.retirement-qualifies-via-age-pension-age',
            NT_ACT_PAGE
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
          retirementAgePensionAgeApplied: true,
          retirementGateBypassedByOverride: overrideTriggered && !reachedByDob,
          effectiveYearsForPayout: yearsOfService,
        };
      }

      // Retirement reason but age-pension-age gate not satisfied → no
      // qualifying signal. Per TBD-NT-04 strict closed-list reading.
      citations.push(
        citation(
          'NT LSL Act 1981 s.10(2)',
          'accrual.7-to-10yr.retirement-no-qualifying-signal',
          NT_ACT_PAGE
        )
      );
      return {
        grossWeeks,
        payableWeeks: new Decimal(0),
        priorLeaveTakenWeeks,
        citations,
        payableIndicator: 'accrued_not_currently_payable',
        sub10YrNoQualifyingReason: true,
        effectiveYearsForPayout: new Decimal(0),
      };
    }

    if (isQualifyingReason(reason)) {
      const ruleKey = `accrual.7-to-10yr.${reason}-qualifies` as const;
      citations.push(citation('NT LSL Act 1981 s.10(2)', ruleKey, NT_ACT_PAGE));
      if (reason === 'death') {
        // s.10(3) cross-references — TBD-NT-06 RESOLVED Option (a).
        citations.push(
          citation(
            'NT LSL Act 1981 s.10(3)',
            'trigger.termination.death.7-to-10yr.personal-representative',
            NT_ACT_PAGE
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
        effectiveYearsForPayout: yearsOfService,
      };
    }

    // Voluntary resignation 7–10 yrs: NOT qualifying — binary 10-yr cliff per
    // TBD-NT-04 RESOLVED Option (a).
    citations.push(
      citation(
        'NT LSL Act 1981 s.10(2)',
        'accrual.7-to-10yr.no-qualifying-reason',
        NT_ACT_PAGE
      )
    );
    return {
      grossWeeks,
      payableWeeks: new Decimal(0),
      priorLeaveTakenWeeks,
      citations,
      payableIndicator: 'accrued_not_currently_payable',
      sub10YrNoQualifyingReason: true,
      effectiveYearsForPayout: new Decimal(0),
    };
  }

  return {
    grossWeeks,
    payableWeeks: new Decimal(0),
    priorLeaveTakenWeeks,
    citations,
    payableIndicator: 'accrued_not_currently_payable',
    effectiveYearsForPayout: new Decimal(0),
  };
}

export const ntAccrualConstants = {
  perYearWeeks: NT_ACCRUAL_PER_YEAR,
  fullQualifyingYears: NT_FULL_QUALIFYING_YEARS,
  prorataQualifyingYears: NT_PRORATA_QUALIFYING_YEARS,
  fifteenYrBlockYears: NT_15YR_BLOCK_YEARS,
};

export const __INTERNAL = {
  truncateToCompleted10Or15YrBlock,
};
