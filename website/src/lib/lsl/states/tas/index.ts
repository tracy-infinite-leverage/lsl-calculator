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
import { inclusiveDays, overlapDays } from '@/lib/lsl/engine/dates';
import {
  CashOutNotSupportedError,
  JurisdictionBlockedError,
} from '@/lib/lsl/engine/errors';
import { computeSystemFormula } from '@/lib/lsl/engine/system-formula';
import type { StateRuleSet } from '@/lib/lsl/states/StateRuleSet';
import { valueOfWeekTAS, valueOfDayTAS } from './rules/value-of-week';
import { accrualTAS, tasAccrualConstants } from './rules/accrual-table';
import { triggerCitationsTAS, payableByDateTAS } from './rules/trigger-handlers';
import { isTASPublicHoliday } from './rules/public-holidays';
import {
  computeTASContinuousService,
  workersCompOverlapsTriggerTAS,
  type TASExtraInputs,
} from './continuous-service-rules';

export const TAS_JURISDICTION = 'TAS' as const;

/**
 * TAS LSL orchestrator — T8.2.
 *
 * Single rule set per the signed test-cases-tas.md v1.0 (PM-SIGNED 2026-05-26).
 * TAS has no dated regime cliff (parallel to QLD / SA / ACT — NOT VIC / WA
 * pre-/post- pattern).
 *
 * T8.2 implements: per-day rate variation (TBD-TAS-01), commission 3-mo window
 * (TBD-TAS-03), casual s.5(3) 32hr/4wk hybrid (TBD-TAS-04), slackness 6mo +
 * 14-day window (TBD-TAS-12), apprentice 3-mo transition (TBD-TAS-11),
 * parental-leave exclusion (TBD-TAS-13), 60F/65M retirement age (TBD-TAS-02),
 * voluntary res 7-10 yr binary cliff (TBD-TAS-07), advance-leave $0 + advisory
 * (TBD-TAS-08), cash-out gating (s.10), pay-on-termination day-of-termination
 * (s.12(4) / TBD-TAS-08), bonus exclusion advisory (TBD-TAS-15), WC reduced-
 * rate advisory (parallel to QLD/WA/SA/ACT).
 *
 * Sources:
 *   - TAS LSL Act 1976 ss.2, 5 (incl. s.5(1)(c), s.5(3)), 8 (s.8(2), s.8(3)),
 *     10, 11 (incl. s.11(2)(h), s.11(3), s.11(6)), 12 (s.12(4), s.12(9))
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

  // ── TBD-TAS-15 Sev-3 RESOLVED: bonus exclusion absolute advisory.
  if (notesContainBonusTokens(employee)) {
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
    tasExtras,
    employee.wageHistory
  );
  result.warnings.push(...service.warnings);

  // ── Advance-leave refusal at sub-10-yr (TBD-TAS-08 RESOLVED).
  //
  // The 10-year entitlement under s.8(2) crystallises when the WALL-CLOCK
  // continuous-service line reaches 10 years from `effectiveServiceStart` to
  // the prescribed date. LWP / UPL / industrial-action service-events extend
  // the accrual rate but do NOT push back the date the entitlement is reached.
  // T8.3 reconciliation Item 6 sub-bug 2026-05-26 — fixture TC-TAS-058 (10 yrs
  // + 6 days wall-clock with 82 days of LWP) was incorrectly tripping this
  // gate because `yearsOfContinuousService` had subtracted the LWP days. Fix:
  // measure elapsed wall-clock years from `effectiveServiceStart` to the
  // prescribed date and compare to 10.
  const elapsedDaysFromStart = inclusiveDays(
    service.effectiveServiceStart,
    psd
  );
  const elapsedYearsFromStart = new Decimal(elapsedDaysFromStart).dividedBy(
    new Decimal('365.25')
  );
  if (
    trigger.kind === 'taking_leave' &&
    elapsedYearsFromStart.lt(tasAccrualConstants.fullQualifyingYears)
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
    if (vow.valuePerDayBreakdown) {
      result.outputs.valuePerDayBreakdown = vow.valuePerDayBreakdown;
    }
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

  const vow = valueOfWeekTAS(
    employee,
    trigger,
    psd,
    service.effectiveServiceStart
  );

  // ── TBD-TAS-01: emit applied-path or fallback advisories.
  if (vow.path === 'fixed-rate-with-per-day-variation') {
    result.warnings.push({
      code: 'tas_day_to_day_rate_variation_applied',
      message:
        'FT/PT rate computed day-by-day per TAS LSL Act 1976 s.11 because shift penalties / all-purpose allowances vary across the LSL period. `valueOfWeek` is the SUM of per-day payable values. Without `extraInputs.tas_shift_penalty_by_day` the engine falls back to flat weekly rate — see TC-TAS-053.',
    });
  } else if (vow.perDayVariationFellBackToFlat) {
    // Operator chose flat — surface BOTH the TBD-TAS-05 default-flat assumption
    // notice (kept per operator Note B) AND the TBD-TAS-01 fallback advisory.
    result.warnings.push({
      code: 'tas_shift_penalty_assumed_included_in_weekly_gross',
      message:
        'No per-day shift penalty / all-purpose allowance data was supplied (extraInputs.tas_shift_penalty_by_day / tas_all_purpose_allowance_by_day). Engine assumed shift penalties and all-purpose allowances are already included in `currentWeeklyGross` per TAS LSL Act 1976 s.11. Day-to-day rate variation (TBD-TAS-01 — TAS UNIQUE) may produce a different total if penalties/allowances actually vary across the LSL period.',
    });
    if (vow.path === 'fixed-rate') {
      result.warnings.push({
        code: 'tas_day_to_day_rate_variation_advisory',
        message:
          'Operator did NOT supply day-by-day shift penalty / all-purpose allowance data. Engine fell back to flat weekly rate. If the LSL period spans days where shift penalties or all-purpose allowances apply, the day-by-day computation per s.11 may produce a different total. Supply `extraInputs.tas_shift_penalty_by_day` for day-precise computation.',
      });
    }
  }

  // ── TBD-TAS-03: commission 3-mo applied advisory.
  if (vow.path === 'commission-3mo') {
    result.warnings.push({
      code: 'tas_commission_3mo_window_applied',
      message:
        'Commission income averaged over the 13 weeks (91 days) immediately preceding the trigger date per TAS LSL Act 1976 s.11(3) — TAS UNIQUE, shorter than every other state\'s commission window. Where the commission cycle is paid monthly the 13-week window may bisect a payment cycle; the engine attributes commission to the window based on payment date, not earning date. Operators with monthly-cycle commission employees should validate the input figures against the actual payment record.',
    });
  }

  // ── TBD-TAS-18 RESOLVED 2026-05-26 (T8.3 reconciliation Item 6):
  // 12-month casual/PT hours averaging window — UPL / LWOP substitution is
  // the operator's responsibility. Engine takes the operator-supplied
  // `hoursLast12Months*` figure as-is (same pattern as SA TBD-SA-05 RESOLVED).
  // When `leave_without_pay` or `unpaid_parental_leave` events overlap the
  // 12-month window immediately preceding the prescribed date, surface this
  // informational advisory so the operator is told to verify their
  // substitution.
  if (
    employee.employmentType === 'casual' ||
    employee.employmentType === 'part_time'
  ) {
    const windowStart = (() => {
      const psdDate = new Date(`${psd}T00:00:00Z`);
      psdDate.setUTCDate(psdDate.getUTCDate() - 364); // 365-day window inclusive
      return psdDate.toISOString().slice(0, 10) as ISODate;
    })();
    const overlapsUPL = (employee.serviceEvents ?? []).some(
      (ev) =>
        (ev.type === 'leave_without_pay' ||
          ev.type === 'unpaid_parental_leave') &&
        overlapDays(ev.startDate, ev.endDate ?? psd, windowStart, psd) > 0
    );
    if (overlapsUPL) {
      result.warnings.push({
        code: 'tas_12mo_window_upl_overlap_check_substitution',
        message:
          'Unpaid parental leave / leave-without-pay events overlap the 12-month casual/PT hours averaging window under TAS LSL Act 1976 s.11(6). Engine uses the operator-supplied `hoursLast12Months*` figure unchanged. Per TBD-TAS-18 RESOLVED (parallel to SA TBD-SA-05): substitution of UPL weeks with prior worked weeks is the operator\'s responsibility — pre-substitute the figure before submitting. This advisory is informational; no engine recalculation has occurred.',
      });
    }
  }

  // ── TBD-TAS-10 RESOLVED (v1 citation-only, amended T8.3 reconciliation
  // 2026-05-26): single-day LSL request landing on a TAS public holiday.
  // Engine emits the `tas_single_day_lsl_on_ph_exclusive` advisory but does
  // NOT compute the shifted date or recalculate the payable amount — operator
  // handles calendar mechanics outside the engine. Parallel to ACT v1.
  // Heuristic: leaveWeeks < 1 AND leaveStartDate is a TAS PH.
  if (trigger.kind === 'taking_leave' && trigger.leaveWeeks !== undefined) {
    const northern = (tasExtras as Record<string, unknown>)
      .tas_employee_in_northern_tas === true;
    if (
      trigger.leaveWeeks < 1 &&
      isTASPublicHoliday(trigger.leaveStartDate, northern)
    ) {
      result.warnings.push({
        code: 'tas_single_day_lsl_on_ph_exclusive',
        message:
          'Single-day LSL request landing on a TAS public holiday under TAS LSL Act 1976 s.12(9) — public holidays are EXCLUSIVE in TAS (not counted as LSL). The LSL day should shift to the next non-PH working day; the worker is paid the PH rate per award for the original day. v1 engine emits this advisory and the s.12(9) citation only — calendar mechanics (shifting the day, extending leave_end_calendar) are operator-handled outside the engine.',
      });
    }
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

  // ── TBD-TAS-02: retirement default-age advisory.
  if (accrual.retirementDefaultAgeApplied) {
    result.warnings.push({
      code: 'tas_retirement_qualifying_age_60f_65m_default',
      message:
        'Retirement-reason qualifying applied via TAS LSL Act 1976 s.8(3) default sex-specific reading (60 women / 65 men). If the relevant award or agreement specifies a different minimum retirement age, set `extraInputs.tas_award_min_retirement_age_reached: true` to bypass the literal default.',
    });
  }

  // ── Sub-7 / sub-10 / 10+ misconduct indicator warnings.
  if (accrual.sub7YrNoEntitlement) {
    result.warnings.push({
      code: 'sub_7yr_no_entitlement_tas',
      message:
        'Below 7-year pro-rata threshold under TAS LSL Act 1976 s.8(3). No entitlement at this tenure.',
    });
  }
  if (accrual.sub10YrNoQualifyingReason) {
    result.warnings.push({
      code: 'sub_10yr_no_qualifying_reason_tas',
      message:
        '7-to-10 yr tenure but termination reason does not qualify under TAS LSL Act 1976 s.8(3). $0 payable — binary 10-yr cliff applies for voluntary resignation per TBD-TAS-07 RESOLVED.',
    });
  }
  if (accrual.sub10YrMisconductExcluded) {
    result.warnings.push({
      code: 'sub_10yr_misconduct_excluded_tas',
      message:
        'Serious & wilful misconduct dismissal sub-10-yr — pro-rata forfeited per TAS LSL Act 1976 s.8(3).',
    });
  }
  if (accrual.tenYrPlusMisconductFullPayout) {
    result.warnings.push({
      code: 'tas_10yr_plus_misconduct_full_payout',
      message:
        'Dismissal for serious & wilful misconduct at 10+ yrs — full TAS LSL Act 1976 s.8(2) entitlement payable. TAS does NOT mirror WA partial-forfeiture (TBD-TAS-06 RESOLVED).',
    });
  }

  // ── WC overlap at trigger date — TBD-TAS-05 parallel to QLD/WA/SA/ACT.
  const triggerDate: ISODate =
    trigger.kind === 'termination'
      ? trigger.terminationDate
      : trigger.kind === 'as_at'
        ? trigger.asAtDate
        : trigger.kind === 'taking_leave'
          ? trigger.leaveStartDate
          : trigger.cashOutDate;
  if (workersCompOverlapsTriggerTAS(employee.serviceEvents, triggerDate)) {
    result.warnings.push({
      code: 'tas_lsl_calculated_at_wc_reduced_rate_warning',
      message:
        'LSL has been calculated at the rate in force at the time leave is taken under TAS LSL Act 1976 s.11. The worker appears to be on workers compensation at a reduced rate. If feasible, defer taking LSL until the worker is back on their ordinary rate; TAS has no statutory higher-of-rates equivalent to VIC s.17.',
    });
  }

  // ── Pay-on-termination per s.12(4): payable_by = terminationDate itself.
  if (trigger.kind === 'termination') {
    result.payable_by = payableByDateTAS(trigger.terminationDate) as ISODate;
    result.warnings.push({
      code: 'tas_payable_on_day_of_termination_advisory',
      message:
        'TAS LSL Act 1976 s.12(4) deems the employee to have commenced LSL on the date of termination — the payout is due on the day of termination itself. Engine surfaces `payable_by = terminationDate` (parallel to ACT TBD-ACT-08 RESOLVED schema reuse, no new field needed for TAS). Most TAS employers pay within the final pay cycle; this field is informational.',
    });
  }

  // ── Cash-out gating (s.10 — non-blocking advisories).
  if (trigger.kind === 'cash_out') {
    if (
      service.yearsOfContinuousService.gte(tasAccrualConstants.fullQualifyingYears)
    ) {
      result.warnings.push({
        code: 'tas_cashout_post_entitlement_advisory',
        message:
          'Cashing out long service leave in TAS is permitted by agreement once the 10-year entitlement is reached per TAS LSL Act 1976 s.10. Written agreement between employer and employee is recommended. Value of cash-out is calculated as if LSL were taken — same as value-of-week × weeks cashed. Non-blocking advisory — engine emits informational warning, not a hard error.',
      });
    } else {
      result.warnings.push({
        code: 'tas_cashout_pre_entitlement_not_authorised',
        message:
          'Cashing out at sub-10-year tenure is NOT authorised under TAS LSL Act 1976 s.10 — entitlement to cash out arises only once the 10-year LSL entitlement has crystallised. If the worker is leaving the employer, change the trigger to "termination" with a qualifying reason.',
      });
    }
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
  if (vow.valuePerDayBreakdown) {
    result.outputs.valuePerDayBreakdown = vow.valuePerDayBreakdown;
  }

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
