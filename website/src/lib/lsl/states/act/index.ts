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
import {
  CashOutNotSupportedError,
  JurisdictionBlockedError,
} from '@/lib/lsl/engine/errors';
import { computeSystemFormula } from '@/lib/lsl/engine/system-formula';
import type { StateRuleSet } from '@/lib/lsl/states/StateRuleSet';
import { valueOfWeekACT, valueOfDayACT } from './rules/value-of-week';
import { accrualACT, actAccrualConstants } from './rules/accrual-table';
import {
  triggerCitationsACT,
  payableByDate,
} from './rules/trigger-handlers';
import {
  computeACTContinuousService,
  workersCompOverlapsTriggerACT,
  type ACTExtraInputs,
} from './continuous-service-rules';

export const ACT_JURISDICTION = 'ACT' as const;

/**
 * ACT LSL orchestrator — implements the TBD-ACT-01 RESOLVED single-rule-set
 * pattern with WC date-aware override at 9 June 2023 (parallel to WA's
 * 2024-07-01 architecture).
 *
 * Sources:
 *   - ACT LSL Act 1976 ss.2F, 2G, 3, 4, 6, 7, 8(c), 9, 10, 10A, 11A(4)(b),
 *     11C, 11D
 *   - WC Act 1951 (ACT) s.46 — amended 9 June 2023
 *   - Public Holidays Act 1958 (ACT)
 *   - WorkSafe ACT guidance + APA LSL Masterclass pp.109-123
 *   - docs/qa/test-cases-act.md v1.0 PM-signed 2026-05-26
 */

function checkJurisdiction(employee: Employee): { ok: boolean; warnings: Warning[] } {
  const warnings: Warning[] = [];
  const states = employee.statesOfService ?? [];
  const governing = employee.governingJurisdiction;

  if (states.length === 0) return { ok: true, warnings };

  if (states.length === 1) {
    if (states[0] === 'ACT') return { ok: true, warnings };
    return {
      ok: false,
      warnings: [
        {
          code: 'cross_jurisdiction_pending',
          message: `Employee has worked only in ${states[0]}. Routed to ACT by user nomination — but states-of-service is single-state. Resolve before computing.`,
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

  if (governing === 'ACT') {
    const nonAct = states.filter((s) => s !== 'ACT');
    if (nonAct.length > 0) {
      warnings.push({
        code: 'cross_jurisdiction_pending',
        message: `Employee has worked in ${states.join(' and ')}. The sufficiently connected test (legal judgement — see APA LSL Masterclass p.138) is for legal counsel where doubt exists. Engine has computed using user-nominated governing jurisdiction: ACT.`,
      });
    }
    return { ok: true, warnings };
  }

  return {
    ok: false,
    warnings: [
      {
        code: 'cross_jurisdiction_pending',
        message: `Governing jurisdiction nominated as ${governing}. This calculation routed to ACT but the governing state differs — resolve before computing.`,
      },
    ],
  };
}

function notesContainBonusTokens(employee: Employee): boolean {
  const TOKENS = ['bonus', 'incentive', 'back-pay', 'back pay', 'retrospective'];
  for (const p of employee.wageHistory) {
    if (!p.note) continue;
    const lower = p.note.toLowerCase();
    if (TOKENS.some((t) => lower.includes(t))) return true;
  }
  for (const e of employee.serviceEvents) {
    if (!e.note) continue;
    const lower = e.note.toLowerCase();
    if (TOKENS.some((t) => lower.includes(t))) return true;
  }
  return false;
}

export function calculateACT(employee: Employee, trigger: Trigger): Result {
  const result: Result = {
    employeeId: employee.id,
    status: 'computed',
    trigger,
    warnings: [],
  };

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

  if (notesContainBonusTokens(employee)) {
    result.warnings.push({
      code: 'bonus_in_notes_v1_out_of_scope',
      message:
        'Wage history notes mention bonus / incentive / back-pay / retrospective. Bonus inclusion / retrospective adjustments are out of v1 scope. Calculation runs on the user-provided gross.',
    });
  }

  const psd: ISODate =
    trigger.kind === 'cash_out' ? trigger.cashOutDate : prescribedDate(trigger);

  const classifierResult = classify(employee);
  result.category = classifierResult.category;
  result.categoryAmbiguous = classifierResult.ambiguous;
  if (classifierResult.ambiguous) {
    result.warnings.push({
      code: 'classifier_ambiguous',
      message: `Pay-pattern classifier flagged borderline (signals: ${classifierResult.signals.join(', ')}). User should confirm category in single-mode UI.`,
    });
  }

  const actExtras = (employee.extraInputs ?? {}) as ACTExtraInputs;
  const service = computeACTContinuousService(
    employee.startDate,
    psd,
    employee.serviceEvents,
    employee.employmentType,
    actExtras
  );
  result.warnings.push(...service.warnings);

  if (service.workersCompRegimeSplitApplied) {
    result.warnings.push({
      code: 'act_workers_comp_regime_split_applied',
      message:
        'Workers compensation absence straddles 9 June 2023. Pre-cutoff portion capped per ACT LSL Act 1976 s.2G; post-cutoff portion counts in full per WC Act 1951 (ACT) s.46 amendment.',
    });
  } else if (service.workersCompPre9Jun2023Capped) {
    result.warnings.push({
      code: 'act_workers_comp_pre_9jun2023_capped',
      message:
        'Workers compensation absence pre-9-June-2023 — capped at 2 weeks per service year as service per ACT LSL Act 1976 s.2G (pre-amendment). Excess weeks excluded from continuous service.',
    });
  } else if (service.workersCompPost9Jun2023Counts) {
    result.warnings.push({
      code: 'act_workers_comp_post_9jun2023_counts',
      message:
        'Workers compensation absence from 9 June 2023 counts as service in full per ACT LSL Act 1976 s.10A and WC Act 1951 (ACT) s.46 amendment.',
    });
  }
  if (service.sicknessExcessExcluded) {
    result.warnings.push({
      code: 'act_sickness_excess_2wk_excluded',
      message:
        'Sick leave in excess of 2 weeks per service year does NOT count toward continuous service per ACT LSL Act 1976 s.2G. The first 2 weeks per service year counted; excess weeks excluded.',
    });
  }
  if (service.parentalLeaveExcluded) {
    result.warnings.push({
      code: 'sa_or_act_parental_leave_excluded',
      message:
        'Paid parental leave (Company-Paid Parental + Government Paid Parental Leave) does NOT count as service under ACT LSL Act 1976 s.2G — WorkSafe ACT guidance. This diverges from NSW/SA (which count company-paid parental) and from VIC post-2018 (which counts the first 52 wks).',
    });
  }

  // ── Advance-leave refusal (TBD-ACT-14): sub-7-yr taking_leave returns $0
  //    with advisory; status remains 'computed'.
  if (
    trigger.kind === 'taking_leave' &&
    service.yearsOfContinuousService.lt(actAccrualConstants.fullQualifyingYears)
  ) {
    result.warnings.push({
      code: 'act_advance_leave_not_permitted',
      message:
        'Taking LSL before the 7-year entitlement is NOT permitted under ACT LSL Act 1976 — the Act contains no leave-in-advance provision. Engine refuses the leave-taking trigger and returns $0. To compute what the worker WOULD be entitled to at this tenure if terminated for a qualifying reason, change the trigger to "termination" with a qualifying reason.',
    });
    const vow = valueOfWeekACT(employee, trigger, psd, service.effectiveServiceStart);
    const zero = new Decimal(0);
    const vowCitations = [...vow.citations, ...service.citations];
    const triggerCits = triggerCitationsACT(trigger);
    const weeksCitations = [...service.citations, ...triggerCits];
    const dollarsCitations = [...service.citations, ...vow.citations, ...triggerCits];
    result.outputs = {
      valueOfWeek: {
        value: vow.value,
        display: displayAUD(vow.value),
        citations: vowCitations,
      },
      valueOfDay: {
        value: valueOfDayACT(vow.value),
        display: displayAUD(valueOfDayACT(vow.value)),
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
      weeklyAvg12mo: vow.weeklyAvg12moHours ?? new Decimal(0),
      weeklyAvg5yr: new Decimal(0),
      payableIndicator: 'accrued_not_currently_payable',
      serviceStartUsed: service.effectiveServiceStart,
    };
    return result;
  }

  const vow = valueOfWeekACT(
    employee,
    trigger,
    psd,
    service.effectiveServiceStart
  );
  if (vow.overtimeIncluded) {
    result.warnings.push({
      code: 'act_overtime_included_in_hours_average',
      message:
        'Overtime hours included in the 12-month casual/PT hours-averaging window per ACT LSL Act 1976 s.7(2) (taking_leave) or s.11D (termination). Rate applied is the base hourly rate; overtime premium is EXCLUDED from the rate per s.7(1). This is the F9/AC11 asymmetric overtime treatment.',
    });
  }
  if (vow.s7_3Applied) {
    result.warnings.push({
      code: 'act_s7_3_ft_to_pt_within_2yr_path',
      message:
        'Employee transitioned FT→PT/casual within 2 years of the 7-year LSL entitlement anniversary. Engine routed to ACT LSL Act 1976 s.7(3) 5-year-total-salary path instead of s.7(2) hours-averaging path. value_of_week = 5-yr total salary / 5 / 52. ACT-UNIQUE — no other Australian state has this rule.',
    });
  }
  if (vow.anchorDiverged && trigger.kind === 'termination') {
    result.warnings.push({
      code: 'act_taking_anchor_vs_termination_anchor_diverged',
      message:
        'Trigger drives averaging anchor: `taking_leave` uses 12 months immediately before the entitlement date (s.7(2)); current `termination` trigger uses 12 months immediately before cessation (s.11D). Engine applied the s.11D anchor — yields a different average than s.7(2) would have for this employee.',
    });
  }
  if (vow.path === 'commission-12mo') {
    result.warnings.push({
      code: 'act_commission_12mo_lookback_applied',
      message:
        'Worker paid on commission. Ordinary weekly rate calculated as 12-month income divided by 52 per ACT LSL Act 1976 s.2F.',
    });
  }

  const priorTaken = employee.priorLeaveTakenWeeks
    ? d(employee.priorLeaveTakenWeeks)
    : new Decimal(0);
  const accrual = accrualACT(
    service.yearsOfContinuousService,
    employee,
    trigger,
    priorTaken
  );

  if (accrual.sub5YrNoEntitlement) {
    result.warnings.push({
      code: 'sub_5yr_no_entitlement_act',
      message:
        'Below 5 years of continuous service. No pro-rata entitlement is payable under ACT LSL Act 1976 s.11C. The 5-year threshold is the universal floor in ACT — the LOWEST in Australia.',
    });
  }
  if (accrual.sub7YrNoQualifyingReason) {
    result.warnings.push({
      code: 'sub_7yr_no_qualifying_reason_act',
      message:
        'Below 7 years of continuous service. Termination reason does NOT qualify for pro-rata under ACT LSL Act 1976 s.11C. Qualifying reasons in the 5–7-yr band are: illness/incapacity, domestic or pressing necessity, retirement (award/agreement OR 65), death, employer-not-misconduct dismissal. Voluntary resignation and poor-performance dismissal do NOT qualify.',
    });
  }
  if (accrual.sub7YrMisconductExcluded) {
    result.warnings.push({
      code: 'sub_7yr_misconduct_excluded_act',
      message:
        'Dismissal for serious and wilful misconduct under ACT LSL Act 1976 s.11C — at sub-7-year tenure, no pro-rata entitlement is payable. At 7+ years, the full entitlement is payable regardless of reason (ACT mirrors NSW/VIC/QLD/SA; ACT does NOT mirror WA partial-forfeiture).',
    });
  }
  if (accrual.sevenYrPlusMisconductFullPayout) {
    result.warnings.push({
      code: 'act_7yr_plus_misconduct_full_payout',
      message:
        'Dismissal for serious & wilful misconduct at 7+ years of continuous service. Under ACT LSL Act 1976 s.4, the full entitlement is payable regardless of termination reason — ACT does NOT mirror WA s.8(3) partial-forfeiture. The serious-misconduct exception in ACT applies ONLY to the pro-rata branch (5–7 yrs), not to the full-entitlement branch.',
    });
  }

  // ── Cash-out advisory family.
  if (trigger.kind === 'cash_out') {
    const years = service.yearsOfContinuousService;
    if (years.lt(actAccrualConstants.prorataQualifyingYears)) {
      result.warnings.push({
        code: 'act_cashout_no_entitlement_to_cash_out',
        message:
          'Worker has not yet reached the 5-year pro-rata threshold. There is no LSL entitlement to cash out. No cash-out election is authorised under ACT LSL Act 1976 until 7+ years of continuous service have been completed.',
      });
    } else if (years.lt(actAccrualConstants.fullQualifyingYears)) {
      result.warnings.push({
        code: 'act_cashout_pre_accrual_not_authorised',
        message:
          'Cashing out at sub-7-year tenure is NOT authorised under ACT LSL Act 1976 — the pro-rata under s.11C is payable on termination only, not as a cash-out election. If the worker is leaving the employer, change the trigger to "termination" with a qualifying reason.',
      });
    } else {
      result.warnings.push({
        code: 'act_cashout_post_accrual_advisory',
        message:
          'Cashing out long service leave in ACT is permitted per WorkSafe ACT guidance under ACT LSL Act 1976 s.8(c) "in another way". Written agreement between employer and employee is recommended. Value of cash-out is calculated as if LSL were taken. Non-statutory — engine emits advisory, not a hard error.',
      });
    }
  }

  // ── WC overlap with LSL rate.
  const triggerDate: ISODate =
    trigger.kind === 'termination'
      ? trigger.terminationDate
      : trigger.kind === 'as_at'
        ? trigger.asAtDate
        : trigger.kind === 'taking_leave'
          ? trigger.leaveStartDate
          : trigger.cashOutDate;
  if (workersCompOverlapsTriggerACT(employee.serviceEvents, triggerDate)) {
    result.warnings.push({
      code: 'act_lsl_calculated_at_wc_reduced_rate_warning',
      message:
        'LSL has been calculated at the rate in force at the time leave is taken under ACT LSL Act 1976 s.7. The worker appears to be on workers compensation at a reduced rate. If feasible, defer taking LSL until the worker is back on their ordinary rate; ACT has no statutory higher-of-rates equivalent to VIC s.17.',
    });
  }

  // ── 90-day payable_by surface.
  if (trigger.kind === 'termination') {
    result.payable_by = payableByDate(trigger.terminationDate, 90) as ISODate;
    result.warnings.push({
      code: 'act_termination_payable_within_90_days_advisory',
      message:
        'ACT LSL Act 1976 s.11A(4)(b) provides up to 90 days from cessation for the employer to pay the LSL amount — the LONGEST pay-on-termination window in Australia. The `payable_by` field surfaces the statutory outer-bound date. Most ACT employers pay within the next ordinary pay cycle; this field is informational.',
    });
  }

  const triggerCits = triggerCitationsACT(trigger);

  const valueOfDay = valueOfDayACT(vow.value);
  const totalDollars = mul(vow.value, accrual.payableWeeks);

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
        'Below 5-year pro-rata threshold. Entitlement is accruing but no cash payment is currently triggerable.',
    });
  }

  result.outputs = {
    valueOfWeek: {
      value: vow.value,
      display: displayAUD(vow.value),
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
    weeklyAvg12mo: vow.weeklyAvg12moHours ?? new Decimal(0),
    weeklyAvg5yr: new Decimal(0),
    payableIndicator: accrual.payableIndicator,
    serviceStartUsed: service.effectiveServiceStart,
  };

  return result;
}

export function calculateACTSafe(employee: Employee, trigger: Trigger): Result {
  try {
    return calculateACT(employee, trigger);
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

export const ACT_RULE_SET: StateRuleSet = {
  state: 'ACT',
  calculate: calculateACT,
  calculateSafe: calculateACTSafe,
};
