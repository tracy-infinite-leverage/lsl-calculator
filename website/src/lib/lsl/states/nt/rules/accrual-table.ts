import { Decimal, mul, sub } from '@/lib/lsl/engine/decimal';
import { citation } from '@/lib/lsl/engine/citation';
import type { Citation, Employee, Trigger } from '@/lib/lsl/engine/types';
import type { NTExtraInputs } from '../extra-inputs';

/**
 * NT LSL Act 1981 s.8 accrual — T9.1 SCAFFOLD.
 *
 * Numerical accrual: **13 weeks** at 10 years of continuous service per s.8.
 * Subsequent +6.5 weeks per completed 5-year block (15 yr, 20 yr, …).
 * Equivalent to a continuous 1.3 wks/yr rate past year 10 — TIES WITH SA as
 * the most generous accrual ratio in the country.
 *
 * Pro-rata at termination (s.10(2) — 7–10 yr band — closed list):
 *   - Qualifying reasons: retirement (Age Pension age — TBD-NT-02),
 *     employer_initiated_not_misconduct, illness_incapacity,
 *     domestic_pressing_necessity, redundancy, unfair_dismissal.
 *   - voluntary_resignation 7–10 yrs: NOT qualifying — binary 10-yr cliff per
 *     TBD-NT-04 RESOLVED (closed-list reading of s.10(2)).
 *   - serious_misconduct sub-10-yr: pro-rata forfeited.
 *   - Sub-7-yr: zero entitlement.
 *
 * Death routing (s.10(3) cross-references both s.10(1) AND s.10(2) — TBD-NT-06):
 *   - Sub-7-yr death → $0 with `nt_death_sub_7yr_no_entitlement` advisory.
 *   - 7–10 yr death → s.10(2) pro-rata (death auto-qualifies).
 *   - 10+ yr death → s.10(1) full payout.
 *   - Payment recipient: personal representative — engine emits
 *     `nt_death_payable_to_personal_representative` advisory.
 *
 * 10+ yr full payout (s.10(1)):
 *   - ANY reason qualifies EXCEPT serious & wilful misconduct.
 *   - Serious & wilful misconduct at 10+ yrs is NT-UNIQUE per s.10(1A):
 *     only complete 10y/15y multiples are payable. E.g. 11.5 yrs misconduct
 *     → 10 yrs payable; 16 yrs misconduct → 15 yrs; 21 yrs → 20 yrs. Engine
 *     truncates to nearest completed 5-yr multiple starting at 10.
 *     Different from NSW/VIC/QLD/SA/ACT/TAS (full payout) and from WA
 *     (5-yr-block partial-forfeiture). See TBD-NT-05.
 *
 * Advance leave (taking_leave sub-10-yr):
 *   - NOT PERMITTED — the NT Act contains no advance-leave clause. Engine
 *     returns $0 with `nt_advance_leave_not_permitted` advisory.
 *
 * Cash-out (s.10(4)):
 *   - FORBIDDEN — handled in the orchestrator via `NTCashOutForbiddenError`
 *     hard-error path (TBD-NT-08). Not reached in the accrual table.
 *
 * As-at trigger bypasses qualifying-reason gates per E1 spec D20.
 *
 * Sources:
 *   - NT LSL Act 1981 s.8, s.10(1), s.10(1A), s.10(2), s.10(3)
 *   - APA LSL Masterclass — NT section
 *   - Cth Social Security Act 1991 s.23 (pension age year-of-birth lookup)
 *   - docs/qa/test-cases-nt.md v1.0 PM-signed 2026-05-27
 */

const NT_ACCRUAL_AT_10YR = new Decimal('13.0000');
const NT_ACCRUAL_PER_YEAR = new Decimal('1.3000');         // 13 / 10 — same ratio as SA
const NT_FULL_QUALIFYING_YEARS = new Decimal('10.0000');
const NT_PRORATA_QUALIFYING_YEARS = new Decimal('7.0000');
const NT_ACT_PAGE = 0; // NT Act published as HTML — no fixed PDF page anchor like other states

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
  // Unfair dismissal: employer-initiated, not-misconduct → qualifies for 7-10yr
  // pro-rata under NT s.10(2)(b). Cross-state precedent unanimous: TAS/ACT/SA/
  // QLD/WA/NSW all wire it.
  'unfair_dismissal',
]);

function isQualifyingReason(reason: string): reason is QualifyingReason {
  return (QUALIFYING_REASONS as ReadonlySet<string>).has(reason);
}

/**
 * Cth Social Security Act 1991 s.23 — Age Pension age year-of-birth lookup.
 *
 * Per TBD-NT-02 RESOLVED 2026-05-27 Option (b). Engine reads `employee.dob`
 * and returns the applicable Age Pension age. Override path is layered on
 * top via `extraInputs.nt_age_pension_age_at_termination_reached`.
 *
 * Table:
 *   - born ≤ 30 Jun 1952              → 65
 *   - 1 Jul 1952 – 31 Dec 1953        → 65.5
 *   - 1 Jan 1954 – 30 Jun 1955        → 66
 *   - 1 Jul 1955 – 31 Dec 1956        → 66.5
 *   - 1 Jan 1957 onwards              → 67
 */
function agePensionAgeForDob(dob: string): number {
  if (dob <= '1952-06-30') return 65;
  if (dob <= '1953-12-31') return 65.5;
  if (dob <= '1955-06-30') return 66;
  if (dob <= '1956-12-31') return 66.5;
  return 67;
}

/**
 * Retirement qualifies under NT s.10(2)(a) if:
 *   (a) `extraInputs.nt_age_pension_age_at_termination_reached === true` —
 *       operator override (TBD-NT-02 Option (c) layer); OR
 *   (b) `employee.dob` is set AND, at the trigger date, the employee meets
 *       the looked-up Cth Age Pension age (TBD-NT-02 Option (b)).
 *
 * When neither signal is available, engine treats the gate as not satisfied
 * and the orchestrator emits `nt_retirement_gate_unverified`.
 */
function retirementQualifiesNT(
  employee: Employee,
  triggerDate: string,
  extras: NTExtraInputs
): { qualifies: boolean; lookedUpAge?: number; source: 'override' | 'dob_lookup' | 'unverified' } {
  if (extras.nt_age_pension_age_at_termination_reached === true) {
    return { qualifies: true, source: 'override' };
  }
  if (!employee.dob) return { qualifies: false, source: 'unverified' };

  const dob = employee.dob;
  const dobY = Number(dob.slice(0, 4));
  const dobM = Number(dob.slice(5, 7));
  const dobD = Number(dob.slice(8, 10));
  const trY = Number(triggerDate.slice(0, 4));
  const trM = Number(triggerDate.slice(5, 7));
  const trD = Number(triggerDate.slice(8, 10));
  let ageAtTrigger = trY - dobY;
  if (trM < dobM || (trM === dobM && trD < dobD)) ageAtTrigger -= 1;

  // For the 65.5 / 66.5 fractional thresholds, compute age including months.
  // Simplification: years + months/12 (day-precision negligible at this granularity).
  let monthsDelta = trM - dobM;
  if (trD < dobD) monthsDelta -= 1;
  const ageFractional = (trY - dobY) + monthsDelta / 12;

  const lookedUpAge = agePensionAgeForDob(dob);
  // Compare against the fractional age for 65.5 / 66.5 cohorts; otherwise integer.
  const meets = Number.isInteger(lookedUpAge)
    ? ageAtTrigger >= lookedUpAge
    : ageFractional >= lookedUpAge;
  return { qualifies: meets, lookedUpAge, source: 'dob_lookup' };
}

/**
 * NT s.10(1A) misconduct block-truncation per TBD-NT-05 RESOLVED.
 *
 * Truncates `years` to the nearest completed multiple of 5 starting at 10:
 * {10, 15, 20, 25, 30, ...}. Returns 0 if `years < 10`.
 *
 * Examples:
 *   - 10.0  → 10
 *   - 14.999 → 10
 *   - 15.0  → 15
 *   - 21.0  → 20
 *   - 29.99 → 25
 */
function truncateToBlockYears(years: Decimal): number {
  const y = Number(years.toFixed(6));
  if (y < 10) return 0;
  return Math.floor(y / 5) * 5;
}

/**
 * Entitlement weeks for a given completed-block tenure under NT s.8.
 *   - 10 yrs → 13 wks
 *   - 15 yrs → 19.5 wks
 *   - 20 yrs → 26 wks
 *   - 25 yrs → 32.5 wks
 *   - 30 yrs → 39 wks
 *
 * Equivalent to `years × 1.3` for any block multiple of 5 starting at 10.
 */
function weeksForBlockYears(blockYears: number): Decimal {
  if (blockYears < 10) return new Decimal(0);
  return new Decimal(blockYears).times(NT_ACCRUAL_PER_YEAR);
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
  /** Block years the engine truncated to (10/15/20/25/30) when s.10(1A) fires. */
  misconductBlockYears?: number;
  retirementGateUnverified?: boolean;
  retirementLookedUpAge?: number;
  /** True when the death routing applied (s.10(3) cross-ref to s.10(1)/(2)). */
  deathRoutingApplied?: boolean;
  /** True for sub-7-yr death — emits `nt_death_sub_7yr_no_entitlement`. */
  deathSub7yrNoEntitlement?: boolean;
  /** True for voluntary resignation in 7–10 yr band — binary 10-yr cliff. */
  voluntaryResignationSub10yrCliff?: boolean;
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
    };
  }

  // ── Sub-7-yr — universal floor, zero entitlement.
  if (yearsOfService.lt(NT_PRORATA_QUALIFYING_YEARS)) {
    citations.push(
      citation('NT LSL Act 1981 s.10(2)', 'accrual.sub-7yr-no-entitlement', NT_ACT_PAGE)
    );
    // Sub-7-yr death is explicitly $0 + advisory per TBD-NT-06.
    const isDeath = trigger.kind === 'termination' && trigger.reason === 'death';
    return {
      grossWeeks,
      payableWeeks: new Decimal(0),
      priorLeaveTakenWeeks,
      citations,
      payableIndicator: 'accrued_not_currently_payable',
      sub7YrNoEntitlement: true,
      ...(isDeath ? { deathSub7yrNoEntitlement: true, deathRoutingApplied: true } : {}),
    };
  }

  // ── 10+ yr full-payout branch — ANY reason qualifies EXCEPT misconduct.
  if (yearsOfService.gte(NT_FULL_QUALIFYING_YEARS)) {
    citations.push(
      citation(
        'NT LSL Act 1981 s.8',
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

    if (
      trigger.kind === 'termination' &&
      trigger.reason === 'serious_misconduct'
    ) {
      // s.10(1A) complete-blocks-only truncation — NT UNIQUE.
      const blockYears = truncateToBlockYears(yearsOfService);
      const blockWeeks = weeksForBlockYears(blockYears);
      let payable = sub(blockWeeks, priorLeaveTakenWeeks);
      if (payable.lt(0)) payable = new Decimal(0);
      citations.push(
        citation(
          'NT LSL Act 1981 s.10(1A)',
          'accrual.10yr-plus-misconduct-complete-blocks-only',
          NT_ACT_PAGE
        )
      );
      return {
        grossWeeks,
        payableWeeks: payable,
        priorLeaveTakenWeeks,
        citations,
        payableIndicator: 'payable',
        tenYrPlusMisconductCompleteBlocksOnly: true,
        misconductBlockYears: blockYears,
      };
    }

    // Death at 10+ yrs — full s.10(1) payout, payable to personal rep.
    if (trigger.kind === 'termination' && trigger.reason === 'death') {
      citations.push(
        citation(
          'NT LSL Act 1981 s.10(3)',
          'trigger.termination.death.10yr-plus-full-payout',
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
        deathRoutingApplied: true,
      };
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
    // Pro-rata 7–10 yr CAN be informationally surfaced as accrued for taking-
    // leave / cash-out workflows. Real handling (advance-leave refusal, cash-
    // out hard-error) lives in the orchestrator.
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
          'NT LSL Act 1981 s.10(2)',
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

    if (reason === 'retirement') {
      const ret = retirementQualifiesNT(employee, trigger.terminationDate, extras);
      if (ret.qualifies) {
        const ruleKey =
          ret.source === 'override'
            ? 'accrual.7-to-10yr.retirement-qualifies-via-override'
            : 'accrual.7-to-10yr.retirement-qualifies-via-age-pension-age';
        citations.push(citation('NT LSL Act 1981 s.10(2)', ruleKey, NT_ACT_PAGE));
        let payable = sub(grossWeeks, priorLeaveTakenWeeks);
        if (payable.lt(0)) payable = new Decimal(0);
        return {
          grossWeeks,
          payableWeeks: payable,
          priorLeaveTakenWeeks,
          citations,
          payableIndicator: 'payable',
          retirementLookedUpAge: ret.lookedUpAge,
        };
      }
      // Retirement at 7-10 yrs, gate not satisfied (no dob + no override).
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
        retirementGateUnverified: ret.source === 'unverified',
      };
    }

    // Death at 7-10 yrs — s.10(3) cross-references s.10(2) per TBD-NT-06.
    // Death is auto-qualifying at this band; payable to personal rep.
    if (reason === 'death') {
      citations.push(
        citation(
          'NT LSL Act 1981 s.10(3)',
          'trigger.termination.death.7-to-10yr-cross-ref-s10-2',
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
        deathRoutingApplied: true,
      };
    }

    if (isQualifyingReason(reason)) {
      const ruleKey = `accrual.7-to-10yr.${reason}-qualifies` as const;
      citations.push(citation('NT LSL Act 1981 s.10(2)', ruleKey, NT_ACT_PAGE));
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
    // TBD-NT-04 RESOLVED (closed-list reading of s.10(2)).
    const isVoluntary = reason === 'voluntary_resignation';
    citations.push(
      citation(
        'NT LSL Act 1981 s.10(2)',
        'accrual.7-to-10yr.no-qualifying-reason-closed-list',
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
      ...(isVoluntary ? { voluntaryResignationSub10yrCliff: true } : {}),
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
  weeksAt10yr: NT_ACCRUAL_AT_10YR,
  fullQualifyingYears: NT_FULL_QUALIFYING_YEARS,
  prorataQualifyingYears: NT_PRORATA_QUALIFYING_YEARS,
};
