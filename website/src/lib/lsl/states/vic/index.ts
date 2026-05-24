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
  VICCashOutProhibitedError,
} from '@/lib/lsl/engine/errors';
import { computeSystemFormula } from '@/lib/lsl/engine/system-formula';
import { citation } from '@/lib/lsl/engine/citation';
import type { StateRuleSet } from '@/lib/lsl/states/StateRuleSet';
import { valueOfWeekVIC, valueOfDayVIC } from './rules/value-of-week';
import { accrualVIC, vicAccrualConstants } from './rules/accrual-table';
import { triggerCitationsVIC } from './rules/trigger-handlers';
import {
  computeVICContinuousService,
  type VICExtraInputs,
} from './continuous-service-rules';

export const VIC_JURISDICTION = 'VIC' as const;

/**
 * Validate jurisdiction for VIC. Mirrors NSW pattern.
 *
 * Rules:
 *   - statesOfService === [VIC] → compute.
 *   - statesOfService === [] → assume VIC (form-level default when called via
 *     the dispatcher with governingJurisdiction = VIC).
 *   - Single non-VIC state → blocked.
 *   - Multi-state with governing = VIC → compute, emit cross-jurisdiction
 *     advisory for the non-VIC states.
 *   - Multi-state without governing → blocked.
 *   - Multi-state with governing != VIC → blocked (dispatcher won't route here
 *     in practice, but defensive).
 */
function checkJurisdiction(employee: Employee): { ok: boolean; warnings: Warning[] } {
  const warnings: Warning[] = [];
  const states = employee.statesOfService ?? [];
  const governing = employee.governingJurisdiction;

  if (states.length === 0) {
    return { ok: true, warnings };
  }

  if (states.length === 1) {
    if (states[0] === 'VIC') return { ok: true, warnings };
    return {
      ok: false,
      warnings: [
        {
          code: 'cross_jurisdiction_pending',
          message: `Employee has worked only in ${states[0]}. Routed to VIC by user nomination — but states-of-service is single-state. Resolve before computing.`,
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

  if (governing === 'VIC') {
    const nonVic = states.filter((s) => s !== 'VIC');
    if (nonVic.length > 0) {
      warnings.push({
        code: 'cross_jurisdiction_pending',
        message: `Employee has worked in ${states.join(' and ')}. The sufficiently connected test (legal judgement, not arithmetic — see APA LSL Masterclass p.138) is for legal counsel where doubt exists. Engine has computed using user-nominated governing jurisdiction: VIC.`,
      });
    }
    return { ok: true, warnings };
  }

  return {
    ok: false,
    warnings: [
      {
        code: 'cross_jurisdiction_pending',
        message: `Governing jurisdiction nominated as ${governing}. This calculation routed to VIC but the governing state differs — resolve before computing.`,
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
 * Main entry: compute LSL for a VIC employee under the given trigger.
 *
 * Returns:
 *   - status: 'computed' on success.
 *   - status: 'blocked_cross_jurisdiction' for jurisdiction issues.
 *   - status: 'failed' with error.code: 'vic_cashout_prohibited' for cash_out
 *     trigger (per VIC LSL Act 2018 s.34 — criminal offence).
 *
 * Does not throw on user-input issues — see calculateVICSafe for throw-safety.
 */
export function calculateVIC(employee: Employee, trigger: Trigger): Result {
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

  // ── F5 hard error: VIC prohibits cashing out (s.34 criminal offence).
  // calculateVICSafe converts this into a failed Result with error.code
  // 'vic_cashout_prohibited' and citations to s.34, s.9, s.22.
  if (trigger.kind === 'cash_out') {
    throw new VICCashOutProhibitedError();
  }

  // ── F18: bonus-warning if notes mention bonus tokens
  if (notesContainBonusTokens(employee)) {
    result.warnings.push({
      code: 'bonus_in_notes_v1_out_of_scope',
      message:
        'Wage history notes mention bonus / incentive / back-pay / retrospective. Bonus inclusion / retrospective adjustments are out of v1 scope. Calculation runs on the user-provided gross.',
    });
  }

  const psd = prescribedDate(trigger);

  // ── Pay-pattern classifier (shared with NSW — used for diagnostics and
  // ambiguity warnings only; VIC value-of-week chooses its path internally).
  const classifierResult = classify(employee);
  result.category = classifierResult.category;
  result.categoryAmbiguous = classifierResult.ambiguous;
  if (classifierResult.ambiguous) {
    result.warnings.push({
      code: 'classifier_ambiguous',
      message: `Pay-pattern classifier flagged borderline (signals: ${classifierResult.signals.join(', ')}). User should confirm category in single-mode UI.`,
    });
  }

  // ── Continuous service (VIC date-aware)
  const vicExtras = (employee.extraInputs ?? {}) as VICExtraInputs;
  const service = computeVICContinuousService(
    employee.startDate,
    psd,
    employee.serviceEvents,
    employee.employmentType,
    vicExtras
  );
  result.warnings.push(...service.warnings);

  // ── Value of week (s.15 / s.16 / s.17, with s.10(3)(b) override for death)
  const vow = valueOfWeekVIC(employee, trigger, psd, service.effectiveServiceStart);

  // ── Accrual (s.6 — 7-year threshold, full payout above)
  const priorTaken = employee.priorLeaveTakenWeeks
    ? d(employee.priorLeaveTakenWeeks)
    : new Decimal(0);
  const accrual = accrualVIC(service.yearsOfContinuousService, trigger, priorTaken);

  // ── Sub-7-yr advisory for death/illness (TBD-VIC-07)
  if (
    trigger.kind === 'termination' &&
    (trigger.reason === 'death' || trigger.reason === 'illness_incapacity') &&
    service.yearsOfContinuousService.lt(vicAccrualConstants.qualifyingYears)
  ) {
    result.warnings.push({
      code: 'sub_7yr_review_industrial_instrument',
      message:
        'No LSL entitlement under VIC LSL Act 2018 s.6. Review applicable industrial instrument, EA, or contract — these may provide more favourable terms than the statutory minimum.',
    });
  }

  // ── Trigger-specific citations
  const triggerCits = triggerCitationsVIC(trigger);

  // ── Assemble outputs
  const valueOfDay = valueOfDayVIC(vow.value);
  const totalDollars = mul(vow.value, accrual.payableWeeks);

  // Per-output citation slices
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

  // System formula
  const sf = computeSystemFormula(
    employee.currentWeeklyGross,
    accrual.payableWeeks,
    totalDollars
  );

  // Payable indicator → user-facing warning
  if (accrual.payableIndicator === 'accrued_not_currently_payable') {
    result.warnings.push({
      code: 'accrued_not_currently_payable',
      message:
        'Accrued LSL snapshot for liability/audit reporting. Employee is below the 7-year threshold under VIC LSL Act 2018 s.6 and is not currently entitled to take or be paid out this value.',
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
      window12mo: vow.daysNotCountedInLookback?.window52w ?? 0,
      window5yr: vow.daysNotCountedInLookback?.window260w ?? 0,
    },
    weeklyAvg12mo: vow.weeklyAvg52w ?? new Decimal(0),
    weeklyAvg5yr: vow.weeklyAvg260w ?? new Decimal(0),
    payableIndicator: accrual.payableIndicator,
    serviceStartUsed: service.effectiveServiceStart,
  };

  return result;
}

/** Throw-safe wrapper for bulk-mode fault isolation. */
export function calculateVICSafe(employee: Employee, trigger: Trigger): Result {
  try {
    return calculateVIC(employee, trigger);
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
    if (err instanceof VICCashOutProhibitedError) {
      return {
        employeeId: employee.id,
        status: 'failed',
        trigger,
        warnings: [],
        error: { code: err.code, userMessage: err.userMessage },
      };
    }
    if (err instanceof CashOutNotSupportedError) {
      // Defensive — calculateVIC throws VICCashOutProhibitedError, but support
      // both paths.
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
 * Synthesise the citations emitted for a VIC cash-out hard-error. Used by the
 * UI to render the citation block alongside the error message.
 */
export function vicCashOutCitations(): Citation[] {
  return [
    citation(
      'VIC LSL Act 2018 s.34',
      'cash-out.criminal-offence-prohibited',
      47,
      '12 penalty units natural person / 60 penalty units body corporate'
    ),
    citation(
      'VIC LSL Act 2018 s.9',
      'cash-out.lawful-alternative.termination-payout',
      43
    ),
    citation(
      'VIC LSL Act 2018 s.22',
      'cash-out.lawful-alternative.half-pay',
      47
    ),
  ];
}

/**
 * VIC rule set — implements the StateRuleSet contract.
 */
export const VIC_RULE_SET: StateRuleSet = {
  state: 'VIC',
  calculate: calculateVIC,
  calculateSafe: calculateVICSafe,
};
