import { Decimal, add, d, displayAUD, displayWeeks, mul, sub } from '@/lib/lsl/engine/decimal';
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
import { valueOfWeekWA, valueOfDayWA } from './rules/value-of-week';
import { accrualWA, waAccrualConstants } from './rules/accrual-table';
import { triggerCitationsWA } from './rules/trigger-handlers';
import {
  computeWAContinuousService,
  workersCompOverlapsTriggerWA,
  type WAExtraInputs,
} from './continuous-service-rules';

export const WA_JURISDICTION = 'WA' as const;

/**
 * WA LSL orchestrator — implements the TBD-WA-01 RESOLVED single-rule-set
 * pattern with date-aware continuous-service handling.
 *
 * Status conventions:
 *   - 'computed' on success (including cash_out — advisory per TBD-WA-15).
 *   - 'blocked_cross_jurisdiction' for cross-state issues.
 *
 * Does not throw on user-input issues — see `calculateWASafe` for throw-safety.
 *
 * Sources:
 *   - WA LSL Act 1958 ss.5, 6, 8, 9
 *   - IR Legislation Amendment Act 2021 (WA) — 2022-06-20 cutoff
 *   - WCIM Act 2023 (WA) — 2024-07-01 cutoff
 *   - DEMIRS plain-English guidance
 *   - docs/qa/test-cases-wa.md v1.0 PM-signed 2026-05-25
 */

function checkJurisdiction(employee: Employee): { ok: boolean; warnings: Warning[] } {
  const warnings: Warning[] = [];
  const states = employee.statesOfService ?? [];
  const governing = employee.governingJurisdiction;

  if (states.length === 0) {
    return { ok: true, warnings };
  }

  if (states.length === 1) {
    if (states[0] === 'WA') return { ok: true, warnings };
    return {
      ok: false,
      warnings: [
        {
          code: 'cross_jurisdiction_pending',
          message: `Employee has worked only in ${states[0]}. Routed to WA by user nomination — but states-of-service is single-state. Resolve before computing.`,
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

  if (governing === 'WA') {
    const nonWa = states.filter((s) => s !== 'WA');
    if (nonWa.length > 0) {
      warnings.push({
        code: 'cross_jurisdiction_pending',
        message: `Employee has worked in ${states.join(' and ')}. The sufficiently connected test (legal judgement — see APA LSL Masterclass p.138) is for legal counsel where doubt exists. Engine has computed using user-nominated governing jurisdiction: WA.`,
      });
    }
    return { ok: true, warnings };
  }

  return {
    ok: false,
    warnings: [
      {
        code: 'cross_jurisdiction_pending',
        message: `Governing jurisdiction nominated as ${governing}. This calculation routed to WA but the governing state differs — resolve before computing.`,
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
 * Main entry — compute LSL for a WA employee under the given trigger.
 */
export function calculateWA(employee: Employee, trigger: Trigger): Result {
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

  // ── Bonus-in-notes advisory (shared pattern).
  if (notesContainBonusTokens(employee)) {
    result.warnings.push({
      code: 'bonus_in_notes_v1_out_of_scope',
      message:
        'Wage history notes mention bonus / incentive / back-pay / retrospective. Bonus inclusion / retrospective adjustments are out of v1 scope. Calculation runs on the user-provided gross.',
    });
  }

  // ── Prescribed date.
  const psd =
    trigger.kind === 'cash_out' ? trigger.cashOutDate : prescribedDate(trigger);

  // ── Pay-pattern classifier.
  const classifierResult = classify(employee);
  result.category = classifierResult.category;
  result.categoryAmbiguous = classifierResult.ambiguous;
  if (classifierResult.ambiguous) {
    result.warnings.push({
      code: 'classifier_ambiguous',
      message: `Pay-pattern classifier flagged borderline (signals: ${classifierResult.signals.join(', ')}). User should confirm category in single-mode UI.`,
    });
  }

  // ── Continuous service (date-aware pre/post 2022 + WCIM 2024 override).
  const waExtras = (employee.extraInputs ?? {}) as WAExtraInputs;
  const service = computeWAContinuousService(
    employee.startDate,
    psd,
    employee.serviceEvents,
    employee.employmentType,
    waExtras
  );
  result.warnings.push(...service.warnings);

  // ── Value of week (s.9 — accrual-period averaging for casual/varied; fixed-rate for FT/PT).
  const vow = valueOfWeekWA(employee, trigger, psd, service.yearsOfContinuousService);

  // ── Accrual (s.8(1) / s.8(3) + 10+yr misconduct partial-forfeiture).
  const priorTaken = employee.priorLeaveTakenWeeks
    ? d(employee.priorLeaveTakenWeeks)
    : new Decimal(0);
  const accrual = accrualWA(
    service.yearsOfContinuousService,
    trigger,
    priorTaken
  );

  // ── Sub-7-yr advisory.
  if (
    trigger.kind !== 'as_at' &&
    service.yearsOfContinuousService.lt(
      waAccrualConstants.prorataQualifyingYears
    )
  ) {
    result.warnings.push({
      code: 'sub_7yr_no_entitlement_wa',
      message:
        'No LSL entitlement under WA LSL Act 1958 s.8(3) — sub-7-year service. Review applicable industrial instrument, EA, or contract — these may provide more favourable terms than the statutory minimum.',
    });
  }

  // ── Sub-10-yr misconduct advisory (engine returned $0).
  if (accrual.misconductExcludedSub10) {
    result.warnings.push({
      code: 'sub_10yr_misconduct_excluded_wa',
      message:
        'Dismissal for serious misconduct under WA LSL Act 1958 s.8(3) — at sub-10-year tenure, no pro-rata entitlement is payable. Note: at 10+ years, the last fully-accrued block remains payable but accrual since the last milestone is forfeited.',
    });
  }

  // ── 10+yr misconduct partial-forfeiture advisory.
  if (accrual.partialForfeiture10Plus) {
    const forfeited = accrual.accrualSinceLastMilestoneWeeks ?? new Decimal(0);
    const lastBlock = accrual.lastFullyAccruedBlockWeeks ?? new Decimal(0);
    result.warnings.push({
      code: 'wa_10yr_plus_misconduct_partial_forfeiture',
      message: `Dismissal for serious misconduct at 10+ years. Last fully-accrued entitlement block (${displayWeeks(
        lastBlock,
        4
      )} wks) is payable. ${displayWeeks(
        forfeited,
        4
      )} wks of accrual since the last milestone has been forfeited under WA LSL Act 1958 s.8(3).`,
    });
  }

  // ── Cash-out advisory family (TBD-WA-03 RESOLVED — three codes).
  if (trigger.kind === 'cash_out') {
    if (
      service.yearsOfContinuousService.lt(
        waAccrualConstants.prorataQualifyingYears
      )
    ) {
      // Sub-7-yr: double advisory.
      result.warnings.push({
        code: 'wa_cashout_no_entitlement_to_cash_out',
        message:
          'Below the 7-year qualifying period under WA LSL Act 1958 s.8 — no LSL entitlement has yet accrued. There is nothing to cash out.',
      });
    } else if (
      service.yearsOfContinuousService.lt(
        waAccrualConstants.fullQualifyingYears
      )
    ) {
      // 7+ to first-milestone: pre-accrual advisory.
      result.warnings.push({
        code: 'wa_cashout_pre_accrual_not_authorised',
        message:
          'Cashing out before the first 10-year accrual milestone is not authorised under WA LSL Act 1958 s.5 (as amended 2022). The calculator has computed the dollar value as requested, but the cash-out cannot be lawfully effected until the employee completes their first 10-year accrual block.',
      });
    } else {
      // Post-first-milestone: lawful advisory.
      result.warnings.push({
        code: 'wa_cashout_post_accrual_advisory',
        message:
          'Cashing out of long service leave under WA LSL Act 1958 s.5 (as amended 2022) is permitted ONLY after the entitlement has been fully accrued (10-yr or subsequent 5-yr milestone). Must be a written agreement signed by both employer and employee. Employee must be paid at least what they would have received at ordinary pay. Employer must keep records.',
      });
    }
  }

  // ── WC-overlap advisory (TBD-WA-05 RESOLVED).
  const triggerDate: string =
    trigger.kind === 'termination'
      ? trigger.terminationDate
      : trigger.kind === 'as_at'
        ? trigger.asAtDate
        : trigger.kind === 'taking_leave'
          ? trigger.leaveStartDate
          : trigger.cashOutDate;
  if (
    workersCompOverlapsTriggerWA(
      employee.serviceEvents,
      triggerDate as Parameters<typeof workersCompOverlapsTriggerWA>[1]
    )
  ) {
    result.warnings.push({
      code: 'wa_lsl_calculated_at_wc_reduced_rate_warning',
      message:
        'LSL has been calculated at the rate in force at the time leave is taken under WA LSL Act 1958 s.9. The employee appears to be on workers compensation at a reduced rate. If feasible, defer taking LSL until the employee is back on their ordinary rate; WA has no statutory higher-of-rates equivalent to VIC s.17.',
    });
  }

  // ── Trigger-specific citations.
  const triggerCits = triggerCitationsWA(trigger);

  // ── Casual taking_leave: blended computation across blocks (8.6667 wks at
  // block1 rate, then remainder at partial-block2 rate). For other paths,
  // the standard totalDollars = vow.value × payableWeeks applies.
  let totalDollars: Decimal;
  if (
    (vow.path === 'casual-accrual-period' || vow.path === 'varied-hours-accrual-period') &&
    vow.valueOfWeekPartialBlock2 &&
    accrual.payableWeeks.gt(waAccrualConstants.firstBlockWeeks)
  ) {
    // Blended: first 8.6667 wks at block1, remainder at partial-block2.
    const firstBlockDollars = mul(
      vow.valueOfWeekBlock1 ?? vow.value,
      waAccrualConstants.firstBlockWeeks
    );
    const remainderWeeks = sub(
      accrual.payableWeeks,
      waAccrualConstants.firstBlockWeeks
    );
    const remainderDollars = mul(vow.valueOfWeekPartialBlock2, remainderWeeks);
    totalDollars = add(firstBlockDollars, remainderDollars);
  } else {
    totalDollars = mul(vow.value, accrual.payableWeeks);
  }

  // ── Assemble outputs.
  const valueOfDay = valueOfDayWA(vow.value);

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

  // ── As-at sub-7-yr indicator → user-facing warning.
  if (
    accrual.payableIndicator === 'accrued_not_currently_payable' &&
    trigger.kind === 'as_at'
  ) {
    result.warnings.push({
      code: 'accrued_not_currently_payable',
      message:
        'Accrued LSL snapshot for liability/audit reporting. Employee is below the 7-year threshold under WA LSL Act 1958 s.8 and is not currently entitled to take or be paid out this value.',
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
    weeklyAvg12mo: new Decimal(0),
    weeklyAvg5yr: new Decimal(0),
    payableIndicator: accrual.payableIndicator,
    serviceStartUsed: service.effectiveServiceStart,
  };

  return result;
}

/** Throw-safe wrapper for bulk-mode fault isolation. */
export function calculateWASafe(employee: Employee, trigger: Trigger): Result {
  try {
    return calculateWA(employee, trigger);
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
      // Defensive — WA's cash-out path is advisory, not blocking.
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

/** WA rule set — implements the StateRuleSet contract. */
export const WA_RULE_SET: StateRuleSet = {
  state: 'WA',
  calculate: calculateWA,
  calculateSafe: calculateWASafe,
};
