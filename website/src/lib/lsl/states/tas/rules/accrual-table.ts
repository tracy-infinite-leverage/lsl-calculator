import { Decimal, mul, sub } from '@/lib/lsl/engine/decimal';
import { citation } from '@/lib/lsl/engine/citation';
import type { Citation, Employee, Trigger } from '@/lib/lsl/engine/types';
import type { TASExtraInputs } from '../extra-inputs';

/**
 * TAS LSL Act 1976 s.8 accrual — T8.1 SCAFFOLD.
 *
 * Numerical accrual: 8.6667 weeks at 10 years of continuous service per
 * s.8(2). Continuous at 0.8667 wks/yr thereafter (= `Years × 8.6667 / 10`) —
 * same accrual ratio as NSW/QLD/WA/ACT but applied at the 10-year first-
 * entitlement date (vs ACT 7 yrs / SA 13 wks).
 *
 * Pro-rata at termination (s.8(3) — 7–10 yr band):
 *   - Qualifying reasons: illness_incapacity, domestic_pressing_necessity,
 *     death, employer_initiated_not_misconduct, redundancy, retirement
 *     (60F/65M default OR award-min via override).
 *   - voluntary_resignation 7–10 yrs: NOT qualifying — binary 10-yr cliff per
 *     TBD-TAS-07 RESOLVED.
 *   - serious_misconduct sub-10-yr: pro-rata forfeited.
 *   - Sub-7-yr: zero entitlement.
 *
 * 10+ yr full payout (s.8(2)):
 *   - ANY reason qualifies — including serious_misconduct. Per TBD-TAS-06
 *     RESOLVED, TAS mirrors NSW/VIC/QLD/SA/ACT FULL payout pattern (NOT WA
 *     partial-forfeiture). The misconduct exception in s.8(3) carves out the
 *     pro-rata branch only.
 *
 * Advance leave (taking_leave sub-10-yr):
 *   - NOT PERMITTED — the TAS Act contains no advance-leave clause. Engine
 *     returns $0 with `tas_advance_leave_not_permitted` advisory and runs the
 *     accrual snapshot. Real handling lives in the orchestrator; this module
 *     just emits zero payable weeks. (Implementation completes in T8.2.)
 *
 * As-at trigger bypasses qualifying-reason gates per E1 spec D20.
 *
 * Sources:
 *   - TAS LSL Act 1976 s.8(2), s.8(3)
 *   - WorkSafe Tasmania — LSL guidance material
 *   - APA LSL Masterclass PDF pp.95-108
 *   - docs/qa/test-cases-tas.md v1.0 PM-signed 2026-05-26
 */

const TAS_ACCRUAL_PER_YEAR = new Decimal('8.6667').dividedBy(10);
const TAS_FULL_QUALIFYING_YEARS = new Decimal('10.0000');
const TAS_PRORATA_QUALIFYING_YEARS = new Decimal('7.0000');

type QualifyingReason =
  | 'illness_incapacity'
  | 'domestic_pressing_necessity'
  | 'death'
  | 'redundancy'
  | 'employer_initiated_not_misconduct';

const QUALIFYING_REASONS: ReadonlySet<QualifyingReason> = new Set([
  'illness_incapacity',
  'domestic_pressing_necessity',
  'death',
  'redundancy',
  'employer_initiated_not_misconduct',
]);

function isQualifyingReason(reason: string): reason is QualifyingReason {
  return (QUALIFYING_REASONS as ReadonlySet<string>).has(reason);
}

/**
 * Retirement qualifies if:
 *   (a) `extraInputs.tas_award_min_retirement_age_reached === true` — operator
 *       attests the award/agreement minimum-retirement-age was reached
 *       (TBD-TAS-02 RESOLVED Option (a) override path); OR
 *   (b) `employee.sex` is set AND, at the trigger date, the employee meets the
 *       s.8(3) literal sex-specific default (60 women / 65 men).
 *
 * Per TBD-TAS-02 RESOLVED: the s.8(3) reading IS sex-specific; the calculator
 * applies the literal text and surfaces the
 * `tas_retirement_qualifying_age_60f_65m_default` advisory so operators see
 * the assumption and can override via the award-min flag.
 */
function retirementQualifiesTAS(
  employee: Employee,
  triggerDate: string,
  extras: TASExtraInputs
): boolean {
  if (extras.tas_award_min_retirement_age_reached === true) return true;
  if (!employee.sex || !employee.dob) return false;

  const dob = employee.dob;
  const dobY = Number(dob.slice(0, 4));
  const dobM = Number(dob.slice(5, 7));
  const dobD = Number(dob.slice(8, 10));
  const trY = Number(triggerDate.slice(0, 4));
  const trM = Number(triggerDate.slice(5, 7));
  const trD = Number(triggerDate.slice(8, 10));
  let age = trY - dobY;
  if (trM < dobM || (trM === dobM && trD < dobD)) age -= 1;

  const threshold = employee.sex === 'female' ? 60 : 65;
  return age >= threshold;
}

export interface TASAccrualResult {
  grossWeeks: Decimal;
  payableWeeks: Decimal;
  priorLeaveTakenWeeks: Decimal;
  citations: Citation[];
  payableIndicator: 'payable' | 'accrued_not_currently_payable';
  sub7YrNoEntitlement?: boolean;
  sub10YrNoQualifyingReason?: boolean;
  sub10YrMisconductExcluded?: boolean;
  tenYrPlusMisconductFullPayout?: boolean;
  retirementDefaultAgeApplied?: boolean;
}

export function accrualTAS(
  yearsOfService: Decimal,
  employee: Employee,
  trigger: Trigger,
  priorLeaveTakenWeeks: Decimal = new Decimal(0)
): TASAccrualResult {
  const citations: Citation[] = [];
  const grossWeeks = mul(yearsOfService, TAS_ACCRUAL_PER_YEAR);
  const extras = (employee.extraInputs ?? {}) as TASExtraInputs;

  // ── as_at snapshot — E1 spec D20 bypass.
  if (trigger.kind === 'as_at') {
    citations.push(
      citation(
        'TAS LSL Act 1976 s.8',
        'accrual.snapshot.no-qualifying-reason-threshold',
        96,
        'as-at snapshot per E1 spec D20 — qualifying-period threshold NOT applied'
      )
    );
    let payable = sub(grossWeeks, priorLeaveTakenWeeks);
    if (payable.lt(0)) payable = new Decimal(0);
    const payableIndicator: 'payable' | 'accrued_not_currently_payable' =
      yearsOfService.lt(TAS_PRORATA_QUALIFYING_YEARS)
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
  if (yearsOfService.lt(TAS_PRORATA_QUALIFYING_YEARS)) {
    citations.push(
      citation('TAS LSL Act 1976 s.8(3)', 'accrual.sub-7yr-no-entitlement', 97)
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

  // ── 10+ yr full-payout branch — ANY reason qualifies (incl. misconduct).
  if (yearsOfService.gte(TAS_FULL_QUALIFYING_YEARS)) {
    let tenYrPlusMisconductFullPayout = false;

    citations.push(
      citation(
        'TAS LSL Act 1976 s.8(2)',
        'accrual.qualifying-period-10yr-8.6667wks',
        96
      )
    );
    citations.push(
      citation(
        'TAS LSL Act 1976 s.8(2)',
        'accrual.continuous-0.8667-per-year',
        96
      )
    );

    if (
      trigger.kind === 'termination' &&
      trigger.reason === 'serious_misconduct'
    ) {
      citations.push(
        citation(
          'TAS LSL Act 1976 s.8(2)',
          'accrual.10yr-full-entitlement-regardless-of-reason',
          96
        )
      );
      tenYrPlusMisconductFullPayout = true;
    } else if (trigger.kind === 'termination' && trigger.reason === 'death') {
      citations.push(
        citation('TAS LSL Act 1976 s.8(3)', 'trigger.termination.death', 97)
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
      tenYrPlusMisconductFullPayout,
    };
  }

  // ── 7–10 yr pro-rata branch — qualifying-reason gate.
  if (trigger.kind === 'taking_leave' || trigger.kind === 'cash_out') {
    // Pro-rata 7–10 yr CAN be informationally surfaced as accrued for taking-
    // leave / cash-out workflows. Real handling (advance-leave refusal, cash-
    // out gating) lives in the orchestrator.
    citations.push(
      citation(
        'TAS LSL Act 1976 s.8(3)',
        'accrual.7-to-10yr.pro-rata-informational',
        97
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
          'TAS LSL Act 1976 s.8(3)',
          'accrual.7-to-10yr.serious-misconduct-excluded',
          97
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
      const qualifies = retirementQualifiesTAS(
        employee,
        trigger.terminationDate,
        extras
      );
      if (qualifies) {
        const ruleKey =
          extras.tas_award_min_retirement_age_reached === true
            ? 'accrual.7-to-10yr.retirement-qualifies-via-award-min'
            : 'accrual.7-to-10yr.retirement-qualifies-via-60f-65m';
        citations.push(citation('TAS LSL Act 1976 s.8(3)', ruleKey, 97));
        let payable = sub(grossWeeks, priorLeaveTakenWeeks);
        if (payable.lt(0)) payable = new Decimal(0);
        return {
          grossWeeks,
          payableWeeks: payable,
          priorLeaveTakenWeeks,
          citations,
          payableIndicator: 'payable',
          retirementDefaultAgeApplied:
            extras.tas_award_min_retirement_age_reached !== true,
        };
      }
      citations.push(
        citation(
          'TAS LSL Act 1976 s.8(3)',
          'accrual.7-to-10yr.retirement-no-qualifying-signal',
          97
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
      citations.push(citation('TAS LSL Act 1976 s.8(3)', ruleKey, 97));
      if (reason === 'death') {
        citations.push(
          citation('TAS LSL Act 1976 s.8(3)', 'trigger.termination.death', 97)
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
    // TBD-TAS-07 RESOLVED.
    citations.push(
      citation(
        'TAS LSL Act 1976 s.8(3)',
        'accrual.7-to-10yr.no-qualifying-reason',
        97
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

export const tasAccrualConstants = {
  perYearWeeks: TAS_ACCRUAL_PER_YEAR,
  fullQualifyingYears: TAS_FULL_QUALIFYING_YEARS,
  prorataQualifyingYears: TAS_PRORATA_QUALIFYING_YEARS,
};
