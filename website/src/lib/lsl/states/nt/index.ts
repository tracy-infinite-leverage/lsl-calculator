import { Decimal, d, displayAUD, displayWeeks, mul } from '@/lib/lsl/engine/decimal';
import type {
  Citation,
  Employee,
  Result,
  Trigger,
  Warning,
  ISODate,
} from '@/lib/lsl/engine/types';
import { classify } from '@/lib/lsl/engine/classifier';
import { prescribedDate } from '@/lib/lsl/engine/trigger';
import { inclusiveDays } from '@/lib/lsl/engine/dates';
import {
  CashOutNotSupportedError,
  JurisdictionBlockedError,
  NTCashOutForbiddenError,
} from '@/lib/lsl/engine/errors';
import { computeSystemFormula } from '@/lib/lsl/engine/system-formula';
import type { StateRuleSet } from '@/lib/lsl/states/StateRuleSet';
import { valueOfWeekNT, valueOfDayNT } from './rules/value-of-week';
import { accrualNT, ntAccrualConstants } from './rules/accrual-table';
import { triggerCitationsNT } from './rules/trigger-handlers';
import {
  computeNTContinuousService,
  workersCompOverlapsTriggerNT,
  type NTExtraInputs,
} from './continuous-service-rules';

export const NT_JURISDICTION = 'NT' as const;

/**
 * NT LSL orchestrator — T9.1 SCAFFOLD.
 *
 * Single rule set per the signed test-cases-nt.md v1.0 (PM-SIGNED 2026-05-27).
 * NT has no dated regime cliff (parallel to QLD / SA / ACT / TAS — NOT VIC /
 * WA pre-/post- pattern).
 *
 * T9.1 implements: NT-unique per-year `RP × HWW × 1.3` formula scaffold
 * (TBD-NT-01), Age-Pension-age retirement gate (TBD-NT-02), operator-flag
 * casual continuity (TBD-NT-03), voluntary-resignation 7-10 yr cliff
 * (TBD-NT-04), s.10(1A) complete-blocks-only misconduct (TBD-NT-05), death
 * routing across s.10(1)/(2)/(3) (TBD-NT-06), bonus-inclusion operator flag
 * (TBD-NT-07), cash-out hard-error per s.10(4) (TBD-NT-08), payable_by
 * omitted (TBD-NT-09), 52-wk variable-rate window (TBD-NT-10),
 * board/lodging operator-pre-strip (TBD-NT-11), 2-mo break tolerance + 12-mo
 * apprentice + slackness-no-length (TBD-NT-12), casual loading inclusion
 * advisory (TBD-NT-13), 12-mo apprentice (TBD-NT-14), related-corporation
 * aggregation (TBD-NT-15).
 *
 * PH-INCLUSIVE per s.9 (parallel to SA; opposite to NSW/VIC/QLD/WA/ACT/TAS).
 * Pay-on-termination "as soon as practicable" → `payable_by` omitted
 * (parallel to NSW "forthwith").
 *
 * Sources:
 *   - NT LSL Act 1981 ss.7, 8, 9, 10 (incl. s.10(1), s.10(1A), s.10(2),
 *     s.10(3), s.10(4)), 11 (incl. s.11(3)), 12 (incl. s.12(3), s.12(6)/(7),
 *     s.12(8)/(9))
 *   - APA LSL Masterclass — NT section
 *   - Cth Social Security Act 1991 s.23 (pension age lookup)
 *   - docs/qa/test-cases-nt.md v1.0 PM-signed 2026-05-27
 */

function checkJurisdiction(employee: Employee): { ok: boolean; warnings: Warning[] } {
  const warnings: Warning[] = [];
  const states = employee.statesOfService ?? [];
  const governing = employee.governingJurisdiction;

  if (states.length === 0) return { ok: true, warnings };

  if (states.length === 1) {
    if (states[0] === 'NT') return { ok: true, warnings };
    return {
      ok: false,
      warnings: [
        {
          code: 'cross_jurisdiction_pending',
          message: `Employee has worked only in ${states[0]}. Routed to NT by user nomination — but states-of-service is single-state. Resolve before computing.`,
        },
      ],
    };
  }

  if (!governing) {
    return {
      ok: false,
      warnings: [
        {
          code: 'cross_jurisdiction_pending',
          message: `Employee has worked in ${states.join(' and ')}. Please nominate the governing jurisdiction to proceed.`,
        },
      ],
    };
  }

  if (governing === 'NT') {
    const nonNt = states.filter((s) => s !== 'NT');
    if (nonNt.length > 0) {
      warnings.push({
        code: 'cross_jurisdiction_pending',
        message: `Employee has worked in ${states.join(' and ')}. The sufficiently connected test (legal judgement — see APA LSL Masterclass p.138) is for legal counsel where doubt exists. Engine has computed using user-nominated governing jurisdiction: NT.`,
      });
    }
    return { ok: true, warnings };
  }

  return {
    ok: false,
    warnings: [
      {
        code: 'cross_jurisdiction_pending',
        message: `Governing jurisdiction nominated as ${governing}. This calculation routed to NT but the governing state differs — resolve before computing.`,
      },
    ],
  };
}

export function calculateNT(employee: Employee, trigger: Trigger): Result {
  const result: Result = {
    employeeId: employee.id,
    status: 'computed',
    trigger,
    warnings: [],
  };

  // ── Cash-out hard error per s.10(4) (TBD-NT-08 RESOLVED Option (b)).
  if (trigger.kind === 'cash_out') {
    throw new NTCashOutForbiddenError();
  }

  // ── Jurisdiction gate.
  const jur = checkJurisdiction(employee);
  if (!jur.ok) {
    return {
      ...result,
      status: 'blocked_cross_jurisdiction',
      warnings: [...result.warnings, ...jur.warnings],
    };
  }
  result.warnings.push(...jur.warnings);

  // ── Termination requires endDate.
  if (trigger.kind === 'termination' && !employee.endDate) {
    throw new Error(
      'Termination trigger requires Employee.endDate to be set (or use trigger.terminationDate consistently).'
    );
  }

  const psd: ISODate = prescribedDate(trigger);

  const classifierResult = classify(employee);
  result.category = classifierResult.category;
  result.categoryAmbiguous = classifierResult.ambiguous;
  if (classifierResult.ambiguous) {
    result.warnings.push({
      code: 'classifier_ambiguous',
      message: `Pay-pattern classifier flagged borderline (signals: ${classifierResult.signals.join(', ')}). User should confirm category in single-mode UI.`,
    });
  }

  const ntExtras = (employee.extraInputs ?? {}) as NTExtraInputs;
  const service = computeNTContinuousService(
    employee.startDate,
    psd,
    employee.serviceEvents,
    employee.employmentType,
    ntExtras
  );
  result.warnings.push(...service.warnings);

  // ── Advance-leave refusal at sub-10-yr (NT Act has no advance-leave clause).
  //
  // Per the NT spec: taking_leave below 10 yrs returns $0 with advisory.
  // Wall-clock measurement (same pattern as TAS T8.3 reconciliation item 6)
  // so LWP/UPL service exclusions don't push back the entitlement date.
  const elapsedDaysFromStart = inclusiveDays(
    service.effectiveServiceStart,
    psd
  );
  const elapsedYearsFromStart = new Decimal(elapsedDaysFromStart).dividedBy(
    new Decimal('365.25')
  );
  if (
    trigger.kind === 'taking_leave' &&
    elapsedYearsFromStart.lt(ntAccrualConstants.fullQualifyingYears)
  ) {
    result.warnings.push({
      code: 'nt_advance_leave_not_permitted',
      message:
        'Taking LSL before the 10-year entitlement is NOT permitted under NT LSL Act 1981 — the Act contains no leave-in-advance provision. Engine refuses the leave-taking trigger and returns $0. To compute what the worker WOULD be entitled to at this tenure if terminated for a qualifying reason, change the trigger to "termination" with a qualifying reason; or use "as_at" for an accrual snapshot.',
    });
    const vow = valueOfWeekNT(employee, trigger, psd, service.effectiveServiceStart);
    const zero = new Decimal(0);
    const vowCitations = [...vow.citations, ...service.citations];
    const triggerCits = triggerCitationsNT(trigger);
    const weeksCitations = [...service.citations, ...triggerCits];
    const dollarsCitations = [...service.citations, ...vow.citations, ...triggerCits];
    result.outputs = {
      valueOfWeek: {
        value: vow.value,
        display: displayAUD(vow.value),
        citations: vowCitations,
      },
      valueOfDay: {
        value: valueOfDayNT(vow.value),
        display: displayAUD(valueOfDayNT(vow.value)),
        citations: vowCitations,
      },
      totalEntitlement: {
        weeks: {
          value: zero,
          display: displayWeeks(zero, 4),
          citations: weeksCitations,
        },
        dollars: {
          value: zero,
          display: displayAUD(zero),
          citations: dollarsCitations,
        },
      },
      systemFormula: computeSystemFormula(employee.currentWeeklyGross, zero, zero),
    };
    result.diagnostics = {
      yearsOfContinuousService: service.yearsOfContinuousService,
      daysOfContinuousService: service.daysOfContinuousService,
      daysNotCountedInService: service.daysNotCountedInService,
      daysNotCountedInLookback: { window12mo: 0, window5yr: 0 },
      weeklyAvg12mo: new Decimal(0),
      weeklyAvg5yr: new Decimal(0),
      payableIndicator: 'accrued_not_currently_payable',
      serviceStartUsed: service.effectiveServiceStart,
    };
    return result;
  }

  const vow = valueOfWeekNT(employee, trigger, psd, service.effectiveServiceStart);

  // ── Per-year formula advisory (TBD-NT-01).
  if (vow.path === 'per-year-formula') {
    result.warnings.push({
      code: 'nt_per_year_formula_applied',
      message:
        'Per-year `RP × HWW × 1.3` summation applied per NT LSL Act 1981 s.11(3) — NT UNIQUE. Each year of continuous service contributes RP × HWW_y × 1.3 from operator-supplied `extraInputs.nt_hours_per_week_by_year`.',
    });
  } else if (vow.perYearHistoryNotSupplied) {
    result.warnings.push({
      code: 'nt_hours_per_year_history_not_supplied',
      message:
        'Operator did not supply `extraInputs.nt_hours_per_week_by_year`. Engine fell back to single-year flat path using `currentWeeklyGross`. NT s.11(3) requires per-year hours history — if hours have varied across years of service this may produce a different total than the NT-unique per-year formula.',
    });
  }

  // ── Variable-rate 52-wk advisory (TBD-NT-10).
  if (vow.path === 'variable-rate-52wk') {
    result.warnings.push({
      code: 'nt_variable_rate_52wk_lookback_applied',
      message:
        'Variable-rate income averaged over 52 weeks (364 days) immediately preceding the trigger date per NT LSL Act 1981 s.11 rate-varies branch. Cross-state parallel to NSW/QLD/SA/ACT.',
    });
  }

  // ── Bonus operator-flag advisory (TBD-NT-07).
  if (ntExtras.nt_bonus_usually_paid_with_pay === true) {
    result.warnings.push({
      code: 'nt_bonus_usually_paid_with_pay_included',
      message:
        'Bonus payments included in ordinary pay per NT LSL Act 1981 s.7(2)(b) — NT has the BROADEST bonus-inclusion rule of any Australian state. Operator confirmed via `extraInputs.nt_bonus_usually_paid_with_pay: true`. Engine treats `currentWeeklyGross` as already including the "usually paid with pay" bonus component.',
    });
  } else {
    result.warnings.push({
      code: 'nt_bonus_usually_paid_with_pay_excluded',
      message:
        'Bonus payments excluded from ordinary pay — operator did not confirm s.7(2)(b) "usually paid with pay" inclusion via `extraInputs.nt_bonus_usually_paid_with_pay`. Engine treated bonus as excluded by default (conservative). If bonuses are usually paid with pay, set the flag to `true` to include them.',
    });
  }

  // ── Casual loading inclusion advisory (TBD-NT-13).
  if (employee.employmentType === 'casual') {
    result.warnings.push({
      code: 'nt_casual_loading_assumed_included_in_hourly_rate',
      message:
        'NT LSL Act 1981 is silent on casual loading; universal cross-state practice is to include it. Engine treats `currentHourlyRate` / `currentWeeklyGross` for casual workers as already including the casual loading (operator pre-loads).',
    });
  }

  // ── PH-INCLUSIVE advisory (s.9) — informational signal.
  if (trigger.kind === 'taking_leave') {
    result.warnings.push({
      code: 'nt_ph_inclusive_in_lsl',
      message:
        'Public holidays falling within an LSL period are part of LSL under NT LSL Act 1981 s.9 — the LSL period is NOT extended. NT is PH-INCLUSIVE (parallel to SA; OPPOSITE to NSW/VIC/QLD/WA/ACT/TAS which extend LSL across PHs).',
    });
  }

  const priorTaken = employee.priorLeaveTakenWeeks
    ? d(employee.priorLeaveTakenWeeks)
    : new Decimal(0);
  const accrual = accrualNT(
    service.yearsOfContinuousService,
    employee,
    trigger,
    priorTaken
  );
  result.warnings.push(...accrual.citations.length ? [] : []); // no-op; citations folded below

  // ── Retirement gate advisories (TBD-NT-02).
  if (trigger.kind === 'termination' && trigger.reason === 'retirement') {
    if (accrual.retirementLookedUpAge !== undefined) {
      result.warnings.push({
        code: 'nt_retirement_qualifying_age_pension_age',
        message:
          'NT LSL Act 1981 s.10(2) retirement gate uses Age Pension age per Cth Social Security Act 1991 s.23. Engine applied this reading via employee.dob lookup.',
      });
      result.warnings.push({
        code: 'nt_retirement_age_lookup_year_used',
        message: `Cth Age Pension age year-of-birth lookup applied. Engine value: ${accrual.retirementLookedUpAge}.`,
      });
    }
    if (accrual.retirementGateUnverified) {
      result.warnings.push({
        code: 'nt_retirement_gate_unverified',
        message:
          'Operator did not supply `employee.dob` AND did not set `extraInputs.nt_age_pension_age_at_termination_reached`. NT LSL Act 1981 s.10(2)(a) retirement-age gate cannot be evaluated — engine treats retirement as NOT qualifying for pro-rata at this tenure.',
      });
    }
  }

  // ── Sub-7 / sub-10 / 10+ misconduct / death indicator warnings.
  if (accrual.sub7YrNoEntitlement) {
    result.warnings.push({
      code: 'sub_7yr_no_entitlement_nt',
      message:
        'Below 7-year pro-rata threshold under NT LSL Act 1981 s.10(2). No entitlement at this tenure.',
    });
  }
  if (accrual.sub10YrNoQualifyingReason) {
    result.warnings.push({
      code: 'sub_10yr_no_qualifying_reason_nt',
      message:
        '7-to-10 yr tenure but termination reason does not qualify under NT LSL Act 1981 s.10(2) (closed-list — retirement / employer-not-misconduct / illness / domestic-pressing-necessity). $0 payable.',
    });
  }
  if (accrual.voluntaryResignationSub10yrCliff) {
    result.warnings.push({
      code: 'nt_voluntary_resignation_sub_10yr_cliff',
      message:
        'Voluntary resignation at 7–10 yrs is NOT a qualifying reason under NT s.10(2) (closed list). Binary 10-yr cliff applies per TBD-NT-04 RESOLVED — $0 payable below 10 yrs voluntary res; full payout at 10+ yrs.',
    });
  }
  if (accrual.sub10YrMisconductExcluded) {
    result.warnings.push({
      code: 'sub_10yr_misconduct_excluded_nt',
      message:
        'Serious & wilful misconduct dismissal sub-10-yr — pro-rata forfeited under NT LSL Act 1981 s.10(2).',
    });
  }
  if (accrual.tenYrPlusMisconductCompleteBlocksOnly) {
    result.warnings.push({
      code: 'nt_10yr_plus_misconduct_complete_blocks_only',
      message: `Dismissal for serious & wilful misconduct at 10+ yrs — NT LSL Act 1981 s.10(1A) limits payout to complete 10y/15y blocks only. Engine truncated to ${accrual.misconductBlockYears} years (= ${new Decimal(accrual.misconductBlockYears ?? 0).times('1.3').toFixed(4)} wks). NT-UNIQUE: different from NSW/VIC/QLD/SA/ACT/TAS (full payout) and from WA (5-yr-block partial-forfeiture).`,
    });
  }
  if (accrual.deathSub7yrNoEntitlement) {
    result.warnings.push({
      code: 'nt_death_sub_7yr_no_entitlement',
      message:
        'Death at sub-7-yr tenure: $0 entitlement under NT LSL Act 1981 s.10(3) (which cross-references s.10(1) and s.10(2)). Sub-7-yr deaths do not qualify under either band.',
    });
  }
  if (accrual.deathRoutingApplied) {
    result.warnings.push({
      code: 'nt_death_payable_to_personal_representative',
      message:
        'Death-on-employment entitlement payable to the personal representative of the deceased per NT LSL Act 1981 s.10(3). Engine reads "this section" in s.10(3) as the whole of s.10 — death at ≥ 7 yrs auto-qualifies for pro-rata (s.10(2)) or full payout (s.10(1)).',
    });
  }

  // ── WC overlap at trigger date — defensive (NT excludes WC, case rare).
  const triggerDate: ISODate =
    trigger.kind === 'termination'
      ? trigger.terminationDate
      : trigger.kind === 'as_at'
        ? trigger.asAtDate
        : trigger.kind === 'taking_leave'
          ? trigger.leaveStartDate
          : (trigger as { cashOutDate: ISODate }).cashOutDate;
  if (workersCompOverlapsTriggerNT(employee.serviceEvents, triggerDate)) {
    result.warnings.push({
      code: 'nt_lsl_calculated_at_wc_reduced_rate_warning',
      message:
        'LSL trigger date overlaps a workers-comp absence. NT LSL Act 1981 s.12 excludes WC from continuous service — case rarely arises in practice. Advisory emitted defensively for operator review.',
    });
  }

  // ── Pay-on-termination: payable_by OMITTED per TBD-NT-09 RESOLVED Option (b).
  if (trigger.kind === 'termination') {
    // Intentionally do NOT set `result.payable_by` — NT Act says "as soon as
    // practicable" without a fixed window (parallel to NSW "forthwith").
    result.warnings.push({
      code: 'nt_payable_as_soon_as_practicable_advisory',
      message:
        'NT LSL Act 1981 s.10 directs the payout "as soon as practicable" after cessation — no fixed statutory window. Engine omits the `payable_by` field. Consult NT Fair Work / NT Department of the Attorney-General for jurisdiction-specific guidance on the operational deadline.',
    });
  }

  const triggerCits = triggerCitationsNT(trigger);

  // ── Compute final outputs.
  // For the per-year formula path, `vow.value` IS the total dollar entitlement
  // (aggregate across years). For all other paths, `vow.value` is the weekly
  // value × accrual.payableWeeks.
  let valueOfWeekFinal: Decimal;
  let totalDollars: Decimal;
  if (vow.path === 'per-year-formula') {
    // The per-year aggregate IS the payout. Derive a notional weekly figure
    // for backward-compat display by dividing by accrual.payableWeeks (if > 0)
    // — otherwise fall back to currentWeeklyGross.
    totalDollars = vow.value;
    if (accrual.payableWeeks.gt(0)) {
      valueOfWeekFinal = totalDollars.dividedBy(accrual.payableWeeks);
    } else {
      valueOfWeekFinal = d(employee.currentWeeklyGross);
    }
  } else {
    valueOfWeekFinal = vow.value;
    totalDollars = mul(valueOfWeekFinal, accrual.payableWeeks);
  }
  const valueOfDay = valueOfDayNT(valueOfWeekFinal);

  const vowCitations: Citation[] = [...vow.citations, ...service.citations];
  const vodCitations: Citation[] = [...vow.citations, ...service.citations];
  const weeksCitations: Citation[] = [
    ...service.citations,
    ...accrual.citations,
    ...triggerCits,
  ];
  const dollarsCitations: Citation[] = [
    ...service.citations,
    ...vow.citations,
    ...accrual.citations,
    ...triggerCits,
  ];

  const sf = computeSystemFormula(
    employee.currentWeeklyGross,
    accrual.payableWeeks,
    totalDollars
  );

  if (
    accrual.payableIndicator === 'accrued_not_currently_payable' &&
    trigger.kind === 'as_at'
  ) {
    result.warnings.push({
      code: 'accrued_not_currently_payable',
      message:
        'Below 7-year pro-rata threshold. Entitlement is accruing but no cash payment is currently triggerable under NT LSL Act 1981 s.10.',
    });
  }

  result.outputs = {
    valueOfWeek: {
      value: valueOfWeekFinal,
      display: displayAUD(valueOfWeekFinal),
      citations: vowCitations,
    },
    valueOfDay: {
      value: valueOfDay,
      display: displayAUD(valueOfDay),
      citations: vodCitations,
    },
    totalEntitlement: {
      weeks: {
        value: accrual.payableWeeks,
        display: displayWeeks(accrual.payableWeeks, 4),
        citations: weeksCitations,
      },
      dollars: {
        value: totalDollars,
        display: displayAUD(totalDollars),
        citations: dollarsCitations,
      },
    },
    systemFormula: sf,
  };

  result.diagnostics = {
    yearsOfContinuousService: service.yearsOfContinuousService,
    daysOfContinuousService: service.daysOfContinuousService,
    daysNotCountedInService: service.daysNotCountedInService,
    daysNotCountedInLookback: { window12mo: 0, window5yr: 0 },
    weeklyAvg12mo: new Decimal(0),
    weeklyAvg5yr: new Decimal(0),
    payableIndicator: accrual.payableIndicator,
    serviceStartUsed: service.effectiveServiceStart,
  };

  return result;
}

export function calculateNTSafe(employee: Employee, trigger: Trigger): Result {
  try {
    return calculateNT(employee, trigger);
  } catch (err) {
    if (err instanceof JurisdictionBlockedError) {
      return {
        employeeId: employee.id,
        status: 'blocked_cross_jurisdiction',
        trigger,
        warnings: [
          {
            code: 'cross_jurisdiction_pending',
            message: err.userMessage,
          },
        ],
      };
    }
    if (err instanceof NTCashOutForbiddenError) {
      return {
        employeeId: employee.id,
        status: 'failed',
        trigger,
        warnings: [],
        error: { code: err.code, userMessage: err.userMessage },
      };
    }
    if (err instanceof CashOutNotSupportedError) {
      return {
        employeeId: employee.id,
        status: 'failed',
        trigger,
        warnings: [],
        error: { code: err.code, userMessage: err.userMessage },
      };
    }
    const code = err instanceof Error ? err.name : 'unknown_error';
    const userMessage =
      err instanceof Error
        ? err.message
        : 'An unknown error occurred during calculation.';
    return {
      employeeId: employee.id,
      status: 'failed',
      trigger,
      warnings: [],
      error: { code, userMessage },
    };
  }
}

export const NT_RULE_SET: StateRuleSet = {
  state: 'NT',
  calculate: calculateNT,
  calculateSafe: calculateNTSafe,
};
