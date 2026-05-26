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
import { valueOfWeekTAS, valueOfDayTAS } from './rules/value-of-week';
import { accrualTAS, tasAccrualConstants } from './rules/accrual-table';
import { triggerCitationsTAS, payableByDateTAS } from './rules/trigger-handlers';
import {
  computeTASContinuousService,
  workersCompOverlapsTriggerTAS,
  type TASExtraInputs,
} from './continuous-service-rules';

export const TAS_JURISDICTION = 'TAS' as const;

/**
 * TAS LSL orchestrator — T8.1 SCAFFOLD.
 *
 * Single rule set per the signed test-cases-tas.md v1.0 (PM-SIGNED 2026-05-26)
 * — TAS has no dated regime cliff (parallel to QLD / SA / ACT pattern; NOT
 * VIC / WA pre-/post- pattern).
 *
 * T8.1 scope (this task): scaffold + smoke-fixture (TC-TAS-001 10-yr FT
 * taking_leave full-entitlement). Subsequent T8.x tasks implement:
 *   - T8.2 — rules + orchestrator: per-day rate variation (TBD-TAS-01),
 *     casual s.5(3) 32hr/4wk test (TBD-TAS-04 hybrid), s.11(3) 3-mo commission
 *     window, s.8(3) qualifying-reason gate (incl. 60F/65M default sex-
 *     specific), s.10 cash-out gating, advance-leave refusal at sub-10-yr,
 *     slackness-of-trade 6mo + 14-day return-to-work window (TBD-TAS-12),
 *     apprentice 3-mo tolerance (TBD-TAS-11), parental-leave exclusion
 *     (TBD-TAS-13).
 *   - T8.3 — 78 fixtures (75 single-mode TC-TAS-001..075 + 3 bulk-mode
 *     TC-TAS-BULK-001..003).
 *
 * Sources:
 *   - TAS LSL Act 1976 ss.2, 5 (incl. s.5(1)(c), s.5(3)), 8 (s.8(2), s.8(3)),
 *     10, 11 (incl. s.11(2)(h), s.11(3), s.11(6)), 12 (s.12(4), s.12(9))
 *   - LSL Regulations 2017 (Tas) s.7 (records retention — out of v1)
 *   - Construction Industry (Long Service) Act 1997 (Tas) — TasBuild, OUT OF
 *     v1 SCOPE
 *   - WorkSafe Tasmania — LSL guidance material
 *   - APA LSL Masterclass PDF pp.95-108
 *   - docs/qa/test-cases-tas.md v1.0 PM-signed 2026-05-26
 */

function checkJurisdiction(employee: Employee): { ok: boolean; warnings: Warning[] } {
  const warnings: Warning[] = [];
  const states = employee.statesOfService ?? [];
  const governing = employee.governingJurisdiction;

  if (states.length === 0) return { ok: true, warnings };

  if (states.length === 1) {
    if (states[0] === 'TAS') return { ok: true, warnings };
    return {
      ok: false,
      warnings: [
        {
          code: 'cross_jurisdiction_pending',
          message: `Employee has worked only in ${states[0]}. Routed to TAS by user nomination — but states-of-service is single-state. Resolve before computing.`,
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

  if (governing === 'TAS') {
    const nonTas = states.filter((s) => s !== 'TAS');
    if (nonTas.length > 0) {
      warnings.push({
        code: 'cross_jurisdiction_pending',
        message: `Employee has worked in ${states.join(' and ')}. The sufficiently connected test (legal judgement — see APA LSL Masterclass p.138) is for legal counsel where doubt exists. Engine has computed using user-nominated governing jurisdiction: TAS.`,
      });
    }
    return { ok: true, warnings };
  }

  return {
    ok: false,
    warnings: [
      {
        code: 'cross_jurisdiction_pending',
        message: `Governing jurisdiction nominated as ${governing}. This calculation routed to TAS but the governing state differs — resolve before computing.`,
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

export function calculateTAS(employee: Employee, trigger: Trigger): Result {
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
    // TAS s.11(2)(h): bonuses are EXCLUDED ABSOLUTELY — the most restrictive
    // bonus treatment in Australia. Surface the TAS-specific advisory rather
    // than the generic v1-out-of-scope warning.
    result.warnings.push({
      code: 'tas_bonus_excluded_absolutely',
      message:
        'Wage history notes mention bonus / incentive / back-pay / retrospective. Under TAS LSL Act 1976 s.11(2)(h) bonus payments are excluded absolutely from ordinary pay — the most restrictive bonus treatment in Australia. Calculation runs on the user-provided gross with bonus components stripped.',
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

  const tasExtras = (employee.extraInputs ?? {}) as TASExtraInputs;
  const service = computeTASContinuousService(
    employee.startDate,
    psd,
    employee.serviceEvents,
    employee.employmentType,
    tasExtras
  );
  result.warnings.push(...service.warnings);

  // ── Advance-leave refusal (TBD-TAS — taking_leave sub-10-yr is NOT
  // permitted under TAS Act — no advance-leave provision). Engine returns $0
  // with `tas_advance_leave_not_permitted` advisory; status remains
  // 'computed' and the accrual snapshot still runs.
  if (
    trigger.kind === 'taking_leave' &&
    service.yearsOfContinuousService.lt(tasAccrualConstants.fullQualifyingYears)
  ) {
    result.warnings.push({
      code: 'tas_advance_leave_not_permitted',
      message:
        'Taking LSL before the 10-year entitlement is NOT permitted under TAS LSL Act 1976 — the Act contains no leave-in-advance provision. Engine refuses the leave-taking trigger and returns $0. To compute what the worker WOULD be entitled to at this tenure if terminated for a qualifying reason, change the trigger to "termination" with a qualifying reason; or use "as_at" for an accrual snapshot.',
    });
    const vow = valueOfWeekTAS(employee, trigger, psd, service.effectiveServiceStart);
    const zero = new Decimal(0);
    const vowCitations = [...vow.citations, ...service.citations];
    const triggerCits = triggerCitationsTAS(trigger);
    const weeksCitations = [...service.citations, ...triggerCits];
    const dollarsCitations = [...service.citations, ...vow.citations, ...triggerCits];
    result.outputs = {
      valueOfWeek: {
        value: vow.value,
        display: displayAUD(vow.value),
        citations: vowCitations,
      },
      valueOfDay: {
        value: valueOfDayTAS(vow.value),
        display: displayAUD(valueOfDayTAS(vow.value)),
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

  const vow = valueOfWeekTAS(
    employee,
    trigger,
    psd,
    service.effectiveServiceStart
  );

  // Surface day-to-day variation fallback advisory per TBD-TAS-01 RESOLVED.
  // T8.2 will replace this with the real per-day variation pathway and only
  // emit when fallback is genuinely engaged AFTER attempting the per-day
  // calculation.
  if (vow.perDayVariationFellBackToFlat) {
    result.warnings.push({
      code: 'tas_shift_penalty_assumed_included_in_weekly_gross',
      message:
        'No per-day shift penalty / all-purpose allowance data was supplied (extraInputs.tas_shift_penalty_by_day / tas_all_purpose_allowance_by_day). Engine assumed shift penalties and all-purpose allowances are already included in `currentWeeklyGross` per TAS LSL Act 1976 s.11. Day-to-day rate variation (TBD-TAS-01 — TAS UNIQUE) may produce a different total if penalties/allowances actually vary across the LSL period.',
    });
  }

  const priorTaken = employee.priorLeaveTakenWeeks
    ? d(employee.priorLeaveTakenWeeks)
    : new Decimal(0);
  const accrual = accrualTAS(
    service.yearsOfContinuousService,
    employee,
    trigger,
    priorTaken
  );

  if (accrual.retirementDefaultAgeApplied) {
    result.warnings.push({
      code: 'tas_retirement_qualifying_age_60f_65m_default',
      message:
        'Retirement-reason qualifying applied via TAS LSL Act 1976 s.8(3) default sex-specific reading (60 women / 65 men). If the relevant award or agreement specifies a different minimum retirement age, set `extraInputs.tas_award_min_retirement_age_reached: true` to bypass the literal default.',
    });
  }

  // ── WC overlap at trigger date — emits the WC reduced-rate advisory in T8.2
  // when present; the helper is wired now so the orchestrator surface is
  // stable.
  const triggerDate: ISODate =
    trigger.kind === 'termination'
      ? trigger.terminationDate
      : trigger.kind === 'as_at'
        ? trigger.asAtDate
        : trigger.kind === 'taking_leave'
          ? trigger.leaveStartDate
          : trigger.cashOutDate;
  void workersCompOverlapsTriggerTAS(employee.serviceEvents, triggerDate);

  // ── Pay-on-termination per s.12(4): payable_by = terminationDate itself.
  if (trigger.kind === 'termination') {
    result.payable_by = payableByDateTAS(trigger.terminationDate) as ISODate;
  }

  const triggerCits = triggerCitationsTAS(trigger);

  const valueOfDay = valueOfDayTAS(vow.value);
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
        'Below 7-year pro-rata threshold. Entitlement is accruing but no cash payment is currently triggerable under TAS LSL Act 1976 s.8(3).',
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
    weeklyAvg12mo: new Decimal(0),
    weeklyAvg5yr: new Decimal(0),
    payableIndicator: accrual.payableIndicator,
    serviceStartUsed: service.effectiveServiceStart,
  };

  return result;
}

export function calculateTASSafe(employee: Employee, trigger: Trigger): Result {
  try {
    return calculateTAS(employee, trigger);
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

export const TAS_RULE_SET: StateRuleSet = {
  state: 'TAS',
  calculate: calculateTAS,
  calculateSafe: calculateTASSafe,
};
