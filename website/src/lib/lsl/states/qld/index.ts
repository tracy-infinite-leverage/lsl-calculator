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
import { valueOfWeekQLD, valueOfDayQLD } from './rules/value-of-week';
import { accrualQLD, qldAccrualConstants } from './rules/accrual-table';
import { triggerCitationsQLD } from './rules/trigger-handlers';
import {
  computeQLDContinuousService,
  workersCompOverlapsTrigger,
  type QLDExtraInputs,
} from './continuous-service-rules';

export const QLD_JURISDICTION = 'QLD' as const;

/**
 * Validate jurisdiction for QLD. Mirrors NSW / VIC pattern.
 */
function checkJurisdiction(employee: Employee): { ok: boolean; warnings: Warning[] } {
  const warnings: Warning[] = [];
  const states = employee.statesOfService ?? [];
  const governing = employee.governingJurisdiction;

  if (states.length === 0) {
    return { ok: true, warnings };
  }

  if (states.length === 1) {
    if (states[0] === 'QLD') return { ok: true, warnings };
    return {
      ok: false,
      warnings: [
        {
          code: 'cross_jurisdiction_pending',
          message: `Employee has worked only in ${states[0]}. Routed to QLD by user nomination — but states-of-service is single-state. Resolve before computing.`,
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

  if (governing === 'QLD') {
    const nonQld = states.filter((s) => s !== 'QLD');
    if (nonQld.length > 0) {
      warnings.push({
        code: 'cross_jurisdiction_pending',
        message: `Employee has worked in ${states.join(' and ')}. The sufficiently connected test (legal judgement, not arithmetic — see APA LSL Masterclass p.138) is for legal counsel where doubt exists. Engine has computed using user-nominated governing jurisdiction: QLD.`,
      });
    }
    return { ok: true, warnings };
  }

  return {
    ok: false,
    warnings: [
      {
        code: 'cross_jurisdiction_pending',
        message: `Governing jurisdiction nominated as ${governing}. This calculation routed to QLD but the governing state differs — resolve before computing.`,
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
 * Main entry: compute LSL for a QLD employee under the given trigger.
 *
 * Status conventions:
 *   - 'computed' on success (including cash_out — QLD's cash-out is advisory,
 *     not a hard error like VIC).
 *   - 'blocked_cross_jurisdiction' for jurisdiction issues.
 *
 * Does not throw on user-input issues — see `calculateQLDSafe` for throw-safety.
 *
 * Sources:
 *   - QLD IR Act 2016 ss.93–110, 134
 *   - docs/qa/test-cases-qld.md v1.0 PM-signed 2026-05-25
 */
export function calculateQLD(employee: Employee, trigger: Trigger): Result {
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

  // ── Bonus-in-notes advisory (shared pattern with NSW + VIC).
  if (notesContainBonusTokens(employee)) {
    result.warnings.push({
      code: 'bonus_in_notes_v1_out_of_scope',
      message:
        'Wage history notes mention bonus / incentive / back-pay / retrospective. Bonus inclusion / retrospective adjustments are out of v1 scope. Calculation runs on the user-provided gross.',
    });
  }

  // ── Prescribed date: for cash_out we use cashOutDate directly (shared
  //    `prescribedDate()` helper throws on cash_out because most states don't
  //    support it).
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

  // ── Continuous service (QLD single-regime + s.103 casual cliff + s.96 advisory).
  const qldExtras = (employee.extraInputs ?? {}) as QLDExtraInputs;
  const service = computeQLDContinuousService(
    employee.startDate,
    psd,
    employee.serviceEvents,
    employee.employmentType,
    qldExtras
  );
  result.warnings.push(...service.warnings);

  // ── Value of week (s.98 / s.99 / s.105).
  const vow = valueOfWeekQLD(employee, trigger, psd);

  // ── Accrual (s.95(2) / s.95(3) / s.95(4)).
  const priorTaken = employee.priorLeaveTakenWeeks
    ? d(employee.priorLeaveTakenWeeks)
    : new Decimal(0);
  const accrual = accrualQLD(service.yearsOfContinuousService, trigger, priorTaken);

  // ── Sub-7-yr advisory.
  if (
    trigger.kind !== 'as_at' &&
    service.yearsOfContinuousService.lt(qldAccrualConstants.prorataQualifyingYears)
  ) {
    result.warnings.push({
      code: 'sub_7yr_no_entitlement_qld',
      message:
        'No LSL entitlement under QLD IR Act 2016 s.95(3) — sub-7-year service. Review applicable industrial instrument, EA, or contract — these may provide more favourable terms than the statutory minimum.',
    });
  }

  // ── Sub-10-yr misconduct advisory (engine returned $0).
  if (accrual.misconductExcluded) {
    result.warnings.push({
      code: 'sub_10yr_misconduct_excluded_qld',
      message:
        'Dismissal for serious misconduct does not satisfy any qualifying reason under QLD IR Act 2016 s.95(3) — sub-10-year service. Engine returns $0. (Note: at 10+ years, misconduct does NOT exclude payout per s.95(2).)',
    });
  }

  // ── Sub-10-yr no-qualifying-reason (e.g. voluntary resignation at 9 yrs).
  if (accrual.noQualifyingReason) {
    result.warnings.push({
      code: 'sub_10yr_no_qualifying_reason_qld',
      message:
        'Below 10 years of continuous service. Pro-rata is payable only if termination is for a qualifying reason under QLD IR Act 2016 s.95(3)/(4) — death, illness/domestic pressing necessity, dismissal not for conduct/capacity/performance, or unfair dismissal. Voluntary resignation does not qualify.',
    });
  }

  // ── Cash-out advisory family (TBD-QLD-04 resolution).
  if (trigger.kind === 'cash_out') {
    result.warnings.push({
      code: 'qld_cashout_requires_instrument_or_qirc',
      message:
        'Cashing out long service leave in Queensland is permitted only if (a) an applicable industrial instrument (modern award, certified agreement, bargaining award) authorises it, OR (b) the Queensland Industrial Relations Commission orders cash-out on financial hardship or compassionate grounds. Engine has computed the value of the leave as if cashed out, but the legal authority to cash out MUST be verified before paying. See QLD IR Act 2016 s.110.',
    });
    if (
      service.yearsOfContinuousService.lt(qldAccrualConstants.prorataQualifyingYears)
    ) {
      result.warnings.push({
        code: 'qld_cashout_no_entitlement_to_cash_out',
        message:
          'Below the 7-yr qualifying period, no LSL entitlement has accrued — there is nothing to cash out under QLD IR Act 2016 s.95.',
      });
    } else if (
      service.yearsOfContinuousService.lt(qldAccrualConstants.fullQualifyingYears)
    ) {
      result.warnings.push({
        code: 'sub_10yr_cashout_only_via_qirc_qld',
        message:
          'Cash-out requests below 10 yrs of service in QLD are typically only granted by QIRC order on financial hardship or compassionate grounds. Industrial instruments rarely authorise pre-10-yr cash-out. Verify legal authority before paying.',
      });
    }
  }

  // ── WC-overlap advisory (TBD-QLD-05 resolution).
  const triggerDate: string =
    trigger.kind === 'termination'
      ? trigger.terminationDate
      : trigger.kind === 'as_at'
        ? trigger.asAtDate
        : trigger.kind === 'taking_leave'
          ? trigger.leaveStartDate
          : trigger.cashOutDate;
  if (
    workersCompOverlapsTrigger(employee.serviceEvents, triggerDate as Parameters<typeof workersCompOverlapsTrigger>[1])
  ) {
    result.warnings.push({
      code: 'qld_lsl_calculated_at_wc_reduced_rate_warning',
      message:
        'LSL has been calculated at the rate in force at the time leave is taken under QLD IR Act 2016 s.98. The employee appears to be on workers compensation at a reduced rate. If feasible, defer taking LSL until the employee is back on their ordinary rate; QLD has no statutory higher-of-rates equivalent to VIC s.17.',
    });
  }

  // ── Trigger-specific citations.
  const triggerCits = triggerCitationsQLD(trigger);

  // ── Assemble outputs.
  const valueOfDay = valueOfDayQLD(vow.value);
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
        'Accrued LSL snapshot for liability/audit reporting. Employee is below the 7-year threshold under QLD IR Act 2016 s.95 and is not currently entitled to take or be paid out this value.',
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
    weeklyAvg5yr: new Decimal(0),
    payableIndicator: accrual.payableIndicator,
    serviceStartUsed: service.effectiveServiceStart,
  };

  return result;
}

/** Throw-safe wrapper for bulk-mode fault isolation. */
export function calculateQLDSafe(employee: Employee, trigger: Trigger): Result {
  try {
    return calculateQLD(employee, trigger);
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
      // Defensive — QLD's calculateQLD does NOT throw for cash_out (it
      // computes-with-advisory). Reaching here means a different state's
      // helper accidentally bubbled up.
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
 * QLD rule set — implements the StateRuleSet contract.
 */
export const QLD_RULE_SET: StateRuleSet = {
  state: 'QLD',
  calculate: calculateQLD,
  calculateSafe: calculateQLDSafe,
};
