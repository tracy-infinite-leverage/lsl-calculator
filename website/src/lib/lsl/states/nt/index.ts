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
  JurisdictionBlockedError,
  NTCashOutForbiddenError,
} from '@/lib/lsl/engine/errors';
import { computeSystemFormula } from '@/lib/lsl/engine/system-formula';
import type { StateRuleSet } from '@/lib/lsl/states/StateRuleSet';
import { valueOfWeekNT, valueOfDayNT } from './rules/value-of-week';
import { accrualNT, ntAccrualConstants } from './rules/accrual-table';
import { triggerCitationsNT, refuseCashOutNT } from './rules/trigger-handlers';
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
 * T9.1 SCAFFOLD implements: jurisdiction gate, cash-out hard error (s.10(4) /
 * TBD-NT-08), advance-leave $0 + advisory (TBD-NT-08 leave-in-advance branch),
 * wall-clock continuous-service walk, fixed-rate value-of-week path, accrual
 * shell with sub-7/sub-10/10+/misconduct branches, pay-on-termination advisory
 * with `payable_by` OMITTED (TBD-NT-09 Option (b)), and the load-bearing
 * advisory codes (workers comp excluded, PH inclusive, retirement age pension
 * age, bonus inclusion, board/lodging, per-year formula).
 *
 * T9.2 will implement: per-year `RP × HWW × 1.3` formula (s.11(3) — NT
 * UNIQUE), Age Pension age lookup against `employee.dob` (Cth SS Act 1991
 * s.23), s.10(1A) complete-blocks-only misconduct truncation, s.11(1)(b)
 * per-year casual averaging, s.11 rate-varies 12-mo commission lookback,
 * service-event handling (WC / maternity / sick / LWP / industrial dispute
 * all excluded), and the full s.7(2) ordinary-pay inclusion/exclusion list.
 *
 * Sources:
 *   - NT LSL Act 1981 ss.7 (incl. s.7(2), s.7(2)(b), s.7(2)(c)), 8, 9, 10
 *     (s.10(1), s.10(1A), s.10(2), s.10(3), s.10(4)), 11 (s.11(1)(b), s.11(3),
 *     s.11(4)/(5)), 12 (s.12(3), s.12(6)/(7), s.12(8)/(9))
 *   - APA LSL Masterclass — NT section
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
    const nonNT = states.filter((s) => s !== 'NT');
    if (nonNT.length > 0) {
      warnings.push({
        code: 'cross_jurisdiction_pending',
        message: `Employee has worked in ${states.join(' and ')}. The sufficiently connected test (legal judgement) is for legal counsel where doubt exists. Engine has computed using user-nominated governing jurisdiction: NT.`,
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

export function calculateNT(employee: Employee, trigger: Trigger): Result {
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

  // ── Cash-out forbidden under s.10(4) per TBD-NT-08 RESOLVED Option (b).
  // Cross-state parallel to VIC s.34. Hard error — no numeric output.
  if (trigger.kind === 'cash_out') {
    refuseCashOutNT();
  }

  // ── Termination requires endDate.
  if (trigger.kind === 'termination' && !employee.endDate) {
    throw new Error(
      'Termination trigger requires Employee.endDate to be set (or use trigger.terminationDate consistently).'
    );
  }

  // ── TBD-NT-07: bonus inclusion advisory based on operator flag.
  const ntExtras = (employee.extraInputs ?? {}) as NTExtraInputs;
  if (notesContainBonusTokens(employee)) {
    if (ntExtras.nt_bonus_usually_paid_with_pay === true) {
      result.warnings.push({
        code: 'nt_bonus_usually_paid_with_pay_included',
        message:
          'Bonus payments included in ordinary pay per NT LSL Act 1981 s.7(2)(b) — NT broadest bonus-inclusion in Australia. Operator confirmed via `extraInputs.nt_bonus_usually_paid_with_pay: true` that bonuses are usually paid with pay.',
      });
    } else {
      result.warnings.push({
        code: 'nt_bonus_usually_paid_with_pay_excluded',
        message:
          'Bonus payments excluded from ordinary pay — operator did not confirm the NT LSL Act 1981 s.7(2)(b) "usually paid with pay" test (set `extraInputs.nt_bonus_usually_paid_with_pay: true` to include). Engine treated bonus components as excluded by default.',
      });
    }
  }

  // T9.1 NOTE: cash_out already returned above; psd derivation is therefore
  // a no-cash_out path here. The branch is kept simple deliberately.
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

  const service = computeNTContinuousService(
    employee.startDate,
    psd,
    employee.serviceEvents,
    employee.employmentType,
    ntExtras,
    employee.wageHistory
  );
  result.warnings.push(...service.warnings);

  // ── Advance-leave refusal at sub-10-yr per TBD-NT-08 leave-in-advance branch.
  // Uses WALL-CLOCK elapsed years from `effectiveServiceStart` to the prescribed
  // date (parallel to TAS T8.3 reconciliation fix Item 6 sub-bug 2026-05-26 —
  // LWP-excluded years would incorrectly trip the gate for a worker with
  // wall-clock tenure ≥10 yrs).
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

  // ── TBD-NT-01: emit applied / fallback advisory for per-year hours history.
  if (vow.perYearHistoryMissing) {
    result.warnings.push({
      code: 'nt_per_year_hours_history_missing',
      message:
        'Operator did not supply `extraInputs.nt_hours_per_week_by_year`. Engine fell back to single-year flat path using `currentWeeklyGross` per NT LSL Act 1981 s.11. The per-year `RP × HWW × 1.3` formula (s.11(3) — NT UNIQUE) may produce a different total if hours varied across years of service. Supply per-year hours history for the locked s.11(3) computation.',
    });
  }

  // ── TBD-NT-11: board/lodging advisory if operator supplied a value.
  if (
    typeof ntExtras.nt_board_lodging_cash_value_weekly === 'number' &&
    ntExtras.nt_board_lodging_cash_value_weekly > 0
  ) {
    result.warnings.push({
      code: 'nt_board_lodging_included',
      message: `Board and lodging cash value included per NT LSL Act 1981 s.7(2)(c). Operator-supplied value: $${ntExtras.nt_board_lodging_cash_value_weekly}/wk. Statutory fallback if unsupplied: $15/wk board + $5/wk lodging (NT-unique).`,
    });
  }

  // ── TBD-NT-09: PH-inclusive in LSL advisory (always emitted for NT
  // taking_leave triggers — parallel to SA's PH-inclusive treatment).
  if (trigger.kind === 'taking_leave') {
    result.warnings.push({
      code: 'nt_ph_inclusive_in_lsl',
      message:
        'Public holidays during LSL are part of LSL and do NOT extend the period per NT LSL Act 1981 s.9. NT-DIVERGENT from NSW/VIC/QLD/WA/TAS/ACT (which extend); PARALLEL to SA.',
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

  // ── TBD-NT-02: retirement Age Pension age advisories.
  if (accrual.retirementAgePensionAgeApplied) {
    result.warnings.push({
      code: 'nt_retirement_qualifying_age_pension_age',
      message:
        'NT LSL Act 1981 s.10(2) retirement gate applied using Age Pension age (currently 67 for both genders per Cth Social Security Act 1991 s.23). Engine confirmed qualifying age was reached at termination.',
    });
  }

  // ── Sub-7 / sub-10 / 10+ misconduct indicator warnings.
  if (accrual.sub7YrNoEntitlement) {
    result.warnings.push({
      code: 'sub_7yr_no_entitlement_nt',
      message:
        'Below 7-year pro-rata threshold under NT LSL Act 1981 s.10. No entitlement at this tenure.',
    });
  }
  if (accrual.sub10YrNoQualifyingReason) {
    result.warnings.push({
      code: 'sub_10yr_no_qualifying_reason_nt',
      message:
        '7-to-10 yr tenure but termination reason does not qualify under NT LSL Act 1981 s.10(2). $0 payable — voluntary resignation is NOT a qualifying reason per TBD-NT-04 RESOLVED Option (a). Binary 10-yr cliff.',
    });
  }
  if (accrual.sub10YrMisconductExcluded) {
    result.warnings.push({
      code: 'sub_10yr_misconduct_excluded_nt',
      message:
        'Serious & wilful misconduct dismissal sub-10-yr — pro-rata forfeited per NT LSL Act 1981 s.10.',
    });
  }
  if (accrual.tenYrPlusMisconductCompleteBlocksOnly) {
    result.warnings.push({
      code: 'nt_10yr_plus_misconduct_complete_blocks_only',
      message:
        'Dismissal for serious & wilful misconduct at 10+ yrs — ONLY complete 10y/15y blocks payable per NT LSL Act 1981 s.10(1A). NT UNIQUE: different from NSW/VIC/QLD/SA/ACT/TAS (full payout) and from WA (5-yr block partial-forfeiture).',
    });
  }

  // ── WC overlap at trigger date — defensive advisory. NT-DIVERGENT: WC
  // absence does NOT count as service in NT, so this case rarely arises, but
  // the advisory fires when an operator-supplied WC event window overlaps the
  // trigger date.
  const triggerDate: ISODate =
    trigger.kind === 'termination'
      ? trigger.terminationDate
      : trigger.kind === 'as_at'
        ? trigger.asAtDate
        : trigger.leaveStartDate;
  if (workersCompOverlapsTriggerNT(employee.serviceEvents, triggerDate)) {
    result.warnings.push({
      code: 'nt_lsl_calculated_at_wc_reduced_rate_warning',
      message:
        'A workers compensation absence overlaps the trigger date. Note that WC absence does NOT count as service in NT per s.12 (NT-DIVERGENT), so this case typically does not arise. Advisory emitted defensively.',
    });
  }

  // ── Pay-on-termination per TBD-NT-09 RESOLVED Option (b): OMIT payable_by
  // and emit the "as soon as practicable" advisory (parallel to NSW
  // "forthwith" treatment).
  if (trigger.kind === 'termination') {
    result.warnings.push({
      code: 'nt_payable_as_soon_as_practicable_advisory',
      message:
        'NT LSL Act 1981 s.10 requires payment of accrued LSL on termination "as soon as practicable" after cessation. Engine does NOT set `payable_by` (no fixed statutory window — parallel to NSW "forthwith" treatment per TBD-NT-09 RESOLVED Option (b)).',
    });
  }

  const triggerCits = triggerCitationsNT(trigger);

  const valueOfDay = valueOfDayNT(vow.value);
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
        'Below 7-year pro-rata threshold. Entitlement is accruing but no cash payment is currently triggerable under NT LSL Act 1981 s.10.',
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
