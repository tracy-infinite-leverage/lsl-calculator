import { Decimal, d, displayAUD, displayWeeks, mul } from '@/lib/lsl/engine/decimal';
import type {
  Citation,
  Employee,
  Result,
  Trigger,
  Warning,
} from '@/lib/lsl/engine/types';
import { classify } from '@/lib/lsl/engine/classifier';
import { prescribedDate } from '@/lib/lsl/engine/trigger';
import {
  CashOutNotSupportedError,
  JurisdictionBlockedError,
} from '@/lib/lsl/engine/errors';
import { computeSystemFormula } from '@/lib/lsl/engine/system-formula';
import type { StateRuleSet } from '@/lib/lsl/states/StateRuleSet';
import { valueOfWeekSA, valueOfDaySA } from './rules/value-of-week';
import { accrualSA, saAccrualConstants } from './rules/accrual-table';
import { triggerCitationsSA } from './rules/trigger-handlers';
import {
  computeSAContinuousService,
  workersCompOverlapsTrigger,
  type SAExtraInputs,
} from './continuous-service-rules';

export const SA_JURISDICTION = 'SA' as const;

/**
 * Validate jurisdiction for SA. Mirrors NSW / VIC / QLD / WA pattern.
 */
function checkJurisdiction(employee: Employee): { ok: boolean; warnings: Warning[] } {
  const warnings: Warning[] = [];
  const states = employee.statesOfService ?? [];
  const governing = employee.governingJurisdiction;

  if (states.length === 0) {
    return { ok: true, warnings };
  }

  if (states.length === 1) {
    if (states[0] === 'SA') return { ok: true, warnings };
    return {
      ok: false,
      warnings: [
        {
          code: 'cross_jurisdiction_pending',
          message: `Employee has worked only in ${states[0]}. Routed to SA by user nomination — but states-of-service is single-state. Resolve before computing.`,
        },
      ],
    };
  }

  // Multi-state
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

  if (governing === 'SA') {
    const nonSa = states.filter((s) => s !== 'SA');
    if (nonSa.length > 0) {
      warnings.push({
        code: 'cross_jurisdiction_pending',
        message: `Employee has worked in ${states.join(' and ')}. The sufficiently connected test (legal judgement — see APA LSL Masterclass p.138) is for legal counsel where doubt exists. Engine has computed using user-nominated governing jurisdiction: SA.`,
      });
    }
    return { ok: true, warnings };
  }

  return {
    ok: false,
    warnings: [
      {
        code: 'cross_jurisdiction_pending',
        message: `Governing jurisdiction nominated as ${governing}. This calculation routed to SA but the governing state differs — resolve before computing.`,
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

/**
 * Main entry: compute LSL for an SA employee under the given trigger.
 *
 * Status conventions:
 *   - 'computed' on success (including cash_out — SA's cash-out is advisory,
 *     per TBD-SA-06 three-code taxonomy).
 *   - 'blocked_cross_jurisdiction' for jurisdiction issues.
 *
 * Does not throw on user-input issues — see `calculateSASafe` for throw-safety.
 *
 * Sources:
 *   - SA LSL Act 1987 ss.4, 5, 6 (and the LSL (AWE) Amendment Act 2015 (SA))
 *   - docs/qa/test-cases-sa.md v1.0 PM-signed 2026-05-25
 */
export function calculateSA(employee: Employee, trigger: Trigger): Result {
  const result: Result = {
    employeeId: employee.id,
    status: 'computed',
    trigger,
    warnings: [],
  };

  // ── Jurisdiction gate
  const jur = checkJurisdiction(employee);
  if (!jur.ok) {
    return {
      ...result,
      status: 'blocked_cross_jurisdiction',
      warnings: [...result.warnings, ...jur.warnings],
    };
  }
  result.warnings.push(...jur.warnings);

  // ── Termination requires endDate
  if (trigger.kind === 'termination' && !employee.endDate) {
    throw new Error(
      'Termination trigger requires Employee.endDate to be set (or use trigger.terminationDate consistently).'
    );
  }

  // ── Bonus-in-notes advisory (shared pattern with NSW + VIC + QLD + WA).
  // SA additionally surfaces the bonus-excluded-from-156-wk advisory per
  // TBD-SA-06 — but the bonus-in-notes generic emission applies first.
  if (notesContainBonusTokens(employee)) {
    result.warnings.push({
      code: 'bonus_in_notes_v1_out_of_scope',
      message:
        'Wage history notes mention bonus / incentive / back-pay / retrospective. Bonus inclusion / retrospective adjustments are out of v1 scope. Calculation runs on the user-provided gross.',
    });
    result.warnings.push({
      code: 'sa_bonus_excluded_from_average',
      message:
        'Target-achievement bonus or Christmas bonus identified in wage history is excluded from ordinary weekly rate calculation per SafeWork SA — commission / target / per-piece guidance. The worker remains a fixed-rate employee for ordinary-pay purposes.',
    });
  }

  // ── Prescribed date.
  const psd: ReturnType<typeof prescribedDate> =
    trigger.kind === 'cash_out' ? trigger.cashOutDate : prescribedDate(trigger);

  // ── Pay-pattern classifier (diagnostics + ambiguity warnings).
  const classifierResult = classify(employee);
  result.category = classifierResult.category;
  result.categoryAmbiguous = classifierResult.ambiguous;
  if (classifierResult.ambiguous) {
    result.warnings.push({
      code: 'classifier_ambiguous',
      message: `Pay-pattern classifier flagged borderline (signals: ${classifierResult.signals.join(', ')}). User should confirm category in single-mode UI.`,
    });
  }

  // ── Continuous service (SA single-regime s.6).
  const saExtras = (employee.extraInputs ?? {}) as SAExtraInputs;
  const service = computeSAContinuousService(
    employee.startDate,
    psd,
    employee.serviceEvents,
    employee.employmentType,
    saExtras
  );
  result.warnings.push(...service.warnings);

  // ── Value of week (s.4 — incl. higher-duties + 156-wk + 52-wk commission).
  const vow = valueOfWeekSA(employee, trigger, psd);
  if (vow.higherDutiesApplied) {
    result.warnings.push({
      code: 'sa_higher_duties_rate_applied',
      message:
        'Worker is acting in a higher-paid position at the date LSL commences. Per SA LSL Act 1987 s.4 and SafeWork SA guidance, the higher (acting) weekly rate of pay applies as the ordinary weekly rate.',
    });
  }
  if (vow.path === 'commission-52wk') {
    result.warnings.push({
      code: 'sa_commission_52wk_lookback_applied',
      message:
        'Worker paid on commission or part-fixed-rate-part-commission. Ordinary weekly rate calculated as 52-week (12-month) average of total income per SafeWork SA — commission / target / per-piece guidance. Bonuses (Christmas, target-achievement on top of an hourly rate) are excluded from the average per SafeWork SA.',
    });
  }

  // ── Accrual (s.5(1) + s.5(3)).
  const priorTaken = employee.priorLeaveTakenWeeks
    ? d(employee.priorLeaveTakenWeeks)
    : new Decimal(0);
  const workerNoticeCompliance =
    saExtras.sa_worker_notice_compliance !== false; // default true
  const accrual = accrualSA(
    service.yearsOfContinuousService,
    trigger,
    priorTaken,
    workerNoticeCompliance
  );

  // ── Sub-7-yr advisory.
  if (
    trigger.kind !== 'as_at' &&
    trigger.kind !== 'cash_out' &&
    service.yearsOfContinuousService.lt(saAccrualConstants.prorataQualifyingYears)
  ) {
    result.warnings.push({
      code: 'sub_7yr_no_entitlement_sa',
      message:
        'Below 7 years of continuous service. No pro-rata entitlement is payable under SA LSL Act 1987 s.5(3). The 7-year threshold is the universal floor in SA.',
    });
  }

  // ── Sub-10-yr misconduct advisory.
  if (accrual.misconductExcluded) {
    result.warnings.push({
      code: 'sub_10yr_misconduct_excluded_sa',
      message:
        'Dismissal for serious and wilful misconduct under SA LSL Act 1987 s.5(3) — at sub-10-year tenure, no pro-rata entitlement is payable. At 10+ years, the full 13-week (or higher) entitlement is payable regardless of reason (SA mirrors NSW/VIC/QLD; SA does NOT mirror WA\'s partial-forfeiture).',
    });
  }

  // ── SA-unique unlawful-worker-termination advisory.
  if (accrual.unlawfulWorkerTerminationExcluded) {
    result.warnings.push({
      code: 'unlawful_worker_termination_excluded_sa',
      message:
        'Voluntary resignation at 7-10 years with failure to give required notice. Under SA LSL Act 1987 s.5(3), pro-rata is forfeited where the worker has unlawfully terminated their employment (e.g. failure to give the contractually-required notice). This is an SA-unique disqualifier — no other Australian state encodes this.',
    });
  }

  // ── 10+ yr misconduct full-payout advisory (SA-vs-WA divergence).
  if (accrual.tenyrPlusMisconductFullPayout) {
    result.warnings.push({
      code: 'sa_10yr_plus_misconduct_full_payout',
      message:
        'Dismissal for serious & wilful misconduct at 10+ years of continuous service. Under SA LSL Act 1987 s.5(1), the full 13-week (or higher) entitlement is payable regardless of termination reason — SA does NOT mirror WA s.8(3) partial-forfeiture. The serious-misconduct exception in SA applies ONLY to the pro-rata branch (7-10 yrs), not to the full-entitlement branch.',
    });
  }

  // ── Cash-out advisory family (TBD-SA-06 three-code taxonomy).
  if (trigger.kind === 'cash_out') {
    const years = service.yearsOfContinuousService;
    if (years.lt(saAccrualConstants.prorataQualifyingYears)) {
      result.warnings.push({
        code: 'sa_cashout_no_entitlement_to_cash_out',
        message:
          'Worker has not yet reached the 7-year pro-rata threshold. There is no LSL entitlement to cash out. No cash-out election is authorised under SA LSL Act 1987 until 10+ years of continuous service have been completed.',
      });
    } else if (years.lt(saAccrualConstants.fullQualifyingYears)) {
      result.warnings.push({
        code: 'sa_cashout_pre_accrual_not_authorised',
        message:
          "Cashing out at sub-10-year tenure is NOT authorised under SA LSL Act 1987. The engine has surfaced the pro-rata value the worker would receive ON TERMINATION (1.3 wks × completed years) but no cash-out election can lawfully be made before 10 years of continuous service. If the worker is leaving the employer, change the trigger to 'termination'.",
      });
    } else {
      result.warnings.push({
        code: 'sa_cashout_post_accrual_advisory',
        message:
          'Cashing out long service leave under SA LSL Act 1987 requires written agreement signed by both parties and is permitted only after the worker has completed 10 or more years of continuous service. Employer must provide a written statement showing entitlement, payment amount, period covered, and remaining leave. SA does not authorise involuntary cash-out — this is an employee-initiated election.',
      });
    }
  }

  // ── PH-during-LSL single-day-on-PH advisory (TBD-SA-09).
  // Heuristic: leaveWeeks present and <= 0.2 (1 day or less of a 5-day week).
  // This is informational — engine charges the entitlement per the
  // PH-inclusive rule. The form will pre-detect the actual PH dates; this
  // advisory captures the borderline single-day case for the result panel.
  if (
    trigger.kind === 'taking_leave' &&
    trigger.leaveWeeks !== undefined &&
    trigger.leaveWeeks <= 0.2
  ) {
    result.warnings.push({
      code: 'ph_only_lsl_day_sa',
      message:
        'The single day requested may fall on a public holiday. Under SA s.5 PH-inclusive rule, the day is treated as 1 day of LSL (counted against entitlement); payment is at the worker\'s ordinary daily rate as if working.',
    });
  }

  // ── WC-overlap advisory (TBD-SA-08 RESOLUTION — parallel to QLD/WA).
  const triggerDate: string =
    trigger.kind === 'termination'
      ? trigger.terminationDate
      : trigger.kind === 'as_at'
        ? trigger.asAtDate
        : trigger.kind === 'taking_leave'
          ? trigger.leaveStartDate
          : trigger.cashOutDate;
  if (
    workersCompOverlapsTrigger(
      employee.serviceEvents,
      triggerDate as Parameters<typeof workersCompOverlapsTrigger>[1]
    )
  ) {
    result.warnings.push({
      code: 'sa_lsl_calculated_at_wc_reduced_rate_warning',
      message:
        'LSL has been calculated at the rate in force at the time leave is taken under SA LSL Act 1987 s.4. The worker appears to be on workers compensation at a reduced rate. If feasible, defer taking LSL until the worker is back on their ordinary rate; SA has no statutory higher-of-rates equivalent to VIC s.17.',
    });
  }

  // ── Trigger-specific citations.
  const triggerCits = triggerCitationsSA(trigger);

  // ── Assemble outputs.
  const valueOfDay = valueOfDaySA(vow.value);
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

  // System formula.
  const sf = computeSystemFormula(
    employee.currentWeeklyGross,
    accrual.payableWeeks,
    totalDollars
  );

  // Payable indicator → user-facing warning (as-at sub-7-yr).
  if (
    accrual.payableIndicator === 'accrued_not_currently_payable' &&
    trigger.kind === 'as_at'
  ) {
    result.warnings.push({
      code: 'accrued_not_currently_payable',
      message:
        'Below 7-year pro-rata threshold. Entitlement is accruing but no cash payment is currently triggerable.',
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
    daysNotCountedInLookback: {
      window12mo: 0,
      window5yr: 0,
    },
    weeklyAvg12mo: vow.weeklyAvg52w ?? new Decimal(0),
    weeklyAvg5yr: vow.weeklyAvg156w ?? new Decimal(0),
    payableIndicator: accrual.payableIndicator,
    serviceStartUsed: service.effectiveServiceStart,
  };

  return result;
}

/** Throw-safe wrapper for bulk-mode fault isolation. */
export function calculateSASafe(employee: Employee, trigger: Trigger): Result {
  try {
    return calculateSA(employee, trigger);
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
      err instanceof Error ? err.message : 'An unknown error occurred during calculation.';
    return {
      employeeId: employee.id,
      status: 'failed',
      trigger,
      warnings: [],
      error: { code, userMessage },
    };
  }
}

/**
 * SA rule set — implements the StateRuleSet contract.
 */
export const SA_RULE_SET: StateRuleSet = {
  state: 'SA',
  calculate: calculateSA,
  calculateSafe: calculateSASafe,
};
