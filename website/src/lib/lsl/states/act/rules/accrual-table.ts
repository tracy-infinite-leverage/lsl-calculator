import { Decimal, mul, sub } from '@/lib/lsl/engine/decimal';
import { citation } from '@/lib/lsl/engine/citation';
import type { Citation, Employee, Trigger } from '@/lib/lsl/engine/types';
import type { ACTExtraInputs } from '../extra-inputs';

/**
 * ACT LSL Act 1976 s.3, s.4, s.11C accrual.
 *
 * Numerical accrual: 6.0667 weeks at 7 years of continuous employment;
 * continuous at 0.8667 wks/yr (= 1/5 month/yr) thereafter — NO discrete step
 * at any later milestone. Past year 10 the formula is equivalent to
 * `Years × (8.6667 / 10)` — same ratio as NSW/QLD/WA/TAS first-entitlement.
 *
 * Pro-rata at termination (s.11C):
 *   - 5+ to <7 yrs: pro-rata payable ONLY for qualifying reasons —
 *     illness_incapacity, domestic_pressing_necessity, retirement
 *     (award/agreement OR age 65), death, employer_initiated_not_misconduct,
 *     redundancy, unfair_dismissal.
 *     voluntary_resignation and poor_performance NOT qualifying.
 *     serious_misconduct forfeits all pro-rata.
 *   - Sub-5-yr: zero entitlement under any reason — universal floor (LOWEST
 *     in Australia).
 *
 * 7+ yr full payout (s.4):
 *   - ANY reason qualifies — including serious_misconduct. ACT does NOT
 *     mirror WA s.8(3) partial-forfeiture; the s.11C misconduct exception
 *     applies only to the pro-rata branch.
 *
 * As-at trigger bypasses qualifying-reason gates per E1 spec D20.
 *
 * Sources:
 *   - ACT LSL Act 1976 s.3, s.4, s.11C
 *   - WorkSafe ACT — LSL guidance material
 *   - APA LSL Masterclass PDF pp.109-123
 *   - docs/qa/test-cases-act.md v1.0 PM-signed 2026-05-26
 */

const ACT_ACCRUAL_PER_YEAR = new Decimal('8.6667').dividedBy(10);
const ACT_FULL_QUALIFYING_YEARS = new Decimal('7.0000');
const ACT_PRORATA_QUALIFYING_YEARS = new Decimal('5.0000');

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
  'unfair_dismissal',
]);

function isQualifyingReason(reason: string): reason is QualifyingReason {
  return (QUALIFYING_REASONS as ReadonlySet<string>).has(reason);
}

function retirementQualifies(
  employee: Employee,
  triggerDate: string,
  extras: ACTExtraInputs
): boolean {
  if (extras.act_award_min_retirement_age_reached === true) return true;
  if (employee.dob) {
    const dob = employee.dob;
    const dobY = Number(dob.slice(0, 4));
    const dobM = Number(dob.slice(5, 7));
    const dobD = Number(dob.slice(8, 10));
    const trY = Number(triggerDate.slice(0, 4));
    const trM = Number(triggerDate.slice(5, 7));
    const trD = Number(triggerDate.slice(8, 10));
    let age = trY - dobY;
    if (trM < dobM || (trM === dobM && trD < dobD)) age -= 1;
    if (age >= 65) return true;
  }
  return false;
}

export interface ACTAccrualResult {
  grossWeeks: Decimal;
  payableWeeks: Decimal;
  priorLeaveTakenWeeks: Decimal;
  citations: Citation[];
  payableIndicator: 'payable' | 'accrued_not_currently_payable';
  sub5YrNoEntitlement?: boolean;
  sub7YrNoQualifyingReason?: boolean;
  sub7YrMisconductExcluded?: boolean;
  sevenYrPlusMisconductFullPayout?: boolean;
}

export function accrualACT(
  yearsOfService: Decimal,
  employee: Employee,
  trigger: Trigger,
  priorLeaveTakenWeeks: Decimal = new Decimal(0)
): ACTAccrualResult {
  const citations: Citation[] = [];
  const grossWeeks = mul(yearsOfService, ACT_ACCRUAL_PER_YEAR);
  const extras = (employee.extraInputs ?? {}) as ACTExtraInputs;

  if (trigger.kind === 'as_at') {
    citations.push(
      citation(
        'ACT LSL Act 1976 s.4',
        'accrual.snapshot.no-qualifying-reason-threshold',
        114,
        'as-at snapshot per E1 spec D20 — qualifying-period threshold NOT applied'
      )
    );
    let payable = sub(grossWeeks, priorLeaveTakenWeeks);
    if (payable.lt(0)) payable = new Decimal(0);
    const payableIndicator: 'payable' | 'accrued_not_currently_payable' =
      yearsOfService.lt(ACT_PRORATA_QUALIFYING_YEARS)
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

  if (yearsOfService.lt(ACT_PRORATA_QUALIFYING_YEARS)) {
    citations.push(
      citation('ACT LSL Act 1976 s.11C', 'accrual.sub-5yr-no-entitlement', 111)
    );
    return {
      grossWeeks,
      payableWeeks: new Decimal(0),
      priorLeaveTakenWeeks,
      citations,
      payableIndicator: 'accrued_not_currently_payable',
      sub5YrNoEntitlement: true,
    };
  }

  if (yearsOfService.gte(ACT_FULL_QUALIFYING_YEARS)) {
    let sevenYrPlusMisconductFullPayout = false;

    citations.push(
      citation(
        'ACT LSL Act 1976 s.4',
        'accrual.qualifying-period-7yr-6.0667wks',
        110
      )
    );
    citations.push(
      citation(
        'ACT LSL Act 1976 s.4',
        'accrual.continuous-0.8667-per-year',
        114
      )
    );

    if (
      trigger.kind === 'termination' &&
      trigger.reason === 'serious_misconduct'
    ) {
      citations.push(
        citation(
          'ACT LSL Act 1976 s.4',
          'accrual.7yr-full-entitlement-regardless-of-reason',
          110
        )
      );
      sevenYrPlusMisconductFullPayout = true;
    } else if (trigger.kind === 'termination' && trigger.reason === 'death') {
      citations.push(
        citation(
          'ACT LSL Act 1976 s.11C',
          'trigger.termination.death',
          118
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
      sevenYrPlusMisconductFullPayout,
    };
  }

  if (trigger.kind === 'taking_leave' || trigger.kind === 'cash_out') {
    citations.push(
      citation(
        'ACT LSL Act 1976 s.11C',
        'accrual.5-to-7yr.pro-rata-informational',
        111
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
          'ACT LSL Act 1976 s.11C',
          'accrual.5-to-7yr.serious-misconduct-excluded',
          111
        )
      );
      return {
        grossWeeks,
        payableWeeks: new Decimal(0),
        priorLeaveTakenWeeks,
        citations,
        payableIndicator: 'accrued_not_currently_payable',
        sub7YrMisconductExcluded: true,
      };
    }

    if (reason === 'retirement') {
      const qualifies = retirementQualifies(
        employee,
        trigger.terminationDate,
        extras
      );
      if (qualifies) {
        citations.push(
          citation(
            'ACT LSL Act 1976 s.11C',
            'accrual.5-to-7yr.retirement-qualifies',
            111
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
      citations.push(
        citation(
          'ACT LSL Act 1976 s.11C',
          'accrual.5-to-7yr.retirement-no-qualifying-signal',
          111
        )
      );
      return {
        grossWeeks,
        payableWeeks: new Decimal(0),
        priorLeaveTakenWeeks,
        citations,
        payableIndicator: 'accrued_not_currently_payable',
        sub7YrNoQualifyingReason: true,
      };
    }

    if (isQualifyingReason(reason)) {
      const ruleKey = `accrual.5-to-7yr.${reason}-qualifies` as const;
      citations.push(
        citation('ACT LSL Act 1976 s.11C', ruleKey, 111)
      );
      if (reason === 'death') {
        citations.push(
          citation(
            'ACT LSL Act 1976 s.11C',
            'trigger.termination.death',
            118
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

    citations.push(
      citation(
        'ACT LSL Act 1976 s.11C',
        'accrual.5-to-7yr.no-qualifying-reason',
        111
      )
    );
    return {
      grossWeeks,
      payableWeeks: new Decimal(0),
      priorLeaveTakenWeeks,
      citations,
      payableIndicator: 'accrued_not_currently_payable',
      sub7YrNoQualifyingReason: true,
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

export const actAccrualConstants = {
  perYearWeeks: ACT_ACCRUAL_PER_YEAR,
  fullQualifyingYears: ACT_FULL_QUALIFYING_YEARS,
  prorataQualifyingYears: ACT_PRORATA_QUALIFYING_YEARS,
};
