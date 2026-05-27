import { Decimal, mul, sub } from '@/lib/lsl/engine/decimal';
import { citation } from '@/lib/lsl/engine/citation';
import type { Citation, Employee, Trigger } from '@/lib/lsl/engine/types';
import type { NTExtraInputs } from '../extra-inputs';

/**
 * NT LSL Act 1981 s.8 accrual — T9.1 SCAFFOLD.
 *
 * Numerical accrual: **13 weeks at 10 years** of continuous service per s.8.
 * Continuous at **1.3 wks/yr** thereafter (= `Years × 13/10`) — TIES WITH SA
 * as the most generous accrual ratio in Australia. The Act lists a discrete
 * step at 15 yrs (+6.5 wks) but this is mathematically equivalent to the
 * continuous 1.3 wks/yr applied past year 10.
 *
 * Pro-rata at termination (s.10(2) — 7–10 yr band, NT closed list):
 *   - Qualifying reasons: retirement (Age Pension age — TBD-NT-02),
 *     employer-not-misconduct dismissal (TBD-NT-04), illness/incapacity/
 *     domestic-pressing-necessity.
 *   - Death 7–10 yrs: NOT NAMED in s.10(2) — covered separately under s.10(3)
 *     (TBD-NT-06: s.10(3) "this section" cross-references both s.10(1) AND
 *     s.10(2); death at 7–10 yrs → pro-rata to personal representative).
 *   - voluntary_resignation 7–10 yrs: NOT qualifying — binary 10-yr cliff per
 *     TBD-NT-04 RESOLVED Option (a). Parallel to TAS TBD-TAS-07 and ACT
 *     closed-list.
 *   - serious_misconduct sub-10-yr: pro-rata forfeited per s.10.
 *   - Sub-7-yr: zero entitlement.
 *
 * 10+ yr full payout (s.10(1)):
 *   - ANY reason qualifies EXCEPT s.10(1A) serious & wilful misconduct, which
 *     restricts payment to complete 10y/15y blocks only (NT UNIQUE — TBD-NT-05).
 *     Different from NSW/VIC/QLD/SA/ACT/TAS (full payout) and from WA (5-yr
 *     block partial-forfeiture).
 *   - Death 10+ yrs: payable to personal representative per s.10(3).
 *
 * NT per-year `RP × HWW × 1.3` formula (s.11(3)):
 *   - Engine MUST sum per-year `(rate × hours_per_week × 1.3)` across each
 *     completed year of service when `extraInputs.nt_hours_per_week_by_year`
 *     is supplied. T9.1 SCAFFOLD: this is implemented in `value-of-week.ts`
 *     as a STUB. Full implementation lands in T9.2.
 *
 * Advance leave (taking_leave sub-10-yr):
 *   - NOT PERMITTED — the NT Act contains no advance-leave clause. Engine
 *     returns $0 with `nt_advance_leave_not_permitted` advisory (parallel to
 *     TAS TBD-TAS-08 and ACT TBD-ACT-14 RESOLVED `status: computed` semantics,
 *     not a hard error). Orchestrator handles the refusal; this module emits
 *     zero payable weeks. (Implementation completes in T9.2.)
 *
 * As-at trigger bypasses qualifying-reason gates per E1 spec D20.
 *
 * Sources:
 *   - NT LSL Act 1981 s.8, s.10(1), s.10(1A), s.10(2), s.10(3), s.10(4),
 *     s.11(3)
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
  sub7YrNoEntitlement?: boolean;
  sub10YrNoQualifyingReason?: boolean;
  sub10YrMisconductExcluded?: boolean;
  tenYrPlusMisconductCompleteBlocksOnly?: boolean;
  retirementAgePensionAgeApplied?: boolean;
}

/**
 * T9.1 SCAFFOLD: minimal-correct gates so the smoke fixture (TC-NT-001) can
 * reach a computed result through the orchestrator. The full per-year
 * formula, retirement-age lookup, casual continuity evaluator, and the
 * complete s.10(1A) complete-blocks-only logic land in T9.2.
 */
export function accrualNT(
  yearsOfService: Decimal,
  employee: Employee,
  trigger: Trigger,
  priorLeaveTakenWeeks: Decimal = new Decimal(0)
): NTAccrualResult {
  const citations: Citation[] = [];
  const grossWeeks = mul(yearsOfService, NT_ACCRUAL_PER_YEAR);
  // T9.1: extras read deferred to T9.2 for the per-year formula, age-pension
  // lookup, and casual continuity. The retirement branch below reads extras
  // directly via `employee.extraInputs as NTExtraInputs`.

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

    let tenYrPlusMisconductCompleteBlocksOnly = false;

    // ── s.10(1A) — serious & wilful misconduct at 10+ yrs truncates to
    // complete 10y/15y blocks. NT UNIQUE — TBD-NT-05 RESOLVED Option (a)
    // strict literal reading. T9.1 SCAFFOLD: detect and flag; the truncation
    // arithmetic is finalised in T9.2.
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
      tenYrPlusMisconductCompleteBlocksOnly = true;
      // T9.1 stub truncation: use the nearest completed 10y/15y block.
      // T9.2 will replace this with the locked s.10(1A) reading.
      const completedBlock = yearsOfService.gte(NT_15YR_BLOCK_YEARS)
        ? NT_15YR_BLOCK_YEARS
        : NT_FULL_QUALIFYING_YEARS;
      const blockWeeks = mul(completedBlock, NT_ACCRUAL_PER_YEAR);
      let payable = sub(blockWeeks, priorLeaveTakenWeeks);
      if (payable.lt(0)) payable = new Decimal(0);
      return {
        grossWeeks,
        payableWeeks: payable,
        priorLeaveTakenWeeks,
        citations,
        payableIndicator: 'payable',
        tenYrPlusMisconductCompleteBlocksOnly,
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
      };
    }

    // T9.1 SCAFFOLD: retirement qualifies via either operator override
    // (`nt_age_pension_age_at_termination_reached`) or the strict closed-list
    // reading per TBD-NT-04 — full Age Pension age lookup against
    // `employee.dob` lands in T9.2.
    if (reason === 'retirement') {
      const extras = (employee.extraInputs ?? {}) as NTExtraInputs;
      if (extras.nt_age_pension_age_at_termination_reached === true) {
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
        };
      }
      // T9.1 stub: without operator override and without the T9.2 dob lookup
      // implementation, the retirement gate falls through to "no qualifying
      // signal". T9.2 will add the s.23 Cth SS Act 1991 lookup.
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
    };
  }

  return {
    grossWeeks,
    payableWeeks: new Decimal(0),
    priorLeaveTakenWeeks,
    citations,
    payableIndicator: 'accrued_not_currently_payable',
  };
}

export const ntAccrualConstants = {
  perYearWeeks: NT_ACCRUAL_PER_YEAR,
  fullQualifyingYears: NT_FULL_QUALIFYING_YEARS,
  prorataQualifyingYears: NT_PRORATA_QUALIFYING_YEARS,
  fifteenYrBlockYears: NT_15YR_BLOCK_YEARS,
};
